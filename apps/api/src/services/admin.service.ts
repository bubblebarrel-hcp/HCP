import {
  AccountStatus,
  KennelStatus,
  MembershipStatus,
  PlatformRole,
  Prisma,
  RoleAssignmentStatus,
  VerificationLevel,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { displayName } from '../serializers/user';
import { recordAudit } from './record.service';
import { getNumberSetting } from './settings.service';

// One aggregate call for the dashboard, not four list calls counted client-side.
export async function stats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [kennels, activeKennels, verifiedKennels, pendingKennels, users, recentSignups] = await prisma.$transaction([
    prisma.kennel.count(),
    prisma.kennel.count({ where: { status: KennelStatus.ACTIVE } }),
    prisma.kennel.count({ where: { verificationLevel: { not: VerificationLevel.PENDING } } }),
    prisma.kennel.count({ where: { status: KennelStatus.PENDING_VERIFICATION } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);
  return { kennels, activeKennels, verifiedKennels, pendingKennels, users, recentSignups };
}

// The review queue (D33/D10). A founded kennel is reachable by link but stays
// out of the directory and off the map until the platform activates it, so
// something has to show staff what is waiting — otherwise activation depends on
// somebody thinking to filter the kennel list.
export async function pendingKennels(opts: { limit: number }) {
  const minimum = await getNumberSetting('kennel.verification.minMismanagement');
  const rows = await prisma.kennel.findMany({
    where: { status: KennelStatus.PENDING_VERIFICATION },
    // Longest wait first: the queue is a queue.
    orderBy: { createdAt: 'asc' },
    take: opts.limit,
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      // Kennel.createdById is a plain column, not a relation, so the founder is
      // looked up separately rather than included.
      createdById: true,
      _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
    },
  });

  const founders = await prisma.user.findMany({
    where: { id: { in: rows.map((k) => k.createdById).filter((id): id is string => Boolean(id)) } },
    select: { id: true, hashHandle: true, person: { select: { firstName: true } } },
  });
  const founderNames = new Map(founders.map((u) => [u.id, displayName(u.hashHandle, u.person?.firstName)]));

  // One grouped count rather than a query per kennel.
  const appointments = await prisma.officerAppointment.findMany({
    where: {
      kennelId: { in: rows.map((k) => k.id) },
      status: RoleAssignmentStatus.ACTIVE,
      position: { isMismanagement: true },
    },
    distinct: ['kennelId', 'userId'],
    select: { kennelId: true },
  });
  const held = new Map<string, number>();
  for (const a of appointments) held.set(a.kennelId, (held.get(a.kennelId) ?? 0) + 1);

  const items = rows.map(({ _count, createdById, latitude, longitude, ...k }) => {
    const mismanagementCount = held.get(k.id) ?? 0;
    return {
      ...k,
      activeMemberCount: _count.memberships,
      foundedBy: createdById ? (founderNames.get(createdById) ?? null) : null,
      mismanagementCount,
      mismanagementNeeded: minimum,
      // What D10 asks for is filled; the decision is still the platform's.
      readyForReview: mismanagementCount >= minimum,
      // A kennel with no coordinates joins the directory but not the map, which
      // is worth saying before activation rather than after.
      hasCoordinates: latitude !== null && longitude !== null,
      waitingDays: Math.floor((Date.now() - k.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
    };
  });

  return { items, total: items.length, minimum };
}

export async function listUsers(opts: { page: number; limit: number; q?: string }) {
  const where: Prisma.UserWhereInput = opts.q
    ? {
        OR: [
          { email: { contains: opts.q, mode: 'insensitive' } },
          { hashHandle: { contains: opts.q, mode: 'insensitive' } },
          { person: { firstName: { contains: opts.q, mode: 'insensitive' } } },
          { person: { lastName: { contains: opts.q, mode: 'insensitive' } } },
        ],
      }
    : {};

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        email: true,
        platformRole: true,
        status: true,
        trustLevel: true,
        hashHandle: true,
        createdAt: true,
        lastLoginAt: true,
        person: { select: { firstName: true, lastName: true, country: true } },
        homeKennel: { select: { id: true, shortName: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const items = rows.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.platformRole,
    status: u.status,
    trustLevel: u.trustLevel,
    displayName: displayName(u.hashHandle, u.person?.firstName),
    fullName: u.person ? `${u.person.firstName} ${u.person.lastName}` : null,
    country: u.person?.country ?? null,
    homeKennel: u.homeKennel,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));
  return page(items, total, opts.page, opts.limit);
}

async function findUser(id: string) {
  if (!isUuid(id)) throw ApiError.notFound('User not found');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function updateRole(actorId: string, id: string, platformRole: PlatformRole) {
  if (actorId === id) throw ApiError.badRequest('You cannot change your own platform role', 'SELF_ROLE_CHANGE');
  const before = await findUser(id);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { platformRole }, select: { id: true, platformRole: true } });
    await recordAudit(tx, {
      actorId,
      action: 'user.platformRole.change',
      resourceType: 'Identity',
      resourceId: id,
      previousState: { platformRole: before.platformRole },
      newState: { platformRole },
    });
    return { id: user.id, role: user.platformRole };
  });
}

export async function updateStatus(actorId: string, id: string, status: AccountStatus, reason?: string | null) {
  if (actorId === id) throw ApiError.badRequest('You cannot change your own account status', 'SELF_STATUS_CHANGE');
  const before = await findUser(id);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { status }, select: { id: true, status: true } });
    // Suspension ends every session immediately rather than at the next refresh.
    if (status === AccountStatus.SUSPENDED) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await recordAudit(tx, {
      actorId,
      action: 'user.status.change',
      resourceType: 'Identity',
      resourceId: id,
      previousState: { status: before.status },
      newState: { status },
      reason: reason ?? null,
    });
    return user;
  });
}
