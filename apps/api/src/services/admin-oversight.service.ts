import {
  KennelStatus,
  MembershipStatus,
  Prisma,
  PostStatus,
  ReelStatus,
  RoleAssignmentStatus,
  RunStatus,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { displayName } from '../serializers/user';
import { getNumberSetting } from './settings.service';
import * as posts from './post.service';
import * as reels from './reel.service';
import type { Actor } from './permission.service';

// Platform-admin oversight over what kennels and hashers made. Memberships and
// runs are read-only here: a kennel decides its own members (D3), and the
// platform has no authority over a run. Public identity is always the hash
// handle, or "Just <first name>" (D11); biodata is never selected.

const who = {
  select: { hashHandle: true, person: { select: { firstName: true } } },
} as const;
type Who = { hashHandle: string | null; person: { firstName: string } | null };
const nameOf = (u: Who | null | undefined) => (u ? displayName(u.hashHandle, u.person?.firstName) : null);

const handleMatch = (q: string): Prisma.UserWhereInput => ({
  OR: [
    { hashHandle: { contains: q, mode: 'insensitive' } },
    { person: { firstName: { contains: q, mode: 'insensitive' } } },
  ],
});

// --- memberships -------------------------------------------------------------

export async function listMemberships(opts: {
  page: number;
  limit: number;
  q?: string;
  kennelId?: string;
  status?: MembershipStatus;
}) {
  const where: Prisma.MembershipWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.kennelId ? { kennelId: opts.kennelId } : {}),
    ...(opts.q
      ? { OR: [{ user: handleMatch(opts.q) }, { kennel: { name: { contains: opts.q, mode: 'insensitive' } } }] }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.membership.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        type: true,
        status: true,
        isHomeKennel: true,
        startDate: true,
        approvedAt: true,
        suspendedUntil: true,
        createdAt: true,
        user: { select: { id: true, ...who.select } },
        kennel: { select: { id: true, shortName: true, slug: true } },
      },
    }),
    prisma.membership.count({ where }),
  ]);
  const items = rows.map(({ user, ...m }) => ({ ...m, hasher: { id: user.id, displayName: nameOf(user) } }));
  return page(items, total, opts.page, opts.limit);
}

// D10: per-kennel count of distinct hashers holding an active mismanagement
// appointment, against the platform minimum.
export async function verificationReadiness() {
  const minimum = await getNumberSetting('kennel.verification.minMismanagement');
  const kennels = await prisma.kennel.findMany({
    where: { status: { not: KennelStatus.ARCHIVED } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      status: true,
      verificationLevel: true,
      _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
    },
  });
  const appointments = await prisma.officerAppointment.findMany({
    where: {
      kennelId: { in: kennels.map((k) => k.id) },
      status: RoleAssignmentStatus.ACTIVE,
      position: { isMismanagement: true },
    },
    distinct: ['kennelId', 'userId'],
    select: { kennelId: true },
  });
  const held = new Map<string, number>();
  for (const a of appointments) held.set(a.kennelId, (held.get(a.kennelId) ?? 0) + 1);

  const items = kennels.map(({ _count, ...k }) => {
    const mismanagementCount = held.get(k.id) ?? 0;
    return {
      ...k,
      activeMembers: _count.memberships,
      mismanagementCount,
      mismanagementNeeded: minimum,
      meetsRule: mismanagementCount >= minimum,
      // Verified (or active) on paper without the people to back it.
      atRisk: mismanagementCount < minimum && k.status === KennelStatus.ACTIVE,
    };
  });
  return { items, total: items.length, minimum };
}

// --- runs --------------------------------------------------------------------

// Never selects Trail, Waypoint, BeerCheck or chalk: trail secrecy is
// server-enforced and the platform admin is not an exception (D6/D12).
export async function listRuns(opts: {
  page: number;
  limit: number;
  q?: string;
  kennelId?: string;
  status?: RunStatus;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.RunWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.kennelId ? { kennelId: opts.kennelId } : {}),
    ...(opts.q
      ? {
          OR: [
            { title: { contains: opts.q, mode: 'insensitive' } },
            { kennel: { name: { contains: opts.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(opts.from || opts.to ? { startsAt: { gte: opts.from, lte: opts.to } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.run.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        runNumber: true,
        title: true,
        runType: true,
        status: true,
        visibility: true,
        startsAt: true,
        city: true,
        country: true,
        isPaused: true,
        cancelReason: true,
        trailReleasedAt: true,
        createdAt: true,
        kennel: { select: { id: true, shortName: true, slug: true } },
        trailReport: { select: { status: true, publishedAt: true } },
        capsule: { select: { status: true } },
        _count: { select: { hares: true, participations: true } },
      },
    }),
    prisma.run.count({ where }),
  ]);
  const items = rows.map(({ _count, trailReport, capsule, trailReleasedAt, ...r }) => ({
    ...r,
    hareCount: _count.hares,
    attendeeCount: _count.participations,
    trailReleased: trailReleasedAt !== null,
    reportStatus: trailReport?.status ?? null,
    capsuleStatus: capsule?.status ?? null,
  }));
  return page(items, total, opts.page, opts.limit);
}

// Runs that finished but whose report or capsule never got published.
export async function runsAwaitingReport() {
  const rows = await prisma.run.findMany({
    where: {
      status: { in: [RunStatus.CIRCLE, RunStatus.REPORTING] },
      OR: [{ trailReport: null }, { trailReport: { status: { not: 'PUBLISHED' } } }],
    },
    orderBy: { startsAt: 'asc' },
    take: 50,
    select: {
      id: true,
      runNumber: true,
      title: true,
      status: true,
      startsAt: true,
      kennel: { select: { shortName: true, slug: true } },
      trailReport: { select: { status: true } },
    },
  });
  return { items: rows, total: rows.length };
}

// --- content -----------------------------------------------------------------

const body = (text: string) => (text.length > 600 ? `${text.slice(0, 600)}…` : text);

export async function listPosts(opts: { page: number; limit: number; q?: string; kennelId?: string; status?: PostStatus }) {
  const where: Prisma.PostWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.kennelId ? { kennelId: opts.kennelId } : {}),
    ...(opts.q
      ? { OR: [{ body: { contains: opts.q, mode: 'insensitive' } }, { author: handleMatch(opts.q) }] }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        body: true,
        status: true,
        visibility: true,
        publishedAt: true,
        removedAt: true,
        removedReason: true,
        createdAt: true,
        author: { select: { id: true, ...who.select } },
        kennel: { select: { id: true, shortName: true, slug: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);
  const items = rows.map(({ author, body: text, ...p }) => ({
    ...p,
    body: body(text),
    author: { id: author.id, displayName: nameOf(author) },
  }));
  return page(items, total, opts.page, opts.limit);
}

export async function listReels(opts: { page: number; limit: number; q?: string; kennelId?: string; status?: ReelStatus }) {
  const where: Prisma.ReelWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.kennelId ? { kennelId: opts.kennelId } : {}),
    ...(opts.q
      ? { OR: [{ caption: { contains: opts.q, mode: 'insensitive' } }, { author: handleMatch(opts.q) }] }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.reel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        caption: true,
        status: true,
        visibility: true,
        viewCount: true,
        pinnedAt: true,
        publishedAt: true,
        removedAt: true,
        removedReason: true,
        createdAt: true,
        author: { select: { id: true, ...who.select } },
        kennel: { select: { id: true, shortName: true, slug: true } },
        media: { select: { thumbnailUrl: true, kind: true } },
      },
    }),
    prisma.reel.count({ where }),
  ]);
  const items = rows.map(({ author, pinnedAt, ...r }) => ({
    ...r,
    pinned: pinnedAt !== null,
    author: { id: author.id, displayName: nameOf(author) },
  }));
  return page(items, total, opts.page, opts.limit);
}

// Takedown goes through the same services kennel moderators use, so the
// DomainEvent and AuditLog are written the same way (policyRef platform-admin
// for a post, media.moderate for a reel, as those services record it).
export async function takedownPost(actor: Actor, id: string, reason: string) {
  if (!isUuid(id)) throw ApiError.notFound('Post not found');
  const post = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!post) throw ApiError.notFound('Post not found');
  if (post.status === PostStatus.REMOVED) throw ApiError.conflict('That post is already taken down', 'ALREADY_REMOVED');
  await posts.remove(actor, id, reason);
  return { id, status: PostStatus.REMOVED };
}

export async function takedownReel(actor: Actor, id: string, reason: string) {
  if (!isUuid(id)) throw ApiError.notFound('Reel not found');
  const reel = await prisma.reel.findUnique({ where: { id }, select: { status: true } });
  if (!reel) throw ApiError.notFound('Reel not found');
  if (reel.status === ReelStatus.REMOVED || reel.status === ReelStatus.DELETED) {
    throw ApiError.conflict('That reel is already gone', 'ALREADY_REMOVED');
  }
  await reels.remove(actor, id, reason);
  return { id, status: ReelStatus.REMOVED };
}
