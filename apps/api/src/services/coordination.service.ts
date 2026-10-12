import prisma from '../config/prisma';

// Spotting a campaign (D75). Not a verdict: it only says "these reporters look
// like one", and the caller counts a linked group as one reporter instead of
// several. What follows (flagging for staff, and nothing being done to anybody
// until a person says which it was) is enforcement.service's business.
//
// Two reporters are **linked** when at least two of these hold. One alone is
// ordinary: friends join together, a public post draws reports within minutes, and
// people who follow each other share a kennel.
//
//   JOINED      their accounts were made within two days of each other
//   TOGETHER    they reported this person within twenty minutes of each other
//   RING        they have both reported at least two of the same *other* people in
//               the last 90 days (the mark of a group that reports together)
//   MUTUAL      they follow each other
//
// Linked reporters form groups (A linked to B and B to C is one group of three).
// Separately, an account with no life on the platform at all, which has never
// posted, commented, joined a kennel or followed anyone, counts for half: it is
// not suspicious on its own, but a campaign is what such accounts are made for.
//
// No device, address or network data is read or kept for this. Nothing here needs
// it, and holding it would be a cost to everyone else.

const HOUR = 60 * 60 * 1000;
const JOINED_WITHIN_MS = 48 * HOUR;
const TOGETHER_WITHIN_MS = 20 * 60 * 1000;
const RING_MIN_SHARED = 2;
const RING_WINDOW_MS = 90 * 24 * HOUR;
// A group of this many is looked at pairwise; beyond it the cost is not worth it,
// and a campaign of sixty is plainly not sixty strangers.
const MAX_REPORTERS = 60;
const THIN_FOLLOWS = 3;

export type Signal = 'JOINED' | 'TOGETHER' | 'RING' | 'MUTUAL';

export const SIGNAL_TEXT: Record<Signal, string> = {
  JOINED: 'joined within two days of each other',
  TOGETHER: 'reported within minutes of each other',
  RING: 'have reported the same other people before',
  MUTUAL: 'follow each other',
};

export interface Reporter {
  id: string;
  createdAt: Date;
  // When they reported this hasher (the earliest, if more than once).
  reportedAt: Date;
}

export interface Cluster {
  reporterIds: string[];
  signals: Signal[];
}

export interface Detection {
  clusters: Cluster[];
  // Reporters outside any group with next to no life on the platform.
  thin: string[];
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export async function detect(targetUserId: string, input: Reporter[]): Promise<Detection> {
  // The earliest reporters are the ones that matter: a flood can only be this big.
  const reporters = [...input].sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime()).slice(0, MAX_REPORTERS);
  if (reporters.length === 0) return { clusters: [], thin: [] };
  const ids = reporters.map((r) => r.id);

  const [history, follows, posts, reels, comments, members] = await Promise.all([
    // Who they have reported lately, other than this person.
    reporters.length > 1
      ? prisma.contentReport.findMany({
          where: {
            reporterId: { in: ids },
            targetUserId: { not: targetUserId },
            createdAt: { gte: new Date(Date.now() - RING_WINDOW_MS) },
          },
          select: { reporterId: true, targetUserId: true },
          distinct: ['reporterId', 'targetUserId'],
        })
      : Promise.resolve([]),
    prisma.follow.findMany({
      where: { followerId: { in: ids }, targetType: 'USER', status: 'ACTIVE', unfollowedAt: null },
      select: { followerId: true, targetId: true },
    }),
    prisma.post.groupBy({ by: ['authorId'], where: { authorId: { in: ids } }, _count: { _all: true } }),
    prisma.reel.groupBy({ by: ['authorId'], where: { authorId: { in: ids } }, _count: { _all: true } }),
    prisma.contentComment.groupBy({ by: ['authorId'], where: { authorId: { in: ids } }, _count: { _all: true } }),
    prisma.membership.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
  ]);

  // ── Pairwise signals ──
  const signals = new Map<string, Set<Signal>>();
  const add = (a: string, b: string, signal: Signal) => {
    const key = pairKey(a, b);
    (signals.get(key) ?? signals.set(key, new Set()).get(key)!).add(signal);
  };

  for (let i = 0; i < reporters.length; i++) {
    for (let j = i + 1; j < reporters.length; j++) {
      const a = reporters[i];
      const b = reporters[j];
      if (Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) <= JOINED_WITHIN_MS) add(a.id, b.id, 'JOINED');
      if (Math.abs(a.reportedAt.getTime() - b.reportedAt.getTime()) <= TOGETHER_WITHIN_MS) add(a.id, b.id, 'TOGETHER');
    }
  }

  // RING: for each other person reported, who reported them; every pair among those
  // shares one more target.
  const reportersOf = new Map<string, string[]>();
  for (const row of history) {
    if (!row.targetUserId) continue;
    (reportersOf.get(row.targetUserId) ?? reportersOf.set(row.targetUserId, []).get(row.targetUserId)!).push(row.reporterId);
  }
  const shared = new Map<string, number>();
  for (const who of reportersOf.values()) {
    for (let i = 0; i < who.length; i++) {
      for (let j = i + 1; j < who.length; j++) {
        const key = pairKey(who[i], who[j]);
        shared.set(key, (shared.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of shared) {
    if (count >= RING_MIN_SHARED) {
      const [a, b] = key.split('|');
      add(a, b, 'RING');
    }
  }

  const following = new Set(follows.map((f) => `${f.followerId}>${f.targetId}`));
  for (const f of follows) {
    if (ids.includes(f.targetId) && following.has(`${f.targetId}>${f.followerId}`)) add(f.followerId, f.targetId, 'MUTUAL');
  }

  // ── Groups: connected through links of two or more signals ──
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const linked: [string, string, Set<Signal>][] = [];
  for (const [key, set] of signals) {
    if (set.size < 2) continue;
    const [a, b] = key.split('|');
    parent.set(find(a), find(b));
    linked.push([a, b, set]);
  }
  const groups = new Map<string, { ids: Set<string>; signals: Set<Signal> }>();
  for (const [a, b, set] of linked) {
    const root = find(a);
    const group = groups.get(root) ?? groups.set(root, { ids: new Set(), signals: new Set() }).get(root)!;
    group.ids.add(a);
    group.ids.add(b);
    for (const s of set) group.signals.add(s);
  }
  const clusters: Cluster[] = [...groups.values()].map((g) => ({ reporterIds: [...g.ids], signals: [...g.signals] }));

  // ── Accounts with no life at all ──
  const lives = new Set<string>();
  for (const rows of [posts, reels, comments]) for (const r of rows) lives.add(r.authorId);
  for (const r of members) lives.add(r.userId);
  const follows3 = new Map<string, number>();
  for (const f of follows) follows3.set(f.followerId, (follows3.get(f.followerId) ?? 0) + 1);
  const grouped = new Set(clusters.flatMap((c) => c.reporterIds));
  const thin = ids.filter((id) => !grouped.has(id) && !lives.has(id) && (follows3.get(id) ?? 0) < THIN_FOLLOWS);

  return { clusters, thin };
}
