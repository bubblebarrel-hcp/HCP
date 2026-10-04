import { Prisma, ReactionKind, SubjectType } from '@prisma/client';
import prisma from '../config/prisma';

// Engagement counters, read in bulk (D50).
//
// This module deliberately imports no other service. Everything that serializes
// a piece of content wants its numbers, and everything that changes the numbers
// wants to write them; a counter module that also knew about visibility would
// put a cycle through half of `services/`.

export interface SubjectRef {
  type: SubjectType;
  id: string;
}

export function subjectKey(type: SubjectType, id: string) {
  return `${type}:${id}`;
}

// What a card shows under it: the tallies, and what this viewer has already
// done. `views` is unique signed-in viewers plus anonymous opens — one number,
// because "seen by" is one idea to a reader.
export interface Engagement {
  likes: number;
  comments: number;
  reshares: number;
  bookmarks: number;
  views: number;
  liked: boolean;
  bookmarked: boolean;
  reshared: boolean;
  // What the likes are made of (D60), and which one is this viewer's. A plain
  // like is ON_ON, so "likes" is still the total.
  reactions: Record<ReactionKind, number>;
  myReaction: ReactionKind | null;
}

export const EMPTY_REACTIONS: Record<ReactionKind, number> = {
  ON_ON: 0,
  BEER: 0,
  SHIGGY: 0,
  DOWN_DOWN: 0,
};

export const EMPTY: Engagement = {
  likes: 0,
  comments: 0,
  reshares: 0,
  bookmarks: 0,
  views: 0,
  liked: false,
  bookmarked: false,
  reshared: false,
  reactions: EMPTY_REACTIONS,
  myReaction: null,
};

type Tx = Prisma.TransactionClient;

// The six counters, by the column they live in. Counts are derived state, so a
// bump is never allowed to fail the act it describes — but it runs inside the
// same transaction, so a rolled-back like never leaves its number behind.
type Counter = 'likeCount' | 'commentCount' | 'reshareCount' | 'bookmarkCount' | 'viewerCount' | 'anonViewCount';

export async function bump(tx: Tx, type: SubjectType, id: string, counter: Counter, delta: number) {
  await tx.contentStats.upsert({
    where: { subjectType_subjectId: { subjectType: type, subjectId: id } },
    // A first like creates the row at one rather than zero-then-increment.
    create: { subjectType: type, subjectId: id, [counter]: Math.max(0, delta) },
    update: { [counter]: { increment: delta } },
  });
}

// Bulk read for a page of mixed content. One query for the counters and one per
// viewer-flag, rather than six per card.
export async function engagementFor(
  viewerId: string | undefined,
  refs: SubjectRef[],
): Promise<Map<string, Engagement>> {
  const out = new Map<string, Engagement>();
  if (refs.length === 0) return out;

  // De-duplicate: a feed page can carry the same run twice (its own card and a
  // reshare of it).
  const unique = new Map<string, SubjectRef>();
  for (const ref of refs) unique.set(subjectKey(ref.type, ref.id), ref);
  const list = [...unique.values()];
  for (const ref of list) out.set(subjectKey(ref.type, ref.id), { ...EMPTY, reactions: { ...EMPTY_REACTIONS } });

  // Prisma has no tuple `IN`, and the subject types on a page are few, so the
  // filter is grouped by type: one OR arm per type, each with an id list.
  const byType = new Map<SubjectType, string[]>();
  for (const ref of list) byType.set(ref.type, [...(byType.get(ref.type) ?? []), ref.id]);
  const arms = [...byType.entries()].map(([subjectType, ids]) => ({ subjectType, subjectId: { in: ids } }));

  const rows = await prisma.contentStats.findMany({ where: { OR: arms } });
  for (const row of rows) {
    const entry = out.get(subjectKey(row.subjectType, row.subjectId));
    if (!entry) continue;
    entry.likes = row.likeCount;
    entry.comments = row.commentCount;
    entry.reshares = row.reshareCount;
    entry.bookmarks = row.bookmarkCount;
    entry.views = row.viewerCount + row.anonViewCount;
  }

  // What the likes are made of, for the whole page in one grouped read.
  const grouped = await prisma.contentLike.groupBy({
    by: ['subjectType', 'subjectId', 'reaction'],
    where: { unlikedAt: null, OR: arms },
    _count: { _all: true },
  });
  for (const row of grouped) {
    const entry = out.get(subjectKey(row.subjectType, row.subjectId));
    if (entry) entry.reactions[row.reaction] = row._count._all;
  }

  if (!viewerId) return out;

  const [likes, bookmarks, reshares] = await Promise.all([
    prisma.contentLike.findMany({
      where: { userId: viewerId, unlikedAt: null, OR: arms },
      select: { subjectType: true, subjectId: true, reaction: true },
    }),
    prisma.contentBookmark.findMany({
      where: { userId: viewerId, removedAt: null, OR: arms },
      select: { subjectType: true, subjectId: true },
    }),
    prisma.contentReshare.findMany({
      where: { sharerId: viewerId, undoneAt: null, OR: arms },
      select: { subjectType: true, subjectId: true },
    }),
  ]);

  for (const row of likes) {
    const e = out.get(subjectKey(row.subjectType, row.subjectId));
    if (e) {
      e.liked = true;
      e.myReaction = row.reaction;
    }
  }
  for (const row of bookmarks) {
    const e = out.get(subjectKey(row.subjectType, row.subjectId));
    if (e) e.bookmarked = true;
  }
  for (const row of reshares) {
    const e = out.get(subjectKey(row.subjectType, row.subjectId));
    if (e) e.reshared = true;
  }

  return out;
}

export async function engagementOne(viewerId: string | undefined, type: SubjectType, id: string): Promise<Engagement> {
  const map = await engagementFor(viewerId, [{ type, id }]);
  return map.get(subjectKey(type, id)) ?? { ...EMPTY, reactions: { ...EMPTY_REACTIONS } };
}

// Recount a subject from its rows. Nothing calls this on a request path; it is
// what a repair script runs when a counter has drifted, and what makes the
// denormalisation safe to rely on elsewhere.
export async function recount(type: SubjectType, id: string) {
  const where = { subjectType: type, subjectId: id };
  const [likes, comments, reshares, bookmarks, viewers] = await Promise.all([
    prisma.contentLike.count({ where: { ...where, unlikedAt: null } }),
    prisma.contentComment.count({ where: { ...where, status: 'VISIBLE' } }),
    prisma.contentReshare.count({ where: { ...where, undoneAt: null } }),
    prisma.contentBookmark.count({ where: { ...where, removedAt: null } }),
    prisma.contentView.count({ where }),
  ]);
  return prisma.contentStats.upsert({
    where: { subjectType_subjectId: { subjectType: type, subjectId: id } },
    create: {
      ...where,
      likeCount: likes,
      commentCount: comments,
      reshareCount: reshares,
      bookmarkCount: bookmarks,
      viewerCount: viewers,
    },
    update: {
      likeCount: likes,
      commentCount: comments,
      reshareCount: reshares,
      bookmarkCount: bookmarks,
      viewerCount: viewers,
    },
  });
}
