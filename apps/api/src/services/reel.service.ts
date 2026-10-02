import {
  Audience,
  MediaTargetType,
  SubjectType,
  ModerationState,
  Prisma,
  ReelStatus,
  UploadState,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { activeFollowSet, audienceAllows, contentVisibleAuthors } from './audience.service';
import * as follows from './follow.service';
import { type Actor, assertKennelPermission, resolveKennelContext } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { canView, getAccess, publicName, userPublicSelect } from './run.service';
import * as stats from './stats.service';

// Reels (D41): a hasher's own short video. At a run, at a meeting, at the
// Circle, or holding a beer at home — the context is optional, which is the
// whole point. Everything else on HCP belongs to a kennel or a run; this
// belongs to the hasher who shot it.
//
// The video itself is an ordinary MediaAsset, uploaded the way every other file
// is (D28): the reel is created empty, the browser PUTs the video to storage
// against a REEL target, and publishing is a separate step so a half-uploaded
// reel never appears in anybody's rail.

const S = ReelStatus;

export interface ReelInput {
  caption?: string | null;
  kennelId?: string | null;
  runId?: string | null;
  eventId?: string | null;
  visibility?: Audience;
}

const reelSelect = {
  id: true,
  caption: true,
  status: true,
  visibility: true,
  publishedAt: true,
  createdAt: true,
  viewCount: true,
  // The picture is public identity like the handle (D11), so the rail can show a face.
  author: { select: { ...userPublicSelect, avatarUrl: true } },
  kennel: { select: { id: true, slug: true, shortName: true, primaryColor: true } },
  run: { select: { id: true, runNumber: true, title: true, kennelId: true } },
  event: { select: { id: true, slug: true, title: true } },
  media: {
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      mimeType: true,
      durationSec: true,
      width: true,
      height: true,
      uploadState: true,
      moderationState: true,
    },
  },
} satisfies Prisma.ReelSelect;

type ReelRow = Prisma.ReelGetPayload<{ select: typeof reelSelect }>;

// What a reel is made of (D48). One post, several things in it — videos,
// photos, or both, in the order they were added, the way every other feed on a
// phone works. The order is MediaLink.createdAt because that is the order the
// hasher picked them; an explicit position column is the thing to add when
// reordering after the fact becomes a feature.
export interface ReelItem {
  id: string;
  kind: 'PHOTO' | 'VIDEO';
  url: string;
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

async function itemsFor(reelIds: string[]) {
  const byReel = new Map<string, ReelItem[]>();
  if (reelIds.length === 0) return byReel;

  const links = await prisma.mediaLink.findMany({
    where: { targetType: MediaTargetType.REEL, targetId: { in: reelIds } },
    orderBy: { createdAt: 'asc' },
    select: {
      targetId: true,
      media: {
        select: {
          id: true,
          kind: true,
          url: true,
          thumbnailUrl: true,
          mimeType: true,
          width: true,
          height: true,
          durationSec: true,
          uploadState: true,
          moderationState: true,
        },
      },
    },
  });

  for (const link of links) {
    const media = link.media;
    // A half-uploaded or rejected item is simply not in the post.
    if (media.uploadState !== UploadState.AVAILABLE) continue;
    if (media.moderationState === ModerationState.REJECTED) continue;
    if (!media.url) continue;
    if (media.kind !== 'PHOTO' && media.kind !== 'VIDEO') continue;

    const list = byReel.get(link.targetId) ?? [];
    list.push({
      id: media.id,
      kind: media.kind,
      url: media.url,
      posterUrl: media.thumbnailUrl,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      durationSec: media.durationSec,
    });
    byReel.set(link.targetId, list);
  }
  return byReel;
}

function serialize(
  reel: ReelRow,
  viewerId?: string,
  items: ReelItem[] = [],
  engagement: stats.Engagement = stats.EMPTY,
) {
  return {
    id: reel.id,
    caption: reel.caption,
    status: reel.status,
    visibility: reel.visibility,
    publishedAt: reel.publishedAt,
    createdAt: reel.createdAt,
    // Unique signed-in viewers plus anonymous opens (D50). `Reel.viewCount` is
    // still written as a mirror so nothing that reads the column breaks, but
    // this is the number, and it is the deduped one.
    viewCount: engagement.views,
    // Likes, comments, reshares, bookmarks and what this viewer has done (D50).
    engagement,
    // Public identity only (D11), and the picture they chose.
    author: {
      id: reel.author.id,
      name: publicName(reel.author),
      avatarUrl: reel.author.avatarUrl,
    },
    // Where it was shot, when the hasher said. Null is normal.
    kennel: reel.kennel,
    run: reel.run ? { id: reel.run.id, runNumber: reel.run.runNumber, title: reel.run.title } : null,
    event: reel.event,
    // Everything in the post, in order. The first is the cover.
    items,
    itemCount: items.length,
    isMine: viewerId ? reel.author.id === viewerId : false,
  };
}

export type SerializedReel = ReturnType<typeof serialize>;

// One reel, with its items and its numbers. Every single-reel return goes
// through here so the two extra reads are in one place rather than ten.
async function serializeOne(reel: ReelRow & { authorId: string }, viewerId?: string) {
  const [items, engagement] = await Promise.all([
    itemsFor([reel.id]),
    stats.engagementOne(viewerId, SubjectType.REEL, reel.id),
  ]);
  return serialize(reel, viewerId, items.get(reel.id) ?? [], engagement);
}

// ─── Who may see a reel ───

type Visible = { visibility: Audience; kennelId: string | null; runId: string | null; authorId: string };

// A reel carries its own audience (D57): everybody, the people the author has
// let follow them, or only the author. It can narrow what the author's profile
// allows but never widen it: a reel marked public on a locked profile is still
// for that profile's followers. And it can never open a door the thing it was
// shot at keeps shut: a reel of a members-only run stays with that run's
// members, whatever the reel says.
export async function canSee(actor: Actor | undefined, reel: Visible) {
  if (actor && actor.id === reel.authorId) return true;
  const [profile, followed] = await Promise.all([
    contentVisibleAuthors(actor, [reel.authorId]),
    activeFollowSet(actor?.id, [reel.authorId]),
  ]);
  return canSeeWith(actor, reel, profile, followed);
}

// The same decision for a whole page, given the answers for its authors in one
// pair of queries rather than one pair per reel.
async function canSeeWith(actor: Actor | undefined, reel: Visible, profile: Set<string>, followed: Set<string>) {
  if (actor && actor.id === reel.authorId) return true;
  if (!profile.has(reel.authorId)) return false;
  if (!audienceAllows(reel.visibility, { isSelf: false, follows: followed.has(reel.authorId) })) return false;

  if (reel.runId) {
    const access = await getAccess(actor, reel.runId);
    if (!canView(access)) return false;
  }
  return true;
}

async function findReel(id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Reel not found');
  const reel = await prisma.reel.findUnique({
    where: { id },
    select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
  });
  if (!reel) throw ApiError.notFound('Reel not found');
  return reel;
}

// ─── Posting ───

export async function createDraft(actor: Actor, input: ReelInput) {
  // Context is optional, but a context that is claimed has to be real and the
  // hasher has to be entitled to it.
  if (input.kennelId) {
    const kennel = await prisma.kennel.findUnique({ where: { id: input.kennelId }, select: { id: true } });
    if (!kennel) throw ApiError.notFound('Kennel not found');
    const context = await resolveKennelContext(actor, input.kennelId);
    if (!context.isMember) throw ApiError.forbidden('Only members post a reel to a kennel.', 'MEMBERS_ONLY');
  }
  if (input.runId) {
    const access = await getAccess(actor, input.runId);
    if (!canView(access)) throw ApiError.notFound('Run not found');
  }
  const reel = await prisma.reel.create({
    data: {
      authorId: actor.id,
      caption: input.caption?.trim() || null,
      kennelId: input.kennelId ?? null,
      // A run already belongs to a kennel; keep them consistent rather than
      // letting a reel claim one kennel and a run from another.
      runId: input.runId ?? null,
      eventId: input.eventId ?? null,
      visibility: input.visibility ?? Audience.PUBLIC,
      status: S.DRAFT,
    },
    select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
  });

  return serializeOne(reel, actor.id);
}

// The video has landed; the reel goes up. Kept separate from the upload so a
// failed or abandoned upload leaves a draft nobody sees rather than an empty
// reel in everyone's rail.
export async function publish(actor: Actor, reelId: string) {
  const reel = await findReel(reelId);
  if (reel.authorId !== actor.id) throw ApiError.forbidden('Only the author publishes their reel.', 'NOT_THE_AUTHOR');
  if (reel.status === S.PUBLISHED) return serializeOne(reel, actor.id);
  if (reel.status !== S.DRAFT) throw ApiError.badRequest('That reel is no longer a draft.', 'REEL_NOT_DRAFT');

  // Whatever was uploaded against this reel, newest first.
  // Everything uploaded against this reel, oldest first: the first one added
  // is the cover, the way it is in every other feed.
  const links = await prisma.mediaLink.findMany({
    where: { targetType: MediaTargetType.REEL, targetId: reel.id },
    orderBy: { createdAt: 'asc' },
    select: { media: { select: { id: true, uploadState: true, kind: true } } },
  });
  if (links.length === 0) throw ApiError.badRequest('Add a video or a photo before posting.', 'REEL_HAS_NO_VIDEO');
  const ready = links.filter((l) => l.media.uploadState === UploadState.AVAILABLE);
  if (ready.length === 0) {
    throw ApiError.badRequest('Nothing has finished uploading yet.', 'REEL_VIDEO_NOT_READY');
  }
  const cover = ready[0];

  const now = new Date();
  const published = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.update({
      where: { id: reel.id },
      data: { status: S.PUBLISHED, publishedAt: now, mediaId: cover.media.id },
      select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'ReelPosted',
      aggregateType: 'Reel',
      aggregateId: reel.id,
      actorId: actor.id,
      payload: {
        kennelId: reel.kennelId,
        runId: reel.runId,
        visibility: row.visibility,
        mediaId: cover.media.id,
        itemCount: ready.length,
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'reel.publish',
      resourceType: 'Reel',
      resourceId: reel.id,
      kennelId: reel.kennelId,
      previousState: { status: S.DRAFT },
      newState: { status: S.PUBLISHED },
      domainEventId: event.id,
    });
    return row;
  });

  return serializeOne(published, actor.id);
}

export async function updateDraft(actor: Actor, reelId: string, input: ReelInput) {
  const reel = await findReel(reelId);
  if (reel.authorId !== actor.id) throw ApiError.forbidden('Only the author edits their reel.', 'NOT_THE_AUTHOR');
  if (reel.status === S.REMOVED) throw ApiError.badRequest('That reel was taken down.', 'REEL_REMOVED');

  const updated = await prisma.reel.update({
    where: { id: reel.id },
    data: {
      ...(input.caption !== undefined ? { caption: input.caption?.trim() || null } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
    select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
  });
  return serializeOne(updated, actor.id);
}

// ─── Ending one ───

// The author takes their own reel down. Ch.22: it is archived, never deleted.
export async function archive(actor: Actor, reelId: string) {
  const reel = await findReel(reelId);
  if (reel.authorId !== actor.id) throw ApiError.forbidden('Only the author archives their reel.', 'NOT_THE_AUTHOR');
  if (reel.status === S.ARCHIVED) return serializeOne(reel, actor.id);

  const now = new Date();
  const archived = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.update({
      where: { id: reel.id },
      data: { status: S.ARCHIVED, archivedAt: now },
      select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'ReelArchived',
      aggregateType: 'Reel',
      aggregateId: reel.id,
      actorId: actor.id,
      payload: { kennelId: reel.kennelId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'reel.archive',
      resourceType: 'Reel',
      resourceId: reel.id,
      kennelId: reel.kennelId,
      previousState: { status: reel.status },
      newState: { status: S.ARCHIVED },
      domainEventId: event.id,
    });
    return row;
  });
  return serializeOne(archived, actor.id);
}

// A moderator takes it down (BR-RUN-012 applied to reels): a kennel's media
// moderators for a reel posted to their kennel, platform admins anywhere.
export async function remove(actor: Actor, reelId: string, reason: string) {
  const reel = await findReel(reelId);
  if (reel.kennelId) {
    await assertKennelPermission(actor, reel.kennelId, 'media.moderate');
  } else if (actor.role !== 'ADMIN') {
    throw ApiError.forbidden('Only platform staff take down a reel posted outside a kennel.', 'PLATFORM_ONLY');
  }

  const now = new Date();
  const removed = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.update({
      where: { id: reel.id },
      data: { status: S.REMOVED, removedAt: now, removedById: actor.id, removedReason: reason },
      select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'ReelRemoved',
      aggregateType: 'Reel',
      aggregateId: reel.id,
      actorId: actor.id,
      payload: { kennelId: reel.kennelId, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'reel.remove',
      resourceType: 'Reel',
      resourceId: reel.id,
      kennelId: reel.kennelId,
      previousState: { status: reel.status },
      newState: { status: S.REMOVED },
      reason,
      policyRef: 'media.moderate',
      domainEventId: event.id,
    });
    return row;
  });
  return serializeOne(removed, actor.id);
}

// ─── Reads ───

// The rail on the home page and /reels (D57).
//
// Signed in, it is the reels of the hasher you follow and your own, and nothing
// else: following is how a reel reaches you. Signed out there is nobody followed,
// so the rail is the public reels. Either way a reel is shown only when its own
// audience and its author's profile both allow this viewer, newest first.
//
// This is also where a platform-approved reel will join the rail when there are
// any (an advertisement or a sponsored reel is not somebody's reel, so it will
// be its own source merged in here, not a Reel row pretending to have an author).
//
// A profile page (`authorId`) and a kennel page (`kennelSlug`) are not the rail:
// they list what they are about, narrowed by the same visibility rules.
//
// Over-fetch and filter, the same shape listPublished uses for trail reports —
// reels are few enough that this stays cheap.
export async function listPublished(
  actor: Actor | undefined,
  opts: { page: number; limit: number; kennelSlug?: string; authorId?: string },
) {
  const isRail = !opts.authorId && !opts.kennelSlug;
  const railAuthors =
    actor && isRail ? [actor.id, ...(await follows.followedBy(actor.id)).userIds] : null;

  const where: Prisma.ReelWhereInput = {
    status: S.PUBLISHED,
    media: { uploadState: UploadState.AVAILABLE, moderationState: { not: ModerationState.REJECTED } },
    ...(opts.kennelSlug ? { kennel: { slug: opts.kennelSlug } } : {}),
    ...(opts.authorId ? { authorId: opts.authorId } : {}),
    ...(railAuthors ? { authorId: { in: railAuthors } } : {}),
    // Nobody signed out can be a follower or the author, so only a public reel
    // can reach them; cheaper to say so in the query than to fetch and drop.
    ...(actor ? {} : { visibility: Audience.PUBLIC }),
  };

  const rows = await prisma.reel.findMany({
    where,
    select: { ...reelSelect, authorId: true, kennelId: true, runId: true },
    orderBy: { publishedAt: 'desc' },
    skip: (opts.page - 1) * opts.limit,
    take: opts.limit,
  });

  const [items, engagement] = await Promise.all([
    itemsFor(rows.map((r) => r.id)),
    // One read for the whole rail's numbers, not one per reel.
    stats.engagementFor(
      actor?.id,
      rows.map((r) => ({ type: SubjectType.REEL, id: r.id })),
    ),
  ]);
  const visible: SerializedReel[] = [];
  const authors = rows.map((r) => r.authorId);
  const [profile, followed] = await Promise.all([
    contentVisibleAuthors(actor, authors),
    activeFollowSet(actor?.id, authors),
  ]);
  for (const row of rows) {
    // A reel whose media is gone is not a reel anybody can watch.
    const own = items.get(row.id) ?? [];
    if (own.length === 0) continue;
    if (await canSeeWith(actor, row, profile, followed)) {
      visible.push(
        serialize(row, actor?.id, own, engagement.get(stats.subjectKey(SubjectType.REEL, row.id)) ?? stats.EMPTY),
      );
    }
  }
  const total = await prisma.reel.count({ where });
  return page(visible, total, opts.page, opts.limit);
}

export async function detail(actor: Actor | undefined, reelId: string) {
  const reel = await findReel(reelId);
  const own = actor?.id === reel.authorId;
  if (reel.status === S.REMOVED && !own) throw ApiError.notFound('Reel not found');
  if (reel.status === S.DRAFT && !own) throw ApiError.notFound('Reel not found');
  if (!(await canSee(actor, reel))) throw ApiError.notFound('Reel not found');
  return serializeOne(reel, actor?.id);
}

// The legacy mirror. Views are counted per viewer in ContentView now (D50) and
// the reel's own endpoint goes through `engagement.countView`; this keeps the
// column moving for anything still reading it, and is not the number the API
// reports.
export async function mirrorViewCount(reelId: string) {
  if (!isUuid(reelId)) return;
  await prisma.reel.updateMany({ where: { id: reelId, status: S.PUBLISHED }, data: { viewCount: { increment: 1 } } });
}
