import { CommentStatus, Prisma, ReactionKind, SubjectType } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { type Actor, assertKennelPermission, resolveKennelContext } from './permission.service';
import { listHiddenIds } from './block.service';
import { syncEntities } from './entity.service';
import { recordAudit, recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';
import * as stats from './stats.service';
import {
  type SubjectContext,
  isPubliclyVisible,
  resolveSubject,
  resolveVisible,
  segmentFor,
} from './subject.service';

// Likes, comments, reshares, bookmarks and views (D50).
//
// Every act here goes through `resolveSubject` first, so this file never
// decides who may see anything — it only decides what a person may do to
// something they can already see.
//
// The toggles (like, bookmark, reshare) are idempotent: one row per (person,
// subject), re-activated rather than duplicated. Pressing like twice is one
// like, and pressing it from two devices at once is still one like, because the
// unique index says so.

const MAX_COMMENT = 2000;

// ─── Counters ───

// A like is not a governance decision, but it is a state change, and Ch.24 says
// a state change writes an event in the same transaction. These are low-value
// events that nothing is obliged to consume; they exist so a timeline can be
// reconstructed and so notification fan-out has something to read.
async function noteLike(
  tx: Prisma.TransactionClient,
  actor: Actor,
  subject: SubjectContext,
  eventType: 'ContentLiked' | 'ContentUnliked',
  reaction: ReactionKind = ReactionKind.ON_ON,
) {
  return recordEvent(tx, {
    eventType,
    aggregateType: subject.type,
    aggregateId: subject.id,
    actorId: actor.id,
    payload: { subjectType: subject.type, authorId: subject.authorId, kennelId: subject.kennelId, reaction },
  });
}

// ─── Like ───

export async function like(actor: Actor, type: SubjectType, id: string, reaction: ReactionKind = ReactionKind.ON_ON) {
  const subject = await resolveSubject(actor, type, id);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.contentLike.findUnique({
      where: { userId_subjectType_subjectId: { userId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, unlikedAt: true, reaction: true },
    });
    // Already liked: say so and change nothing, rather than double-counting.
    // A different reaction on a standing like swaps it (D60): the number of
    // likes is the same, and nobody is told a second time.
    if (existing && !existing.unlikedAt) {
      if (existing.reaction === reaction) return { changed: false };
      await tx.contentLike.update({ where: { id: existing.id }, data: { reaction } });
      return { changed: true };
    }

    if (existing) {
      await tx.contentLike.update({
        where: { id: existing.id },
        data: { unlikedAt: null, likedAt: new Date(), reaction },
      });
    } else {
      await tx.contentLike.create({ data: { userId: actor.id, subjectType: type, subjectId: id, reaction } });
    }
    await stats.bump(tx, type, id, 'likeCount', 1);
    await noteLike(tx, actor, subject, 'ContentLiked', reaction);
    return { changed: true };
  });

  return { ...result, engagement: await stats.engagementOne(actor.id, type, id) };
}

export async function unlike(actor: Actor, type: SubjectType, id: string) {
  const subject = await resolveSubject(actor, type, id);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.contentLike.findUnique({
      where: { userId_subjectType_subjectId: { userId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, unlikedAt: true },
    });
    if (!existing || existing.unlikedAt) return { changed: false };

    await tx.contentLike.update({ where: { id: existing.id }, data: { unlikedAt: new Date() } });
    await stats.bump(tx, type, id, 'likeCount', -1);
    await noteLike(tx, actor, subject, 'ContentUnliked');
    return { changed: true };
  });

  return { ...result, engagement: await stats.engagementOne(actor.id, type, id) };
}

// Who liked it. Public identity only (D11) — a like is a public act, but a
// person is still only ever their handle.
export async function listLikes(
  actor: Actor | undefined,
  type: SubjectType,
  id: string,
  opts: { page: number; limit: number },
) {
  await resolveSubject(actor, type, id);
  const where: Prisma.ContentLikeWhereInput = { subjectType: type, subjectId: id, unlikedAt: null };
  const [rows, total] = await prisma.$transaction([
    prisma.contentLike.findMany({
      where,
      orderBy: { likedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { likedAt: true, user: { select: { ...userPublicSelect, avatarUrl: true } } },
    }),
    prisma.contentLike.count({ where }),
  ]);
  const items = rows.map((row) => ({
    id: row.user.id,
    name: publicName(row.user),
    avatarUrl: row.user.avatarUrl,
    likedAt: row.likedAt,
  }));
  return page(items, total, opts.page, opts.limit);
}

// ─── Bookmark ───

// Private, always. A bookmark never notifies the author and never appears in
// anybody else's count of anything they can act on — the `bookmarkCount` on
// ContentStats is for the owner's own "saved 12 times" nowhere, kept only so a
// future "most saved" ranking does not need a backfill.
export async function bookmark(actor: Actor, type: SubjectType, id: string, note?: string | null) {
  await resolveSubject(actor, type, id);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.contentBookmark.findUnique({
      where: { userId_subjectType_subjectId: { userId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, removedAt: true },
    });
    const trimmed = note?.trim() || null;
    if (existing && !existing.removedAt) {
      // Re-bookmarking is how the note is edited.
      await tx.contentBookmark.update({ where: { id: existing.id }, data: { note: trimmed } });
      return;
    }
    if (existing) {
      await tx.contentBookmark.update({
        where: { id: existing.id },
        data: { removedAt: null, note: trimmed, createdAt: new Date() },
      });
    } else {
      await tx.contentBookmark.create({ data: { userId: actor.id, subjectType: type, subjectId: id, note: trimmed } });
    }
    await stats.bump(tx, type, id, 'bookmarkCount', 1);
  });

  return { engagement: await stats.engagementOne(actor.id, type, id) };
}

export async function unbookmark(actor: Actor, type: SubjectType, id: string) {
  // No `resolveSubject` here: unsaving something must keep working after the
  // thing has gone private, or a hasher is stuck with a bookmark they cannot
  // reach and cannot remove.
  if (!isUuid(id)) throw ApiError.notFound('Not found');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.contentBookmark.findUnique({
      where: { userId_subjectType_subjectId: { userId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, removedAt: true },
    });
    if (!existing || existing.removedAt) return;
    await tx.contentBookmark.update({ where: { id: existing.id }, data: { removedAt: new Date() } });
    await stats.bump(tx, type, id, 'bookmarkCount', -1);
  });

  return { engagement: await stats.engagementOne(actor.id, type, id) };
}

// The hasher's own saved things, newest first, with whatever is still visible
// to them resolved into a card.
export async function listBookmarks(actor: Actor, opts: { page: number; limit: number; type?: SubjectType }) {
  const where: Prisma.ContentBookmarkWhereInput = {
    userId: actor.id,
    removedAt: null,
    ...(opts.type ? { subjectType: opts.type } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.contentBookmark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { id: true, subjectType: true, subjectId: true, note: true, createdAt: true },
    }),
    prisma.contentBookmark.count({ where }),
  ]);

  const resolved = await resolveVisible(
    actor,
    rows.map((r) => ({ type: r.subjectType, id: r.subjectId })),
  );

  const items = rows.map((row) => {
    const subject = resolved.get(`${row.subjectType}:${row.subjectId}`);
    return {
      id: row.id,
      subjectType: row.subjectType,
      subjectSegment: segmentFor(row.subjectType),
      subjectId: row.subjectId,
      note: row.note,
      savedAt: row.createdAt,
      // A bookmark whose subject has gone private or been taken down still
      // lists, so the hasher can see it and unsave it, but says nothing about
      // what it was.
      available: Boolean(subject),
      label: subject?.label ?? null,
      href: subject?.href ?? null,
    };
  });
  return page(items, total, opts.page, opts.limit);
}

// ─── Reshare ───

// A quote reshare: the sharer's own entry in the feed, pointing at somebody
// else's. It carries no visibility of its own — whoever may see the original
// may see the reshare, and nobody else, which is the reel rule (D41) applied to
// a wrapper.
export async function reshare(actor: Actor, type: SubjectType, id: string, commentary?: string | null) {
  const subject = await resolveSubject(actor, type, id);
  if (subject.authorId === actor.id) {
    throw ApiError.badRequest('That is already yours to post.', 'CANNOT_RESHARE_OWN');
  }

  const trimmed = commentary?.trim() || null;
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.contentReshare.findUnique({
      where: { sharerId_subjectType_subjectId: { sharerId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, undoneAt: true },
    });

    if (existing && !existing.undoneAt) {
      // Resharing again edits the commentary rather than making a second entry.
      const row = await tx.contentReshare.update({ where: { id: existing.id }, data: { commentary: trimmed } });
      return { reshareId: row.id, changed: false };
    }

    const row = existing
      ? await tx.contentReshare.update({
          where: { id: existing.id },
          data: { undoneAt: null, commentary: trimmed, createdAt: new Date() },
        })
      : await tx.contentReshare.create({
          data: { sharerId: actor.id, subjectType: type, subjectId: id, commentary: trimmed },
        });

    await stats.bump(tx, type, id, 'reshareCount', 1);
    await recordEvent(tx, {
      eventType: 'ContentReshared',
      aggregateType: subject.type,
      aggregateId: subject.id,
      actorId: actor.id,
      payload: {
        reshareId: row.id,
        subjectType: subject.type,
        authorId: subject.authorId,
        kennelId: subject.kennelId,
        hasCommentary: Boolean(trimmed),
      },
    });
    return { reshareId: row.id, changed: true };
  });

  return { ...result, engagement: await stats.engagementOne(actor.id, type, id) };
}

export async function unreshare(actor: Actor, type: SubjectType, id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Not found');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.contentReshare.findUnique({
      where: { sharerId_subjectType_subjectId: { sharerId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true, undoneAt: true },
    });
    if (!existing || existing.undoneAt) return;
    await tx.contentReshare.update({ where: { id: existing.id }, data: { undoneAt: new Date() } });
    await stats.bump(tx, type, id, 'reshareCount', -1);
    await recordEvent(tx, {
      eventType: 'ContentReshareWithdrawn',
      aggregateType: type,
      aggregateId: id,
      actorId: actor.id,
      payload: { reshareId: existing.id, subjectType: type },
    });
  });

  return { engagement: await stats.engagementOne(actor.id, type, id) };
}

export async function listReshares(
  actor: Actor | undefined,
  type: SubjectType,
  id: string,
  opts: { page: number; limit: number },
) {
  await resolveSubject(actor, type, id);
  const where: Prisma.ContentReshareWhereInput = { subjectType: type, subjectId: id, undoneAt: null };
  const [rows, total] = await prisma.$transaction([
    prisma.contentReshare.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        commentary: true,
        createdAt: true,
        sharer: { select: { ...userPublicSelect, avatarUrl: true } },
      },
    }),
    prisma.contentReshare.count({ where }),
  ]);
  const items = rows.map((row) => ({
    id: row.id,
    commentary: row.commentary,
    sharedAt: row.createdAt,
    sharer: { id: row.sharer.id, name: publicName(row.sharer), avatarUrl: row.sharer.avatarUrl },
  }));
  return page(items, total, opts.page, opts.limit);
}

// ─── Comments ───

const commentSelect = {
  id: true,
  subjectType: true,
  subjectId: true,
  parentId: true,
  body: true,
  status: true,
  editedAt: true,
  replyCount: true,
  createdAt: true,
  authorId: true,
  author: { select: { ...userPublicSelect, avatarUrl: true } },
} satisfies Prisma.ContentCommentSelect;

type CommentRow = Prisma.ContentCommentGetPayload<{ select: typeof commentSelect }>;

// A withdrawn or removed comment keeps its place in the thread — the replies
// under it would be orphaned otherwise — but says nothing. History is
// append-only; the row is never deleted.
function serializeComment(row: CommentRow, viewerId: string | undefined, engagement: stats.Engagement) {
  const gone = row.status !== CommentStatus.VISIBLE;
  return {
    id: row.id,
    parentId: row.parentId,
    body: gone ? null : row.body,
    status: row.status,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    replyCount: row.replyCount,
    author: gone
      ? null
      : { id: row.author.id, name: publicName(row.author), avatarUrl: row.author.avatarUrl },
    likes: engagement.likes,
    liked: engagement.liked,
    isMine: viewerId ? row.authorId === viewerId : false,
  };
}

export type SerializedComment = ReturnType<typeof serializeComment>;

async function serializeThread(rows: CommentRow[], viewerId: string | undefined) {
  const engagement = await stats.engagementFor(
    viewerId,
    rows.map((r) => ({ type: SubjectType.COMMENT, id: r.id })),
  );
  return rows.map((row) =>
    serializeComment(row, viewerId, engagement.get(stats.subjectKey(SubjectType.COMMENT, row.id)) ?? stats.EMPTY),
  );
}

// Top-level comments with their first few replies, which is what a thread looks
// like before anybody presses "more".
const REPLY_PREVIEW = 3;

export async function listComments(
  actor: Actor | undefined,
  type: SubjectType,
  id: string,
  opts: { page: number; limit: number },
) {
  await resolveSubject(actor, type, id);

  // Comments by hashers this reader blocked or muted are not shown to them (D60).
  const hiddenIds = [...(await listHiddenIds(actor?.id))];
  const where: Prisma.ContentCommentWhereInput = {
    subjectType: type,
    subjectId: id,
    parentId: null,
    ...(hiddenIds.length ? { authorId: { notIn: hiddenIds } } : {}),
  };
  const [roots, total] = await prisma.$transaction([
    prisma.contentComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: commentSelect,
    }),
    prisma.contentComment.count({ where }),
  ]);

  // One query for every preview, not one per root.
  const replies = roots.length
    ? await prisma.contentComment.findMany({
        where: { parentId: { in: roots.map((r) => r.id) } },
        orderBy: { createdAt: 'asc' },
        select: commentSelect,
      })
    : [];

  const serialized = await serializeThread([...roots, ...replies], actor?.id);
  const byId = new Map(serialized.map((c) => [c.id, c]));

  const items = roots.map((root) => ({
    ...byId.get(root.id)!,
    replies: replies
      .filter((r) => r.parentId === root.id)
      .slice(0, REPLY_PREVIEW)
      .map((r) => byId.get(r.id)!),
  }));

  return page(items, total, opts.page, opts.limit);
}

export async function listReplies(actor: Actor | undefined, commentId: string, opts: { page: number; limit: number }) {
  // Resolving the comment resolves what it is about, so a reply thread under a
  // members-only run is as private as the run.
  await resolveSubject(actor, SubjectType.COMMENT, commentId);
  const hiddenIds = [...(await listHiddenIds(actor?.id))];
  const where: Prisma.ContentCommentWhereInput = {
    parentId: commentId,
    ...(hiddenIds.length ? { authorId: { notIn: hiddenIds } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.contentComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: commentSelect,
    }),
    prisma.contentComment.count({ where }),
  ]);
  return page(await serializeThread(rows, actor?.id), total, opts.page, opts.limit);
}

export async function addComment(
  actor: Actor,
  type: SubjectType,
  id: string,
  input: { body: string; parentId?: string | null },
) {
  const subject = await resolveSubject(actor, type, id);
  const body = input.body.trim();
  if (!body) throw ApiError.badRequest('Say something.', 'COMMENT_EMPTY');
  if (body.length > MAX_COMMENT) throw ApiError.badRequest('That is too long for a comment.', 'COMMENT_TOO_LONG');

  // One level deep. A reply to a reply attaches to the same root, so a thread
  // is always two levels and can be read without recursion.
  let parentId: string | null = null;
  // Who is already told about this comment, so a mention does not tell them twice:
  // a reply answers its parent's author, a top-level comment is on somebody's thing.
  let alreadyTold: string | null = subject.authorId;
  if (input.parentId) {
    const parent = await prisma.contentComment.findUnique({
      where: { id: input.parentId },
      select: { id: true, parentId: true, subjectType: true, subjectId: true, status: true, authorId: true },
    });
    if (!parent) throw ApiError.notFound('Comment not found');
    if (parent.subjectType !== type || parent.subjectId !== id) {
      throw ApiError.badRequest('That comment is on something else.', 'PARENT_MISMATCH');
    }
    if (parent.status !== CommentStatus.VISIBLE) {
      throw ApiError.badRequest('That comment is gone.', 'PARENT_GONE');
    }
    parentId = parent.parentId ?? parent.id;
    alreadyTold = parent.authorId;
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.contentComment.create({
      data: { subjectType: type, subjectId: id, authorId: actor.id, parentId, body },
      select: commentSelect,
    });
    await stats.bump(tx, type, id, 'commentCount', 1);
    if (parentId) {
      await tx.contentComment.update({ where: { id: parentId }, data: { replyCount: { increment: 1 } } });
    }
    await recordEvent(tx, {
      eventType: 'ContentCommented',
      aggregateType: subject.type,
      aggregateId: subject.id,
      actorId: actor.id,
      payload: {
        commentId: created.id,
        subjectType: subject.type,
        parentId,
        authorId: subject.authorId,
        kennelId: subject.kennelId,
      },
    });
    // Tags and mentions in the comment (D59). A mention opens the thing the
    // comment is on, because a comment has no page of its own.
    await syncEntities(tx, {
      subject: { type: SubjectType.COMMENT, id: created.id },
      home: { type: subject.type, id: subject.id },
      authorId: actor.id,
      text: body,
      alsoNotified: alreadyTold ? [alreadyTold] : [],
    });
    return created;
  });

  return (await serializeThread([row], actor.id))[0];
}

export async function editComment(actor: Actor, commentId: string, body: string) {
  if (!isUuid(commentId)) throw ApiError.notFound('Comment not found');
  const comment = await prisma.contentComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, subjectType: true, subjectId: true },
  });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (comment.authorId !== actor.id) throw ApiError.forbidden('Only the author edits their comment.', 'NOT_THE_AUTHOR');
  if (comment.status !== CommentStatus.VISIBLE) throw ApiError.badRequest('That comment is gone.', 'COMMENT_GONE');

  const trimmed = body.trim();
  if (!trimmed) throw ApiError.badRequest('Say something.', 'COMMENT_EMPTY');
  if (trimmed.length > MAX_COMMENT) throw ApiError.badRequest('That is too long for a comment.', 'COMMENT_TOO_LONG');

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.contentComment.update({
      where: { id: commentId },
      data: { body: trimmed, editedAt: new Date() },
      select: commentSelect,
    });
    // Only whoever the edit newly names is told (D59).
    await syncEntities(tx, {
      subject: { type: SubjectType.COMMENT, id: commentId },
      home: { type: comment.subjectType, id: comment.subjectId },
      authorId: actor.id,
      text: trimmed,
    });
    return updated;
  });
  return (await serializeThread([row], actor.id))[0];
}

// The author withdraws their own comment. The row stays and the thread keeps
// its shape; the words go.
export async function deleteComment(actor: Actor, commentId: string) {
  if (!isUuid(commentId)) throw ApiError.notFound('Comment not found');
  const comment = await prisma.contentComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, subjectType: true, subjectId: true },
  });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (comment.authorId !== actor.id) {
    throw ApiError.forbidden('Only the author withdraws their comment.', 'NOT_THE_AUTHOR');
  }
  if (comment.status !== CommentStatus.VISIBLE) return { changed: false };

  await prisma.$transaction(async (tx) => {
    await tx.contentComment.update({
      where: { id: commentId },
      data: { status: CommentStatus.DELETED, deletedAt: new Date() },
    });
    await stats.bump(tx, comment.subjectType, comment.subjectId, 'commentCount', -1);
    await recordEvent(tx, {
      eventType: 'ContentCommentWithdrawn',
      aggregateType: comment.subjectType,
      aggregateId: comment.subjectId,
      actorId: actor.id,
      payload: { commentId },
    });
  });
  return { changed: true };
}

// A moderator takes a comment down: the kennel's media moderators where the
// subject belongs to a kennel, platform staff everywhere else — the same
// division reels already use.
export async function removeComment(actor: Actor, commentId: string, reason: string) {
  if (!isUuid(commentId)) throw ApiError.notFound('Comment not found');
  const comment = await prisma.contentComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true, subjectType: true, subjectId: true, body: true },
  });
  if (!comment) throw ApiError.notFound('Comment not found');

  const subject = await resolveSubject(actor, comment.subjectType, comment.subjectId);
  if (subject.kennelId) {
    await assertKennelPermission(actor, subject.kennelId, 'media.moderate');
  } else if (actor.role !== 'ADMIN') {
    throw ApiError.forbidden('Only platform staff take down a comment outside a kennel.', 'PLATFORM_ONLY');
  }
  if (comment.status === CommentStatus.REMOVED) return { changed: false };

  const wasVisible = comment.status === CommentStatus.VISIBLE;
  await prisma.$transaction(async (tx) => {
    await tx.contentComment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.REMOVED,
        removedAt: new Date(),
        removedById: actor.id,
        removedReason: reason,
      },
    });
    // A comment the author had already withdrawn is no longer in the count.
    if (wasVisible) await stats.bump(tx, comment.subjectType, comment.subjectId, 'commentCount', -1);
    const event = await recordEvent(tx, {
      eventType: 'ContentCommentRemoved',
      aggregateType: comment.subjectType,
      aggregateId: comment.subjectId,
      actorId: actor.id,
      payload: { commentId, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'comment.remove',
      resourceType: 'ContentComment',
      resourceId: commentId,
      kennelId: subject.kennelId,
      previousState: { status: comment.status, body: comment.body },
      newState: { status: CommentStatus.REMOVED },
      reason,
      policyRef: subject.kennelId ? 'media.moderate' : 'platform-admin',
      domainEventId: event.id,
    });
  });
  return { changed: true };
}

// ─── Views ───

// Counted once per signed-in viewer, with the repeat opens recorded on the same
// row rather than as new ones. Anonymous opens bump a raw tally instead: the
// only way to dedupe them is to fingerprint somebody who has not told us who
// they are, which Ch.13 is against and this platform does not need.
//
// Deliberately not a domain event: a view is a tally, not a decision anybody
// can act on (this is the rule reels already followed).
export async function countView(actor: Actor | undefined, type: SubjectType, id: string) {
  // A view of something you cannot see is not a view.
  await resolveSubject(actor, type, id);

  if (!actor) {
    await prisma.$transaction(async (tx) => {
      await stats.bump(tx, type, id, 'anonViewCount', 1);
    });
    return { counted: true, firstTime: false };
  }

  const firstTime = await prisma.$transaction(async (tx) => {
    const existing = await tx.contentView.findUnique({
      where: { viewerId_subjectType_subjectId: { viewerId: actor.id, subjectType: type, subjectId: id } },
      select: { id: true },
    });
    if (existing) {
      await tx.contentView.update({
        where: { id: existing.id },
        data: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
      });
      return false;
    }
    await tx.contentView.create({ data: { viewerId: actor.id, subjectType: type, subjectId: id } });
    await stats.bump(tx, type, id, 'viewerCount', 1);
    return true;
  });

  return { counted: true, firstTime };
}

// ─── Reads ───

export async function getEngagement(actor: Actor | undefined, type: SubjectType, id: string) {
  const subject = await resolveSubject(actor, type, id);
  const engagement = await stats.engagementOne(actor?.id, type, id);
  // Whether this viewer could take a comment down, so the UI does not offer a
  // button the API would refuse.
  let canModerate = actor?.role === 'ADMIN';
  if (actor && !canModerate && subject.kennelId) {
    const context = await resolveKennelContext(actor, subject.kennelId);
    canModerate = Boolean(context.grants.get('media.moderate'));
  }
  return {
    subject: {
      type,
      id,
      label: subject.label,
      href: subject.href,
      // Whether a link to this works for somebody with no account, so the share
      // dialog can say so before it is sent somewhere public.
      isPublic: await isPubliclyVisible(type, id),
    },
    ...engagement,
    canModerate,
    // You cannot reshare your own post, so the button must not be offered:
    // a UI that shows an action the API will always refuse is a lie.
    isMine: Boolean(actor && subject.authorId === actor.id),
  };
}
