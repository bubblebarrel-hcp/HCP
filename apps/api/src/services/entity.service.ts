import { randomBytes } from 'crypto';
import { Audience, Prisma, SubjectType } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import {
  RESERVED_USERNAMES,
  extractEntities,
  isValidUsername,
  normalizeTag,
  usernameFrom,
} from '../utils/entities';
import { hiddenFor } from './block.service';
import { followedBy } from './follow.service';
import type { Actor } from './permission.service';
import { feedReelWhere } from './reel.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// #hashtags and @mentions (D59).
//
// Both are read out of a hasher's own words and kept as an index beside them, so
// "everything tagged #beercheck" and "who did this mention" are queries and not
// text searches. The words stay the record: the index is rewritten whenever they
// are edited, and nothing here is history.
//
// A tag has no audience of its own. What somebody finds under it is whatever
// they could already see, so a followers-only post is under its tags for the
// followers and for nobody else, and a tag with only private uses is, to a
// stranger, a tag that does not exist.

type Tx = Prisma.TransactionClient;

// Where the words live. A comment says which thing it is on, so a notification
// opens the thing and not a comment that has no page of its own.
interface Home {
  type: SubjectType;
  id: string;
}

const standing = { status: 'ACTIVE' as const, deactivatedAt: null, deletedAt: null };

// ─── Usernames ───

// A free username for somebody new: their handle if it makes a valid one, then
// the handle with a number, and in the end "hasher_" and six hex digits, which
// nobody has to be told is a fallback.
export async function allocateUsername(client: Tx | typeof prisma, handle: string | null | undefined) {
  const base = usernameFrom(handle);
  const candidates: string[] = [];
  if (base) {
    candidates.push(base);
    for (let n = 2; n <= 5; n += 1) candidates.push(`${base.slice(0, 28)}_${n}`);
  }
  for (const candidate of candidates) {
    if (!isValidUsername(candidate)) continue;
    const taken = await client.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `hasher_${randomBytes(3).toString('hex')}`;
    const taken = await client.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `hasher_${randomBytes(8).toString('hex')}`;
}

export async function setUsername(userId: string, requested: string) {
  const username = requested.trim().replace(/^@/, '').toLowerCase();
  if (RESERVED_USERNAMES.has(username)) {
    throw ApiError.badRequest('That name is kept for the platform. Pick another.', 'USERNAME_RESERVED');
  }
  if (!isValidUsername(username)) {
    throw ApiError.badRequest(
      'A username is 3 to 30 letters, numbers, "_" or ".", starting and ending on a letter or number.',
      'USERNAME_INVALID',
    );
  }
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (current?.username === username) return { username };

  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken) throw ApiError.conflict('Somebody already has that username.', 'USERNAME_TAKEN');

  try {
    await prisma.user.update({ where: { id: userId }, data: { username } });
  } catch (error) {
    // Two hashers asking for the same name at once: the unique index decides.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ApiError.conflict('Somebody already has that username.', 'USERNAME_TAKEN');
    }
    throw error;
  }
  return { username };
}

// Who a /u/<username> link is. The id is all the page needs: it hands over to the
// hasher's own page, which decides what is shown.
export async function findByUsername(username: string) {
  const user = await prisma.user.findFirst({
    where: { username: username.toLowerCase(), ...standing },
    select: { id: true },
  });
  if (!user) throw ApiError.notFound('No hasher has that username');
  return { id: user.id };
}

// ─── Writing: keeping the index beside the words ───

export interface SyncInput {
  subject: Home;
  authorId: string;
  text: string | null | undefined;
  // Where a mention's notification opens. Defaults to the subject itself.
  home?: Home;
  // People who are already being told about this some other way — the author of
  // the post under a comment, the person a reply answers — and so are not told
  // twice.
  alsoNotified?: string[];
  // A draft is nobody's to read yet, so it is indexed and told to no one.
  announce?: boolean;
}

// Rewrite the tags and mentions of one piece of text. Runs in the caller's
// transaction, so a post that publishes has its tags and the event that tells
// the people it mentions, or none of them.
export async function syncEntities(tx: Tx, input: SyncInput) {
  const { tags, mentions } = extractEntities(input.text);
  const { type, id } = input.subject;

  // Tags.
  const existingTags = await tx.contentTag.findMany({
    where: { subjectType: type, subjectId: id },
    select: { id: true, hashtag: { select: { tag: true } } },
  });
  const have = new Set(existingTags.map((row) => row.hashtag.tag));
  const gone = existingTags.filter((row) => !tags.includes(row.hashtag.tag)).map((row) => row.id);
  const added = tags.filter((tag) => !have.has(tag));
  if (gone.length) await tx.contentTag.deleteMany({ where: { id: { in: gone } } });
  if (added.length) {
    await tx.hashtag.createMany({ data: added.map((tag) => ({ tag })), skipDuplicates: true });
    const rows = await tx.hashtag.findMany({ where: { tag: { in: added } }, select: { id: true } });
    await tx.contentTag.createMany({
      data: rows.map((row) => ({ hashtagId: row.id, subjectType: type, subjectId: id })),
      skipDuplicates: true,
    });
  }

  // Mentions. Somebody who does not exist is not mentioned: it stays plain text.
  // Nobody is mentioned by themself.
  const people = mentions.length
    ? await tx.user.findMany({
        where: { username: { in: mentions }, id: { not: input.authorId }, ...standing },
        select: { id: true },
      })
    : [];
  const wanted = new Set(people.map((p) => p.id));
  const existing = await tx.contentMention.findMany({
    where: { subjectType: type, subjectId: id },
    select: { id: true, mentionedUserId: true },
  });
  const had = new Set(existing.map((row) => row.mentionedUserId));
  const dropped = existing.filter((row) => !wanted.has(row.mentionedUserId)).map((row) => row.id);
  const fresh = [...wanted].filter((userId) => !had.has(userId));
  if (dropped.length) await tx.contentMention.deleteMany({ where: { id: { in: dropped } } });
  if (fresh.length) {
    await tx.contentMention.createMany({
      data: fresh.map((mentionedUserId) => ({
        subjectType: type,
        subjectId: id,
        mentionedUserId,
        authorId: input.authorId,
      })),
      skipDuplicates: true,
    });
  }

  // Only the newly mentioned are told, so editing a typo in a post does not
  // notify everybody in it again.
  const skip = new Set(input.alsoNotified ?? []);
  const tell = input.announce === false ? [] : fresh.filter((userId) => !skip.has(userId));
  if (tell.length) {
    const home = input.home ?? input.subject;
    await recordEvent(tx, {
      eventType: 'ContentMentioned',
      aggregateType: home.type,
      aggregateId: home.id,
      actorId: input.authorId,
      payload: {
        subjectType: type,
        subjectId: id,
        homeType: home.type,
        mentionedUserIds: tell,
      },
    });
  }
}

// ─── Reading ───

// Who a viewer may be told about when they type "@": hashers whose username or
// hash handle starts or contains what they typed. The people they follow come
// first, because that is who they usually mean.
export async function suggestMentions(actor: Actor, q: string, limit: number) {
  const query = q.trim().replace(/^@/, '');
  const followedIds = new Set((await followedBy(actor.id)).userIds);
  // Nobody who has blocked you, or whom you blocked, is offered (D60).
  const { blocked } = await hiddenFor(actor.id);

  const rows = await prisma.user.findMany({
    where: {
      ...standing,
      id: { notIn: [actor.id, ...blocked] },
      username: { not: null },
      ...(query
        ? {
            OR: [
              { username: { startsWith: query.toLowerCase() } },
              { hashHandle: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : { id: { in: [...followedIds] } }),
    },
    select: { ...userPublicSelect, username: true, avatarUrl: true },
    take: 40,
  });

  return rows
    .sort((a, b) => Number(followedIds.has(b.id)) - Number(followedIds.has(a.id)))
    .slice(0, limit)
    .map((u) => ({
      id: u.id,
      username: u.username as string,
      name: publicName(u),
      avatarUrl: u.avatarUrl,
      following: followedIds.has(u.id),
    }));
}

// The ids of what carries a tag, newest first, for a list to page over. Bounded:
// a tag with more than this many uses is paged through its newest.
const TAGGED_CAP = 2000;

export async function taggedIds(type: SubjectType, rawTag: string) {
  const tag = normalizeTag(rawTag);
  if (!tag) return [];
  const rows = await prisma.contentTag.findMany({
    where: { subjectType: type, hashtag: { tag } },
    orderBy: { createdAt: 'desc' },
    take: TAGGED_CAP,
    select: { subjectId: true },
  });
  return rows.map((row) => row.subjectId);
}

// How many public things each tag labels, which is the only number a stranger
// may be shown: a count that included followers-only posts would say something
// about content they cannot read. A post is public when it, and the profile it is
// on, are; a reel also has to be inside its day (D58).
async function publicUsage(opts: { tagIds?: string[]; since?: Date }) {
  const rows = await prisma.contentTag.findMany({
    where: {
      subjectType: { in: [SubjectType.POST, SubjectType.REEL] },
      ...(opts.tagIds ? { hashtagId: { in: opts.tagIds } } : {}),
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { hashtagId: true, subjectType: true, subjectId: true },
  });

  const postIds = rows.filter((r) => r.subjectType === SubjectType.POST).map((r) => r.subjectId);
  const reelIds = rows.filter((r) => r.subjectType === SubjectType.REEL).map((r) => r.subjectId);
  const author = { is: { profileVisibility: Audience.PUBLIC, ...standing } };

  const [posts, reels] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: { id: { in: postIds }, status: 'PUBLISHED', visibility: Audience.PUBLIC, author },
          select: { id: true },
        })
      : [],
    reelIds.length
      ? prisma.reel.findMany({
          where: { id: { in: reelIds }, ...feedReelWhere(), visibility: Audience.PUBLIC, author },
          select: { id: true },
        })
      : [],
  ]);
  const visible = new Set([...posts, ...reels].map((r) => r.id));

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!visible.has(row.subjectId)) continue;
    counts.set(row.hashtagId, (counts.get(row.hashtagId) ?? 0) + 1);
  }
  return counts;
}

// What is being tagged this week. Reels last a day, so this is mostly posts.
export async function trending(limit: number) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const counts = await publicUsage({ since });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const tags = await prisma.hashtag.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, tag: true },
  });
  const byId = new Map(tags.map((t) => [t.id, t.tag]));
  return top.flatMap(([id, count]) => {
    const tag = byId.get(id);
    return tag ? [{ tag, count }] : [];
  });
}

// Tags that start with what was typed, for the search box. Only tags with something
// public under them are offered.
export async function searchTags(q: string, limit: number) {
  const tag = q.trim().replace(/^#/, '').toLowerCase();
  if (tag.length < 2) return [];
  const found = await prisma.hashtag.findMany({
    where: { tag: { startsWith: tag } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, tag: true },
  });
  if (found.length === 0) return [];
  const counts = await publicUsage({ tagIds: found.map((t) => t.id) });
  return found
    .map((t) => ({ tag: t.tag, count: counts.get(t.id) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
