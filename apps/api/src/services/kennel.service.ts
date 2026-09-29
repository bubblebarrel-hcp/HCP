import {
  FollowTargetType,
  KennelStatus,
  KennelVisibility,
  OrganizationType,
  Prisma,
  RoleAssignmentStatus,
  VerificationLevel,
  MembershipStatus,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page, slugify } from '../utils/http';
import { type Actor, assertKennelPermission } from './permission.service';
import { revalidateKennel } from './revalidate.service';
import { getNumberSetting } from './settings.service';
import { recordAudit, recordEvent } from './record.service';

// What anyone may see about a kennel (FR-KENNEL-003). Internal settings such
// as moderation mode and offline release policy stay out of the public shape.
const publicKennelSelect = {
  id: true,
  name: true,
  shortName: true,
  slug: true,
  orgType: true,
  country: true,
  stateProvince: true,
  city: true,
  timeZone: true,
  latitude: true,
  longitude: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  bannerPosition: true,
  primaryColor: true,
  motto: true,
  meetingDay: true,
  foundedOn: true,
  verificationLevel: true,
  createdAt: true,
} satisfies Prisma.KennelSelect;

// Discoverable = active and publicly listed (FR-KENNEL-014). Unlisted kennels
// are reachable by link; hidden ones need an invitation (FR-MEMBER-001).
const discoverableWhere: Prisma.KennelWhereInput = {
  status: KennelStatus.ACTIVE,
  visibility: KennelVisibility.PUBLIC,
};

export async function listPublic(opts: { page: number; limit: number; q?: string; country?: string }) {
  const where: Prisma.KennelWhereInput = {
    ...discoverableWhere,
    ...(opts.country ? { country: { equals: opts.country, mode: 'insensitive' } } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: 'insensitive' } },
            { shortName: { contains: opts.q, mode: 'insensitive' } },
            { city: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.kennel.findMany({
      where,
      select: {
        ...publicKennelSelect,
        _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
      },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.kennel.count({ where }),
  ]);

  return page(
    items.map(({ _count, ...k }) => ({ ...k, activeMemberCount: _count.memberships })),
    total,
    opts.page,
    opts.limit,
  );
}

// A light read for the map: id, slug, name and coordinates only, and every
// discoverable kennel at once rather than a page of them (the list endpoint's
// limit tops out at 100, which would silently drop pins past it).
export async function listMapPins() {
  return prisma.kennel.findMany({
    where: { ...discoverableWhere, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, slug: true, name: true, shortName: true, city: true, country: true, latitude: true, longitude: true },
    orderBy: [{ country: 'asc' }, { name: 'asc' }],
  });
}

export async function getPublicBySlug(slug: string) {
  const kennel = await prisma.kennel.findFirst({
    // Pending Verification is readable by link but never listed in the directory
    // (see discoverableWhere). A newly founded kennel has to be reachable and
    // joinable, or it can never gather the mismanagement D10 asks for — which is
    // the same reasoning membership.service#isOpenForRequests already applies.
    where: {
      slug,
      status: { in: [KennelStatus.ACTIVE, KennelStatus.PENDING_VERIFICATION] },
      visibility: { not: KennelVisibility.HIDDEN },
    },
    select: {
      ...publicKennelSelect,
      landingMessage: true,
      _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
      officerAppointments: {
        where: { status: RoleAssignmentStatus.ACTIVE },
        orderBy: { position: { sortOrder: 'asc' } },
        select: {
          position: { select: { title: true } },
          user: { select: { hashHandle: true, avatarUrl: true, person: { select: { firstName: true } } } },
        },
      },
    },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');

  const { _count, officerAppointments, ...rest } = kennel;
  // Followers are not members (D50): following a kennel grants nothing and is
  // never counted towards the four active mismanagement members D10 asks for.
  const followerCount = await prisma.follow.count({
    where: { targetType: FollowTargetType.KENNEL, targetId: kennel.id, unfollowedAt: null },
  });
  return {
    ...rest,
    activeMemberCount: _count.memberships,
    followerCount,
    // Officers are public (FR-KENNEL-003), shown by hash handle and the picture
    // they chose — public identity, never biodata (D5/D11)
    officers: officerAppointments.map((a) => ({
      title: a.position.title,
      name: a.user.hashHandle ?? `Just ${a.user.person?.firstName ?? 'a Hasher'}`,
      avatarUrl: a.user.avatarUrl,
    })),
  };
}

// ─── Admin ───

export async function listAdmin(opts: { page: number; limit: number; q?: string; status?: KennelStatus }) {
  const where: Prisma.KennelWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: 'insensitive' } },
            { city: { contains: opts.q, mode: 'insensitive' } },
            { country: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.kennel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { _count: { select: { memberships: true, runs: true } } },
    }),
    prisma.kennel.count({ where }),
  ]);
  return page(items, total, opts.page, opts.limit);
}

export async function getAdmin(id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Kennel not found');
  const kennel = await prisma.kennel.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true, runs: true } } },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return { ...kennel, activeMismanagementCount: await countActiveMismanagement(id) };
}

// D10: distinct people holding an active mismanagement position
async function countActiveMismanagement(kennelId: string) {
  const rows = await prisma.officerAppointment.findMany({
    where: { kennelId, status: RoleAssignmentStatus.ACTIVE, position: { isMismanagement: true } },
    distinct: ['userId'],
    select: { userId: true },
  });
  return rows.length;
}

async function assertVerifiable(kennelId: string | null, level: VerificationLevel | undefined) {
  if (!level || level === VerificationLevel.PENDING) return;
  const minimum = await getNumberSetting('kennel.verification.minMismanagement');
  const count = kennelId ? await countActiveMismanagement(kennelId) : 0;
  if (count < minimum) {
    throw ApiError.badRequest(
      `A kennel needs at least ${minimum} active mismanagement members to be verified (has ${count}).`,
      'VERIFICATION_THRESHOLD_NOT_MET',
    );
  }
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || 'kennel';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.kennel.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw ApiError.conflict('Could not generate a unique slug', 'SLUG_EXHAUSTED');
}

export type KennelInput = Omit<Prisma.KennelUncheckedCreateInput, 'id' | 'slug' | 'createdAt' | 'updatedAt'>;

export async function create(actorId: string, input: KennelInput) {
  // A brand-new kennel has no officers, so it can only start unverified.
  await assertVerifiable(null, input.verificationLevel as VerificationLevel | undefined);

  const slug = await uniqueSlug(`${input.shortName}-${input.city}`);
  return prisma.$transaction(async (tx) => {
    const kennel = await tx.kennel.create({
      data: { ...input, slug, createdById: actorId },
    });
    const event = await recordEvent(tx, {
      eventType: 'KennelCreated',
      aggregateType: 'Kennel',
      aggregateId: kennel.id,
      actorId,
      payload: { name: kennel.name, country: kennel.country },
    });
    await recordAudit(tx, {
      actorId,
      action: 'kennel.create',
      resourceType: 'Kennel',
      resourceId: kennel.id,
      kennelId: kennel.id,
      newState: { status: kennel.status, verificationLevel: kennel.verificationLevel },
      domainEventId: event.id,
    });
    return kennel;
  });
}

export async function update(actorId: string, id: string, input: Partial<KennelInput>) {
  const before = await getAdmin(id);

  if (input.verificationLevel && input.verificationLevel !== before.verificationLevel) {
    await assertVerifiable(id, input.verificationLevel as VerificationLevel);
  }

  const slug =
    (input.shortName && input.shortName !== before.shortName) || (input.city && input.city !== before.city)
      ? await uniqueSlug(`${input.shortName ?? before.shortName}-${input.city ?? before.city}`, id)
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const verificationChanged = input.verificationLevel && input.verificationLevel !== before.verificationLevel;
    const kennel = await tx.kennel.update({
      where: { id },
      data: {
        ...input,
        ...(slug ? { slug } : {}),
        ...(verificationChanged
          ? { verifiedAt: input.verificationLevel === VerificationLevel.PENDING ? null : new Date() }
          : {}),
        ...(input.status === KennelStatus.ARCHIVED && before.status !== KennelStatus.ARCHIVED
          ? { archivedAt: new Date() }
          : {}),
      },
    });

    const events: string[] = [];
    if (verificationChanged) events.push('KennelVerificationLevelChanged');
    if (input.status && input.status !== before.status) {
      if (input.status === KennelStatus.ACTIVE && before.status === KennelStatus.PENDING_VERIFICATION) {
        events.push('KennelVerified');
      }
      if (input.status === KennelStatus.ARCHIVED) events.push('KennelArchived');
    }

    let lastEventId: string | null = null;
    for (const eventType of events) {
      const event = await recordEvent(tx, {
        eventType,
        aggregateType: 'Kennel',
        aggregateId: id,
        actorId,
        payload: { status: kennel.status, verificationLevel: kennel.verificationLevel },
      });
      lastEventId = event.id;
    }

    await recordAudit(tx, {
      actorId,
      action: 'kennel.update',
      resourceType: 'Kennel',
      resourceId: id,
      kennelId: id,
      previousState: { status: before.status, verificationLevel: before.verificationLevel, visibility: before.visibility },
      newState: { status: kennel.status, verificationLevel: kennel.verificationLevel, visibility: kennel.visibility },
      domainEventId: lastEventId,
    });
    return kennel;
  });

  // Editing a kennel's branding emits no DomainEvent, so the outbox consumer
  // never sees it and the public page would sit on the 60s window. Renaming
  // also moves the slug, so the old address needs evicting as well.
  await revalidateKennel(updated.slug, before.slug);
  return updated;
}

// ARCHITECTURE-RULES: verified or historically meaningful kennels are archived,
// not hard-deleted. Only a kennel with no history at all may be removed.
export async function remove(actorId: string, id: string) {
  const kennel = await getAdmin(id);
  const hasHistory =
    kennel._count.memberships > 0 ||
    kennel._count.runs > 0 ||
    kennel.verificationLevel !== VerificationLevel.PENDING;

  if (hasHistory) {
    const archived = await update(actorId, id, { status: KennelStatus.ARCHIVED });
    return { deleted: false, archived: true, kennel: archived };
  }

  await prisma.$transaction(async (tx) => {
    await tx.kennel.delete({ where: { id } });
    await recordAudit(tx, {
      actorId,
      action: 'kennel.delete',
      resourceType: 'Kennel',
      resourceId: id,
      previousState: { name: kennel.name, status: kennel.status },
    });
  });
  // D35: this path only ever accepts a kennel with no history — never public
  // in the first place — but it is the one kennel write outside the outbox
  // mechanism, so it evicts directly rather than relying on an event nobody
  // will publish for a row that no longer exists.
  await revalidateKennel(kennel.slug);
  return { deleted: true, archived: false };
}

// ─── Self-service founding (FR-KENNEL-001, D33) ───

export interface FoundKennelInput {
  name: string;
  shortName: string;
  orgType?: OrganizationType;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  motto?: string | null;
  meetingDay?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

// A hasher starts their own kennel. Unlike the admin path this one fixes the
// status and verification level server-side, so founding can never be a route
// to an ACTIVE, PLATFORM_VERIFIED kennel.
//
// Email verification is not re-checked here: a session cannot exist without it
// (D31), so anyone reaching this code has already confirmed their address.
export async function found(actorId: string, input: FoundKennelInput) {
  // One at a time. A founder still waiting on verification cannot start another,
  // which keeps the directory from filling with abandoned drafts.
  const pending = await prisma.kennel.findFirst({
    where: { createdById: actorId, status: KennelStatus.PENDING_VERIFICATION },
    select: { name: true },
  });
  if (pending) {
    throw ApiError.conflict(
      `You already started ${pending.name}, and it is still awaiting verification.`,
      'FOUNDER_HAS_PENDING_KENNEL',
    );
  }

  // FR-KENNEL-001: duplicate local kennel names are not permitted. The unique
  // index on (name, city, country) is the guarantee; this is the readable error.
  const clash = await prisma.kennel.findFirst({
    where: { name: input.name.trim(), city: input.city.trim(), country: input.country.trim() },
    select: { slug: true },
  });
  if (clash) {
    throw ApiError.conflict('A kennel with that name already runs in that city.', 'KENNEL_EXISTS');
  }

  const slug = await uniqueSlug(`${input.shortName}-${input.city}`);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const kennel = await tx.kennel.create({
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        city: true,
        country: true,
        status: true,
        verificationLevel: true,
      },
      data: {
        ...input,
        name: input.name.trim(),
        slug,
        createdById: actorId,
        // Not the founder's to choose (D33). Verification is earned by getting
        // four active mismanagement members (D10), not claimed at signup.
        status: KennelStatus.PENDING_VERIFICATION,
        verificationLevel: VerificationLevel.PENDING,
      },
    });

    const created = await recordEvent(tx, {
      eventType: 'KennelCreated',
      aggregateType: 'Kennel',
      aggregateId: kennel.id,
      actorId,
      payload: { name: kennel.name, country: kennel.country, founded: true },
    });
    await recordAudit(tx, {
      actorId,
      action: 'kennel.found',
      resourceType: 'Kennel',
      resourceId: kennel.id,
      kennelId: kennel.id,
      newState: { status: kennel.status, verificationLevel: kennel.verificationLevel },
      policyRef: 'founder',
      domainEventId: created.id,
    });

    // The founder is a member from the first moment: they are not applying to
    // a kennel, they are starting one.
    const membership = await tx.membership.create({
      data: {
        userId: actorId,
        kennelId: kennel.id,
        type: 'FULL',
        status: MembershipStatus.ACTIVE,
        startDate: now,
        approvedById: actorId,
        approvedAt: now,
        timeline: {
          create: {
            type: 'APPROVED',
            toStatus: MembershipStatus.ACTIVE,
            actorId,
            note: 'Founded the kennel',
          },
        },
      },
      select: { id: true },
    });
    const joined = await recordEvent(tx, {
      eventType: 'MembershipApproved',
      aggregateType: 'Membership',
      aggregateId: membership.id,
      actorId,
      payload: { kennelId: kennel.id, userId: actorId, founder: true },
    });
    await recordAudit(tx, {
      actorId,
      action: 'membership.approve',
      resourceType: 'Membership',
      resourceId: membership.id,
      kennelId: kennel.id,
      newState: { status: MembershipStatus.ACTIVE },
      policyRef: 'founder',
      domainEventId: joined.id,
    });

    // "Creator becomes provisional administrator" (FR-KENNEL-001). This is the
    // real grant: permission.service reads KENNEL_ADMIN role assignments.
    const role = await tx.roleAssignment.create({
      data: {
        userId: actorId,
        kennelId: kennel.id,
        membershipId: membership.id,
        role: 'KENNEL_ADMIN',
        status: 'ACTIVE',
        grantedById: actorId,
      },
      select: { id: true },
    });
    const assigned = await recordEvent(tx, {
      eventType: 'RoleAssigned',
      aggregateType: 'RoleAssignment',
      aggregateId: role.id,
      actorId,
      payload: { kennelId: kennel.id, userId: actorId, role: 'KENNEL_ADMIN', provisional: true },
    });
    await recordAudit(tx, {
      actorId,
      action: 'role.assign',
      resourceType: 'RoleAssignment',
      resourceId: role.id,
      kennelId: kennel.id,
      newState: { role: 'KENNEL_ADMIN' },
      policyRef: 'founder',
      domainEventId: assigned.id,
    });

    // Returned straight from the write rather than re-read through the public
    // serializer: the founder must get a dependable answer whatever the
    // directory rules happen to be.
    return kennel;
  });
}

// ─── What a kennel admin may change about their own kennel (D34) ───

export type KennelSettingsInput = Partial<
  Pick<
    KennelInput,
    | 'name'
    | 'shortName'
    | 'description'
    | 'motto'
    | 'meetingDay'
    | 'logoUrl'
    | 'bannerUrl'
    | 'bannerPosition'
    | 'landingMessage'
    | 'primaryColor'
    | 'secondaryColor'
    | 'country'
    | 'stateProvince'
    | 'city'
    | 'timeZone'
    | 'latitude'
    | 'longitude'
    | 'visibility'
    | 'defaultRunVisibility'
    | 'downDownsEnabled'
    | 'hareNudgeSoonDays'
    | 'hareNudgeUrgentDays'
  >
>;

export async function updateSettings(actor: Actor, slug: string, input: KennelSettingsInput) {
  const kennel = await prisma.kennel.findUnique({ where: { slug }, select: { id: true } });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  await assertKennelPermission(actor, kennel.id, 'kennel.manage');

  // The validator already refuses status and verificationLevel; stripping them
  // again here means a future change to the schema cannot quietly let a kennel
  // promote itself (D34).
  const { status: _status, verificationLevel: _level, ...safe } = input as KennelSettingsInput & {
    status?: unknown;
    verificationLevel?: unknown;
  };
  return update(actor.id, kennel.id, safe);
}

// A founder changed their mind. The kennel is archived rather than deleted,
// because the founder's own membership is already history (D34, and the same
// rule remove() applies).
export async function abandon(actor: Actor, slug: string, reason: string) {
  const kennel = await prisma.kennel.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, createdById: true },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');

  if (kennel.status !== KennelStatus.PENDING_VERIFICATION) {
    throw ApiError.badRequest(
      'Only a kennel still awaiting verification can be abandoned. Ask the platform to archive an established one.',
      'KENNEL_NOT_PENDING',
    );
  }
  if (kennel.createdById !== actor.id) {
    throw ApiError.forbidden('Only the founder can abandon a kennel they started.', 'NOT_THE_FOUNDER');
  }

  // Once other people have joined it is not the founder's alone to close.
  const members = await prisma.membership.count({
    where: { kennelId: kennel.id, status: MembershipStatus.ACTIVE },
  });
  if (members > 1) {
    throw ApiError.badRequest(
      'Other hashers have joined. A kennel with members is archived by the platform, not abandoned.',
      'KENNEL_HAS_MEMBERS',
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.kennel.update({
      where: { id: kennel.id },
      data: { status: KennelStatus.ARCHIVED, archivedAt: now },
    });

    // The founder stops being a member and stops being its admin. Leaving these
    // active would keep an archived kennel in their sidebar and in permission
    // resolution.
    const membership = await tx.membership.findFirst({
      where: { kennelId: kennel.id, userId: actor.id, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (membership) {
      await tx.membership.update({
        where: { id: membership.id },
        data: {
          status: MembershipStatus.RESIGNED,
          endDate: now,
          timeline: {
            create: {
              type: 'RESIGNATION',
              fromStatus: MembershipStatus.ACTIVE,
              toStatus: MembershipStatus.RESIGNED,
              actorId: actor.id,
              note: 'Abandoned the kennel before verification',
            },
          },
        },
      });
      await recordEvent(tx, {
        eventType: 'MembershipResigned',
        aggregateType: 'Membership',
        aggregateId: membership.id,
        actorId: actor.id,
        payload: { kennelId: kennel.id, userId: actor.id, abandoned: true },
      });
    }

    const roles = await tx.roleAssignment.findMany({
      where: { kennelId: kennel.id, userId: actor.id, status: RoleAssignmentStatus.ACTIVE },
      select: { id: true },
    });
    for (const role of roles) {
      await tx.roleAssignment.update({
        where: { id: role.id },
        data: { status: RoleAssignmentStatus.TERM_ENDED, endDate: now },
      });
      await recordEvent(tx, {
        eventType: 'RoleEnded',
        aggregateType: 'RoleAssignment',
        aggregateId: role.id,
        actorId: actor.id,
        payload: { kennelId: kennel.id, userId: actor.id, reason: 'Kennel abandoned' },
      });
    }

    const event = await recordEvent(tx, {
      eventType: 'KennelArchived',
      aggregateType: 'Kennel',
      aggregateId: kennel.id,
      actorId: actor.id,
      payload: { name: kennel.name, abandoned: true, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'kennel.abandon',
      resourceType: 'Kennel',
      resourceId: kennel.id,
      kennelId: kennel.id,
      previousState: { status: kennel.status },
      newState: { status: KennelStatus.ARCHIVED },
      reason,
      policyRef: 'founder',
      domainEventId: event.id,
    });
  });

  return { abandoned: true, name: kennel.name };
}

// The editable shape, for the kennel's own admins. The public read deliberately
// hides visibility and defaults, so the settings screen needs its own source.
export async function getSettings(actor: Actor, slug: string) {
  const kennel = await prisma.kennel.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      description: true,
      motto: true,
      meetingDay: true,
      logoUrl: true,
      bannerUrl: true,
      bannerPosition: true,
      landingMessage: true,
      primaryColor: true,
      secondaryColor: true,
      country: true,
      stateProvince: true,
      city: true,
      timeZone: true,
      latitude: true,
      longitude: true,
      visibility: true,
      defaultRunVisibility: true,
      downDownsEnabled: true,
      hareNudgeSoonDays: true,
      hareNudgeUrgentDays: true,
      status: true,
      verificationLevel: true,
      createdById: true,
      _count: { select: { memberships: { where: { status: MembershipStatus.ACTIVE } } } },
    },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  await assertKennelPermission(actor, kennel.id, 'kennel.manage');

  const { _count, createdById, ...rest } = kennel;
  return {
    ...rest,
    activeMemberCount: _count.memberships,
    mismanagementCount: await countActiveMismanagement(kennel.id),
    mismanagementNeeded: await getNumberSetting('kennel.verification.minMismanagement'),
    // D45 follow-up: what "blank" resolves to, so the settings form can show
    // it as a placeholder rather than a kennel admin having to guess.
    hareNudgeDefaults: {
      soonDays: await getNumberSetting('hare.nudge.soonDays'),
      urgentDays: await getNumberSetting('hare.nudge.urgentDays'),
    },
    // What this viewer may do here, so the screen never offers a dead button.
    viewer: {
      isFounder: createdById === actor.id,
      canAbandon:
        createdById === actor.id &&
        kennel.status === KennelStatus.PENDING_VERIFICATION &&
        _count.memberships <= 1,
    },
  };
}
