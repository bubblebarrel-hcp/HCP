import {
  Audience,
  MediaTargetType,
  ModerationState,
  PostStatus,
  Prisma,
  SubjectType,
  UploadState,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { activeFollowSet, canSeeAudience, contentVisibleAuthors } from './audience.service';
import { hiddenFor } from './block.service';
import { attachPreview, previewSelect } from './link-preview.service';
import { type PollInput, type SerializedPoll, pollCreateData, pollsFor, startClock } from './poll.service';
import { syncEntities, taggedIds } from './entity.service';
import { type Actor, assertKennelPermission, resolveKennelContext } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { canView, getAccess, publicName, userPublicSelect } from './run.service';
import * as stats from './stats.service';

// "What's on trail?" — a hasher's own words in the feed (D51).
//
// The sibling of a reel, not a kind of one: a reel is media with a caption and
// D48 refuses an empty one because it would be a broken player; a post is words
// with optional photos, and a post with no photo is just a post.
//
// A post is as public as its author's profile (D57): everybody, their approved
// followers, or only them. There is no audience on the post itself; the composer
// says which it is rather than asking each time.
//
// Photos follow the ordinary upload path (D28): the post is created as a draft,
// the browser PUTs each photo to storage against a POST target, and publishing
// is a separate step so a half-uploaded post never appears in anybody's feed.
// A post with no photos goes through the same two steps; the composer just does
// them back to back.

const S = PostStatus;

export const MAX_BODY = 5000;

export interface PostInput {
  body?: string;
  // Two to five answers and how long they stay open (D60).
  poll?: PollInput;
  visibility?: Audience;
  kennelId?: string | null;
  runId?: string | null;
}

const postSelect = {
  id: true,
  body: true,
  visibility: true,
  status: true,
  publishedAt: true,
  editedAt: true,
  createdAt: true,
  authorId: true,
  kennelId: true,
  runId: true,
  // The picture is public identity like the handle (D11).
  author: { select: { ...userPublicSelect, avatarUrl: true } },
  kennel: { select: { id: true, slug: true, shortName: true, primaryColor: true } },
  run: { select: { id: true, runNumber: true, title: true } },
  // What the first link in the words looks like, once it has been read (D60).
  linkPreview: { select: previewSelect },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

export interface PostPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

// The photos on a post, in the order they were added — the same rule a reel's
// items follow (D48), and for the same reason: that is the order the hasher
// picked them.
async function photosFor(postIds: string[]) {
  const byPost = new Map<string, PostPhoto[]>();
  if (postIds.length === 0) return byPost;

  const links = await prisma.mediaLink.findMany({
    where: { targetType: MediaTargetType.POST, targetId: { in: postIds } },
    orderBy: { createdAt: 'asc' },
    select: {
      targetId: true,
      media: {
        select: {
          id: true,
          kind: true,
          url: true,
          thumbnailUrl: true,
          width: true,
          height: true,
          uploadState: true,
          moderationState: true,
        },
      },
    },
  });

  for (const link of links) {
    const media = link.media;
    // A half-uploaded or rejected photo is simply not on the post.
    if (media.uploadState !== UploadState.AVAILABLE) continue;
    if (media.moderationState === ModerationState.REJECTED) continue;
    if (!media.url) continue;

    const list = byPost.get(link.targetId) ?? [];
    list.push({
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      width: media.width,
      height: media.height,
    });
    byPost.set(link.targetId, list);
  }
  return byPost;
}

function serialize(
  post: PostRow,
  viewerId?: string,
  photos: PostPhoto[] = [],
  engagement: stats.Engagement = stats.EMPTY,
  poll: SerializedPoll | null = null,
) {
  return {
    id: post.id,
    body: post.body,
    // Who may read it (D57): its own audience, narrowing its author's profile.
    visibility: post.visibility,
    status: post.status,
    publishedAt: post.publishedAt,
    editedAt: post.editedAt,
    createdAt: post.createdAt,
    author: {
      id: post.author.id,
      name: publicName(post.author),
      avatarUrl: post.author.avatarUrl,
    },
    // Where the hasher was, when they said. Null is normal.
    kennel: post.kennel,
    run: post.run,
    photos,
    engagement,
    poll,
    linkPreview: post.linkPreview,
    isMine: viewerId ? post.authorId === viewerId : false,
  };
}

export type SerializedPost = ReturnType<typeof serialize>;

async function serializeOne(post: PostRow, viewerId?: string) {
  const [photos, engagement, polls] = await Promise.all([
    photosFor([post.id]),
    stats.engagementOne(viewerId, SubjectType.POST, post.id),
    pollsFor(viewerId, new Map([[post.id, post.authorId]])),
  ]);
  return serialize(post, viewerId, photos.get(post.id) ?? [], engagement, polls.get(post.id) ?? null);
}

async function findPost(id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Post not found');
  const post = await prisma.post.findUnique({ where: { id }, select: postSelect });
  if (!post) throw ApiError.notFound('Post not found');
  return post;
}

function cleanBody(body: string | undefined) {
  const trimmed = (body ?? '').trim();
  if (trimmed.length > MAX_BODY) {
    throw ApiError.badRequest('That is longer than a post. Write it up as a trail report.', 'POST_TOO_LONG');
  }
  return trimmed;
}

// ─── Writing one ───

export async function createDraft(actor: Actor, input: PostInput) {
  // Context is optional, but a context that is claimed has to be real and the
  // hasher has to be entitled to it — the same rule a reel follows (D41).
  if (input.kennelId) {
    const kennel = await prisma.kennel.findUnique({ where: { id: input.kennelId }, select: { id: true } });
    if (!kennel) throw ApiError.notFound('Kennel not found');
    const context = await resolveKennelContext(actor, input.kennelId);
    if (!context.isMember) throw ApiError.forbidden('Only members post to a kennel.', 'MEMBERS_ONLY');
  }
  if (input.runId) {
    const access = await getAccess(actor, input.runId);
    if (!canView(access)) throw ApiError.notFound('Run not found');
  }

  const post = await prisma.post.create({
    data: {
      authorId: actor.id,
      body: cleanBody(input.body),
      visibility: input.visibility ?? Audience.PUBLIC,
      kennelId: input.kennelId ?? null,
      runId: input.runId ?? null,
      status: S.DRAFT,
      ...(input.poll ? { poll: { create: pollCreateData(input.poll) } } : {}),
    },
    select: postSelect,
  });
  return serializeOne(post, actor.id);
}

export async function updateDraft(actor: Actor, postId: string, input: PostInput) {
  const post = await findPost(postId);
  if (post.authorId !== actor.id) throw ApiError.forbidden('Only the author edits their post.', 'NOT_THE_AUTHOR');
  if (post.status === S.REMOVED) throw ApiError.badRequest('That post was taken down.', 'POST_REMOVED');

  const body = input.body === undefined ? undefined : cleanBody(input.body);
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.post.update({
      where: { id: post.id },
      data: {
        ...(body === undefined ? {} : { body }),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        // Editing after publication is marked; editing a draft is just writing.
        ...(body !== undefined && post.status === S.PUBLISHED ? { editedAt: new Date() } : {}),
      },
      select: postSelect,
    });
    // A draft is indexed when it publishes. A published post is indexed again
    // when its words change, and only the people newly named are told (D59).
    if (body !== undefined && post.status === S.PUBLISHED) {
      await syncEntities(tx, {
        subject: { type: SubjectType.POST, id: post.id },
        authorId: actor.id,
        text: body,
      });
    }
    return row;
  });
  if (body !== undefined && post.status === S.PUBLISHED) attachPreview(post.id, body);
  return serializeOne(updated, actor.id);
}

// Words or a photo — one of them has to be there, or there is nothing to read.
export async function publish(actor: Actor, postId: string) {
  const post = await findPost(postId);
  if (post.authorId !== actor.id) throw ApiError.forbidden('Only the author posts their post.', 'NOT_THE_AUTHOR');
  if (post.status === S.PUBLISHED) return serializeOne(post, actor.id);
  if (post.status !== S.DRAFT) throw ApiError.badRequest('That post is no longer a draft.', 'POST_NOT_DRAFT');

  const photos = (await photosFor([post.id])).get(post.id) ?? [];
  if (!post.body.trim() && photos.length === 0) {
    throw ApiError.badRequest('Say something, or add a photo.', 'POST_EMPTY');
  }

  const published = await prisma.$transaction(async (tx) => {
    const row = await tx.post.update({
      where: { id: post.id },
      data: { status: S.PUBLISHED, publishedAt: new Date() },
      select: postSelect,
    });
    await recordEvent(tx, {
      eventType: 'PostPublished',
      aggregateType: 'Post',
      aggregateId: post.id,
      actorId: actor.id,
      payload: { kennelId: post.kennelId, runId: post.runId, photoCount: photos.length },
    });
    // A poll's clock starts now, not when the draft was begun (D60).
    await startClock(tx, post.id);
    // The tags go under it and the people it names are told, in the same
    // transaction, so a post is never public with its tags missing (D59).
    await syncEntities(tx, {
      subject: { type: SubjectType.POST, id: post.id },
      authorId: actor.id,
      text: post.body,
    });
    return row;
  });
  // The link's card is fetched after the post is up, not before: a slow site must
  // not hold up posting (D60).
  attachPreview(post.id, post.body);
  return serializeOne(published, actor.id);
}

// ─── Ending one ───

// The author takes their own post down. Ch.22: archived, never deleted.
export async function archive(actor: Actor, postId: string) {
  const post = await findPost(postId);
  if (post.authorId !== actor.id) throw ApiError.forbidden('Only the author archives their post.', 'NOT_THE_AUTHOR');
  if (post.status === S.ARCHIVED) return serializeOne(post, actor.id);

  const archived = await prisma.$transaction(async (tx) => {
    const row = await tx.post.update({
      where: { id: post.id },
      data: { status: S.ARCHIVED, archivedAt: new Date() },
      select: postSelect,
    });
    await recordEvent(tx, {
      eventType: 'PostArchived',
      aggregateType: 'Post',
      aggregateId: post.id,
      actorId: actor.id,
      payload: { kennelId: post.kennelId },
    });
    return row;
  });
  return serializeOne(archived, actor.id);
}

// A moderator takes it down: the kennel's media moderators for a post made to
// their kennel, platform staff for one made to no kennel — the division reels
// already use.
export async function remove(actor: Actor, postId: string, reason: string) {
  const post = await findPost(postId);
  if (post.kennelId) {
    await assertKennelPermission(actor, post.kennelId, 'media.moderate');
  } else if (actor.role !== 'ADMIN') {
    throw ApiError.forbidden('Only platform staff take down a post made outside a kennel.', 'PLATFORM_ONLY');
  }

  const removed = await prisma.$transaction(async (tx) => {
    const row = await tx.post.update({
      where: { id: post.id },
      data: { status: S.REMOVED, removedAt: new Date(), removedById: actor.id, removedReason: reason },
      select: postSelect,
    });
    const event = await recordEvent(tx, {
      eventType: 'PostRemoved',
      aggregateType: 'Post',
      aggregateId: post.id,
      actorId: actor.id,
      payload: { kennelId: post.kennelId, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'post.remove',
      resourceType: 'Post',
      resourceId: post.id,
      kennelId: post.kennelId,
      previousState: { status: post.status, body: post.body },
      newState: { status: S.REMOVED },
      reason,
      policyRef: post.kennelId ? 'media.moderate' : 'platform-admin',
      domainEventId: event.id,
    });
    return row;
  });
  return serializeOne(removed, actor.id);
}

// ─── Reads ───

// Published posts, newest first. A post is as visible as its author's profile
// (D57), so the page is filtered to the authors this viewer may read.
export async function listPublished(
  actor: Actor | undefined,
  opts: { page: number; limit: number; kennelSlug?: string; authorId?: string; tag?: string; runId?: string },
) {
  // Posts about one run (D60). Anybody who may not see the run is told there is
  // no such run, the same as everywhere else it is looked up.
  if (opts.runId) {
    const access = await getAccess(actor, opts.runId);
    if (!canView(access)) throw ApiError.notFound('Run not found');
  }
  const where: Prisma.PostWhereInput = {
    status: S.PUBLISHED,
    ...(opts.kennelSlug ? { kennel: { slug: opts.kennelSlug } } : {}),
    ...(opts.authorId ? { authorId: opts.authorId } : {}),
    ...(opts.runId ? { runId: opts.runId } : {}),
    // A hashtag page (D59): only what carries the tag. Everything below still
    // decides who may see each one, so a tag opens no door.
    ...(opts.tag ? { id: { in: await taggedIds(SubjectType.POST, opts.tag) } } : {}),
  };

  // Who this viewer may read, decided up front so the query pages over exactly
  // those authors and the total agrees with the items.
  const candidates = await prisma.post.findMany({ where, distinct: ['authorId'], select: { authorId: true } });
  const readable = await contentVisibleAuthors(actor, candidates.map((c) => c.authorId));
  // Muted hashers leave the lists (D60), but not their own page: asking for one
  // hasher's posts is a deliberate visit.
  if (!opts.authorId) for (const id of (await hiddenFor(actor?.id)).muted) readable.delete(id);
  const followed = await activeFollowSet(actor?.id, [...readable]);
  // The profile lets this viewer in, and then each post's own audience decides:
  // public to all of them, followers' posts to the ones they follow, and a
  // viewer's own posts to themself whatever they say.
  const readableWhere: Prisma.PostWhereInput = {
    AND: [
      where,
      {
        OR: [
          ...(actor ? [{ authorId: actor.id }] : []),
          { authorId: { in: [...readable] }, visibility: Audience.PUBLIC },
          { authorId: { in: [...readable].filter((id) => followed.has(id)) }, visibility: Audience.FOLLOWERS },
        ],
      },
    ],
  };

  const [rows, total] = await prisma.$transaction([
    prisma.post.findMany({
      where: readableWhere,
      select: postSelect,
      orderBy: { publishedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.post.count({ where: readableWhere }),
  ]);

  const [photos, engagement, polls] = await Promise.all([
    photosFor(rows.map((r) => r.id)),
    stats.engagementFor(
      actor?.id,
      rows.map((r) => ({ type: SubjectType.POST, id: r.id })),
    ),
    pollsFor(actor?.id, new Map(rows.map((r) => [r.id, r.authorId]))),
  ]);

  const items = rows.map((row) =>
    serialize(
      row,
      actor?.id,
      photos.get(row.id) ?? [],
      engagement.get(stats.subjectKey(SubjectType.POST, row.id)) ?? stats.EMPTY,
      polls.get(row.id) ?? null,
    ),
  );
  return page(items, total, opts.page, opts.limit);
}

export async function detail(actor: Actor | undefined, postId: string) {
  const post = await findPost(postId);
  const own = actor?.id === post.authorId;
  // A draft is the author's alone; a removed post is nobody's.
  if (post.status === S.REMOVED) throw ApiError.notFound('Post not found');
  if (post.status !== S.PUBLISHED && !own) throw ApiError.notFound('Post not found');
  if (!own && !(await canSeeAudience(actor, post.authorId, post.visibility))) throw ApiError.notFound('Post not found');
  return serializeOne(post, actor?.id);
}
