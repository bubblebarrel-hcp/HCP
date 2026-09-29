import {
  AccountStatus,
  KennelStatus,
  KennelVisibility,
  MembershipStatus,
  MembershipTimelineType,
  MembershipType,
  Prisma,
  RoleAssignmentStatus,
  type ScopedRole,
} from '@prisma/client';
import prisma from '../config/prisma';
import { displayName } from '../serializers/user';
import { ApiError, isUuid, page } from '../utils/http';
import { type Actor, type KennelPermission, assertKennelPermission, resolveKennelPermissions } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { getNumberSetting } from './settings.service';

const S = MembershipStatus;

// Ch.22 A.2: one open membership per hasher per kennel. Closed rows (Resigned,
// Removed, Rejected, Archived) stay as history and never block a new request.
const OPEN: MembershipStatus[] = [S.APPLICANT, S.PENDING_REVIEW, S.ACTIVE, S.INACTIVE, S.SUSPENDED];
const PENDING: MembershipStatus[] = [S.APPLICANT, S.PENDING_REVIEW];
const HELD_ROLE: RoleAssignmentStatus[] = [RoleAssignmentStatus.APPOINTED, RoleAssignmentStatus.ACTIVE];

// ─── Shapes ───

const kennelSummarySelect = {
  id: true,
  name: true,
  shortName: true,
  slug: true,
  city: true,
  country: true,
  primaryColor: true,
} satisfies Prisma.KennelSelect;

// What a hasher sees about their own memberships.
const ownMembershipSelect = {
  id: true,
  status: true,
  type: true,
  isHomeKennel: true,
  startDate: true,
  endDate: true,
  approvedAt: true,
  suspensionReason: true,
  suspendedUntil: true,
  createdAt: true,
  updatedAt: true,
  kennel: { select: kennelSummarySelect },
} satisfies Prisma.MembershipSelect;

// What officers see in the members list.
const memberSelect = {
  id: true,
  status: true,
  type: true,
  startDate: true,
  endDate: true,
  approvedAt: true,
  suspensionReason: true,
  suspendedUntil: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, hashHandle: true, avatarUrl: true, person: { select: { firstName: true } } } },
  timeline: {
    where: { type: MembershipTimelineType.REQUESTED },
    orderBy: { occurredAt: 'desc' },
    take: 1,
    select: { note: true },
  },
} satisfies Prisma.MembershipSelect;

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

// Officers see public identity only (D5/D11): the hash handle or "Just
// <firstName>". Biodata in PersonProfile never reaches this list.
function serializeMember({ user, timeline, ...rest }: MemberRow) {
  return {
    ...rest,
    requestNote: timeline[0]?.note ?? null,
    member: {
      id: user.id,
      hashHandle: user.hashHandle,
      displayName: displayName(user.hashHandle, user.person?.firstName),
      avatarUrl: user.avatarUrl,
    },
    // Filled in by listMembers, which reads them for the whole page at once.
    offices: [] as { appointmentId: string; positionId: string; title: string }[],
    roles: [] as { assignmentId: string; role: ScopedRole; title: string | null }[],
  };
}

const statusWords: Record<MembershipStatus, string> = {
  APPLICANT: 'an application',
  PENDING_REVIEW: 'pending review',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  RESIGNED: 'resigned',
  REMOVED: 'removed',
  REJECTED: 'not approved',
  WITHDRAWN: 'withdrawn',
  ARCHIVED: 'archived',
};

// ─── Kennel lookup and eligibility ───

async function findKennel(slug: string) {
  const kennel = await prisma.kennel.findFirst({
    where: { slug, status: { not: KennelStatus.ARCHIVED } },
    select: { id: true, name: true, shortName: true, slug: true, status: true, visibility: true },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

type KennelRef = Awaited<ReturnType<typeof findKennel>>;

// Kennels still gathering their founding mismanagement (Pending Verification)
// take members too: they cannot reach D10's threshold otherwise.
function isOpenForRequests(kennel: KennelRef) {
  return (
    kennel.visibility !== KennelVisibility.HIDDEN &&
    (kennel.status === KennelStatus.ACTIVE || kennel.status === KennelStatus.PENDING_VERIFICATION)
  );
}

type Eligibility = { ok: true } | { ok: false; code: string; message: string };

async function checkEligibility(userId: string, kennel: KennelRef): Promise<Eligibility> {
  if (kennel.visibility === KennelVisibility.HIDDEN) {
    // FR-MEMBER-001/D53: hidden kennels require an invitation. This request
    // path never grants one — invitation.service.ts#acceptInvitation is the
    // only door in, and it skips this eligibility check entirely.
    return { ok: false, code: 'INVITATION_REQUIRED', message: 'This kennel is invitation-only.' };
  }
  if (!isOpenForRequests(kennel)) {
    return { ok: false, code: 'KENNEL_NOT_OPEN', message: 'This kennel is not taking new members right now.' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== AccountStatus.ACTIVE) {
    return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', message: 'Your account must be active to join a kennel.' };
  }

  const latest = await prisma.membership.findFirst({
    where: { userId, kennelId: kennel.id },
    orderBy: { createdAt: 'desc' },
    select: { status: true, endDate: true, updatedAt: true },
  });
  if (!latest) return { ok: true };

  switch (latest.status) {
    case S.APPLICANT:
    case S.PENDING_REVIEW:
      return {
        ok: false,
        code: 'REQUEST_PENDING',
        message: "Your request is already waiting for the kennel's mismanagement.",
      };
    case S.ACTIVE:
    case S.INACTIVE:
      return { ok: false, code: 'ALREADY_MEMBER', message: 'You are already a member of this kennel.' };
    case S.SUSPENDED:
      return { ok: false, code: 'MEMBERSHIP_SUSPENDED', message: 'Your membership of this kennel is suspended.' };
    case S.REJECTED:
    case S.REMOVED: {
      // FR-MEMBER-002: reapplication cooldown is configurable.
      const days = await getNumberSetting('membership.reapplyCooldownDays');
      const until = new Date((latest.endDate ?? latest.updatedAt).getTime() + days * 24 * 60 * 60 * 1000);
      if (until > new Date()) {
        return {
          ok: false,
          code: 'REAPPLY_COOLDOWN',
          message: `You can ask to join this kennel again from ${until.toISOString().slice(0, 10)}.`,
        };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

// ─── Member-facing ───

export async function listMine(actor: Actor) {
  const rows = await prisma.membership.findMany({
    where: { userId: actor.id },
    orderBy: { updatedAt: 'desc' },
    select: ownMembershipSelect,
  });
  const items = await Promise.all(
    rows.map(async (m) => ({
      ...m,
      canManage:
        m.status === S.ACTIVE && (await resolveKennelPermissions(actor, m.kennel.id)).has('membership.review'),
    })),
  );
  return page(items, items.length, 1, Math.max(items.length, 1));
}

// FR-MEMBER-007. Two representations share this one fact and both are kept in
// step: `User.homeKennelId` is the pointer attendance.service.ts and
// run.service.ts already read to know who is visiting; `Membership.isHomeKennel`
// is the denormalized flag the members list was already serializing (and
// nothing had ever written). Every Membership row itself is untouched —
// "previous home kennel remains in history" needs no extra bookkeeping,
// because nothing about the memberships changed, only which one is flagged.
export async function setHomeKennel(actor: Actor, kennelId: string | null) {
  let membershipId: string | null = null;
  if (kennelId !== null) {
    if (!isUuid(kennelId)) throw ApiError.notFound('Kennel not found');
    const membership = await prisma.membership.findFirst({
      where: { userId: actor.id, kennelId, status: S.ACTIVE },
      select: { id: true },
    });
    if (!membership) {
      throw ApiError.badRequest('Your home kennel has to be one you are an active member of.', 'NOT_ACTIVE_MEMBER');
    }
    membershipId = membership.id;
  }

  const before = await prisma.user.findUnique({ where: { id: actor.id }, select: { homeKennelId: true } });
  if (before?.homeKennelId === kennelId) return { homeKennelId: kennelId };

  await prisma.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: { userId: actor.id, isHomeKennel: true, ...(membershipId ? { id: { not: membershipId } } : {}) },
      data: { isHomeKennel: false },
    });
    if (membershipId) {
      await tx.membership.update({ where: { id: membershipId }, data: { isHomeKennel: true } });
    }
    await tx.user.update({ where: { id: actor.id }, data: { homeKennelId: kennelId } });

    const event = await recordEvent(tx, {
      eventType: 'HomeKennelTransferred',
      aggregateType: 'Identity',
      aggregateId: actor.id,
      actorId: actor.id,
      payload: { previousKennelId: before?.homeKennelId ?? null, kennelId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'identity.homeKennel.transfer',
      resourceType: 'Identity',
      resourceId: actor.id,
      kennelId,
      previousState: { homeKennelId: before?.homeKennelId ?? null },
      newState: { homeKennelId: kennelId },
      policyRef: 'self',
      domainEventId: event.id,
    });
  });

  return { homeKennelId: kennelId };
}

// The viewer's relationship with a kennel: drives the Join button and whether
// the Manage members entry point is shown.
export async function getViewer(actor: Actor | undefined, slug: string) {
  const kennel = await findKennel(slug);
  const summary = { id: kennel.id, name: kennel.name, shortName: kennel.shortName, slug: kennel.slug };

  if (!actor) {
    if (!isOpenForRequests(kennel)) throw ApiError.notFound('Kennel not found');
    return { kennel: summary, signedIn: false, membership: null, canRequest: false, reason: null, permissions: [], pendingCount: 0 };
  }

  const [membership, eligibility, grants] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId: actor.id, kennelId: kennel.id },
      orderBy: { createdAt: 'desc' },
      select: ownMembershipSelect,
    }),
    checkEligibility(actor.id, kennel),
    resolveKennelPermissions(actor, kennel.id),
  ]);

  // A non-public kennel is only revealed to people with a relationship to it.
  if (!isOpenForRequests(kennel) && !membership && grants.size === 0) throw ApiError.notFound('Kennel not found');

  const pendingCount = grants.has('membership.review')
    ? await prisma.membership.count({ where: { kennelId: kennel.id, status: { in: PENDING } } })
    : 0;

  return {
    kennel: summary,
    signedIn: true,
    membership,
    canRequest: eligibility.ok,
    reason: eligibility.ok ? null : eligibility.message,
    permissions: [...grants.keys()],
    pendingCount,
  };
}

// FR-MEMBER-001
export async function requestMembership(
  actor: Actor,
  slug: string,
  input: { type: MembershipType; message?: string | null },
) {
  const kennel = await findKennel(slug);
  const eligibility = await checkEligibility(actor.id, kennel);
  if (!eligibility.ok) throw ApiError.conflict(eligibility.message, eligibility.code);

  const note = input.message?.trim() || null;

  return prisma.$transaction(
    async (tx) => {
      // Re-checked inside a serializable transaction so a double tap cannot
      // create two requests.
      const open = await tx.membership.findFirst({
        where: { userId: actor.id, kennelId: kennel.id, status: { in: OPEN } },
        select: { id: true },
      });
      if (open) throw ApiError.conflict('You already have a request or membership with this kennel.', 'REQUEST_PENDING');

      const membership = await tx.membership.create({
        data: {
          userId: actor.id,
          kennelId: kennel.id,
          type: input.type,
          status: S.PENDING_REVIEW,
          timeline: {
            create: { type: MembershipTimelineType.REQUESTED, toStatus: S.PENDING_REVIEW, actorId: actor.id, note },
          },
        },
        select: ownMembershipSelect,
      });

      const event = await recordEvent(tx, {
        eventType: 'MembershipRequested',
        aggregateType: 'Membership',
        aggregateId: membership.id,
        actorId: actor.id,
        payload: { kennelId: kennel.id, userId: actor.id, type: input.type },
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: 'membership.request',
        resourceType: 'Membership',
        resourceId: membership.id,
        kennelId: kennel.id,
        newState: { status: S.PENDING_REVIEW, type: input.type },
        policyRef: 'self',
        domainEventId: event.id,
      });
      return membership;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

// ─── Officer-facing ───

export async function listMembers(
  actor: Actor,
  slug: string,
  opts: { status?: MembershipStatus; q?: string; page: number; limit: number },
) {
  const kennel = await findKennel(slug);
  await assertKennelPermission(actor, kennel.id, 'membership.review');

  const status = opts.status ?? S.PENDING_REVIEW;
  const pending = PENDING.includes(status);
  const q = opts.q?.trim();

  const where: Prisma.MembershipWhereInput = {
    kennelId: kennel.id,
    status: { in: pending ? PENDING : [status] },
    ...(q
      ? {
          user: {
            OR: [
              { hashHandle: { contains: q, mode: 'insensitive' } },
              { person: { firstName: { contains: q, mode: 'insensitive' } } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.membership.findMany({
      where,
      select: memberSelect,
      // Oldest request first, so nobody waits forever at the bottom of the list.
      orderBy: pending ? { createdAt: 'asc' } : { updatedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.membership.count({ where }),
  ]);
  const items = rows.map(serializeMember);

  // What each of them does in this kennel, in two queries rather than two per
  // row. An office is a seat with a title; a role is a standing job (D32).
  const userIds = items.map((m) => m.member.id);
  const [appointments, assignments] = await prisma.$transaction([
    prisma.officerAppointment.findMany({
      where: { kennelId: kennel.id, userId: { in: userIds }, status: RoleAssignmentStatus.ACTIVE },
      orderBy: { position: { sortOrder: 'asc' } },
      select: { id: true, userId: true, positionId: true, position: { select: { title: true } } },
    }),
    prisma.roleAssignment.findMany({
      // Run-scoped roles (hare, co-hare) belong to their run, not to the roll.
      where: {
        kennelId: kennel.id,
        userId: { in: userIds },
        status: RoleAssignmentStatus.ACTIVE,
        runId: null,
      },
      select: { id: true, userId: true, role: true, title: true },
    }),
  ]);

  const byUser = new Map(items.map((m) => [m.member.id, m]));
  for (const a of appointments) {
    byUser.get(a.userId)?.offices.push({ appointmentId: a.id, positionId: a.positionId, title: a.position.title });
  }
  for (const r of assignments) {
    byUser.get(r.userId)?.roles.push({ assignmentId: r.id, role: r.role, title: r.title });
  }

  return page(items, total, opts.page, opts.limit);
}

export async function timeline(actor: Actor, membershipId: string) {
  if (!isUuid(membershipId)) throw ApiError.notFound('Membership not found');
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { userId: true, kennelId: true },
  });
  if (!membership) throw ApiError.notFound('Membership not found');
  if (membership.userId !== actor.id) await assertKennelPermission(actor, membership.kennelId, 'membership.review');

  const entries = await prisma.membershipTimelineEntry.findMany({
    where: { membershipId },
    orderBy: { occurredAt: 'asc' },
  });
  const actorIds = [...new Set(entries.map((e) => e.actorId).filter((id): id is string => Boolean(id)))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, hashHandle: true, person: { select: { firstName: true } } },
  });
  const names = new Map(actors.map((a) => [a.id, displayName(a.hashHandle, a.person?.firstName)]));

  const items = entries.map((e) => ({
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    note: e.note,
    occurredAt: e.occurredAt,
    actor: e.actorId ? { displayName: names.get(e.actorId) ?? 'A hasher' } : null,
  }));
  return page(items, items.length, 1, Math.max(items.length, 1));
}

// ─── Transitions (Ch.22 A.2) ───

interface TransitionSpec {
  from: MembershipStatus[];
  to: MembershipStatus;
  // 'self' means only the member themself may do it.
  authority: KennelPermission | 'self';
  timeline: MembershipTimelineType;
  eventType: string;
  action: string;
  verb: string;
  endsMembership?: boolean;
}

const T = MembershipTimelineType;

const SPECS = {
  approve: {
    from: PENDING,
    to: S.ACTIVE,
    authority: 'membership.review',
    timeline: T.APPROVED,
    eventType: 'MembershipApproved',
    action: 'membership.approve',
    verb: 'approve',
  },
  reject: {
    from: PENDING,
    to: S.REJECTED,
    authority: 'membership.review',
    timeline: T.REJECTED,
    eventType: 'MembershipRejected',
    action: 'membership.reject',
    verb: 'reject',
    endsMembership: true,
  },
  suspend: {
    from: [S.ACTIVE, S.INACTIVE],
    to: S.SUSPENDED,
    authority: 'membership.suspend',
    timeline: T.SUSPENSION,
    eventType: 'MembershipSuspended',
    action: 'membership.suspend',
    verb: 'suspend',
  },
  reinstate: {
    from: [S.SUSPENDED, S.INACTIVE],
    to: S.ACTIVE,
    authority: 'membership.suspend',
    timeline: T.REINSTATEMENT,
    eventType: 'MembershipReinstated',
    action: 'membership.reinstate',
    verb: 'reinstate',
  },
  remove: {
    from: [S.ACTIVE, S.INACTIVE, S.SUSPENDED],
    to: S.REMOVED,
    authority: 'membership.remove',
    timeline: T.REMOVAL,
    eventType: 'MembershipRemoved',
    action: 'membership.remove',
    verb: 'remove',
    endsMembership: true,
  },
  // D52: an applicant taking back their own still-open request. Distinct from
  // reject (an officer decision) and resign (leaving an active membership) —
  // withdrawing never starts the reapply cooldown (D20).
  withdraw: {
    from: PENDING,
    to: S.WITHDRAWN,
    authority: 'self',
    timeline: T.WITHDRAWAL,
    eventType: 'MembershipRequestWithdrawn',
    action: 'membership.withdraw',
    verb: 'withdraw',
    endsMembership: true,
  },
  // Suspended members cannot resign their way out of a suspension.
  resign: {
    from: [S.ACTIVE, S.INACTIVE],
    to: S.RESIGNED,
    authority: 'self',
    timeline: T.RESIGNATION,
    eventType: 'MembershipResigned',
    action: 'membership.resign',
    verb: 'leave',
    endsMembership: true,
  },
} satisfies Record<string, TransitionSpec>;

// FR-MEMBER-014: officer roles are handed over before a membership ends.
async function assertNoHeldRoles(userId: string, kennelId: string, self: boolean) {
  const [appointments, roles] = await Promise.all([
    prisma.officerAppointment.count({ where: { userId, kennelId, status: { in: HELD_ROLE } } }),
    prisma.roleAssignment.count({ where: { userId, kennelId, status: { in: HELD_ROLE } } }),
  ]);
  if (appointments + roles > 0) {
    throw ApiError.conflict(
      self
        ? 'Hand over your officer and kennel roles before leaving the kennel.'
        : 'This hasher still holds officer or kennel roles. Those must be handed over first.',
      'OFFICER_ROLES_HELD',
    );
  }
}

async function transition(
  actor: Actor,
  membershipId: string,
  spec: TransitionSpec,
  opts: {
    note?: string | null;
    data?: Prisma.MembershipUncheckedUpdateManyInput;
    payload?: Record<string, string | null>;
  } = {},
) {
  if (!isUuid(membershipId)) throw ApiError.notFound('Membership not found');
  const current = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, status: true, type: true, userId: true, kennelId: true },
  });
  if (!current) throw ApiError.notFound('Membership not found');

  let policyRef: string;
  if (spec.authority === 'self') {
    if (current.userId !== actor.id) throw ApiError.forbidden('Only the member can do this.', 'NOT_YOUR_MEMBERSHIP');
    policyRef = 'self';
  } else {
    policyRef = await assertKennelPermission(actor, current.kennelId, spec.authority);
    // Separation of duties (08L-05): nobody decides on their own membership.
    if (current.userId === actor.id) {
      throw ApiError.forbidden("You can't make this decision about your own membership.", 'SELF_DECISION');
    }
  }

  if (!spec.from.includes(current.status)) {
    throw ApiError.conflict(
      `Can't ${spec.verb} a membership that is ${statusWords[current.status]}.`,
      'INVALID_TRANSITION',
    );
  }

  if (spec.to === S.RESIGNED || spec.to === S.REMOVED) {
    await assertNoHeldRoles(current.userId, current.kennelId, spec.authority === 'self');
  }

  const now = new Date();
  const note = opts.note?.trim() || null;

  return prisma.$transaction(async (tx) => {
    // Guarded on the status we read, so two officers deciding at once cannot
    // overwrite each other.
    const { count } = await tx.membership.updateMany({
      where: { id: current.id, status: current.status },
      data: {
        ...opts.data,
        status: spec.to,
        ...(spec.endsMembership ? { endDate: now, isHomeKennel: false } : {}),
      },
    });
    if (count === 0) {
      throw ApiError.conflict(
        'This membership changed while you were looking at it. Refresh and try again.',
        'STALE_MEMBERSHIP',
      );
    }

    if (spec.endsMembership) {
      // An ended membership stops being the home kennel; the old home kennel
      // remains in membership history (FR-MEMBER-007).
      await tx.user.updateMany({
        where: { id: current.userId, homeKennelId: current.kennelId },
        data: { homeKennelId: null },
      });
    }

    // FR-MEMBER-010: timeline entries are append-only.
    await tx.membershipTimelineEntry.create({
      data: {
        membershipId: current.id,
        type: spec.timeline,
        fromStatus: current.status,
        toStatus: spec.to,
        actorId: actor.id,
        note,
      },
    });

    const updated = await tx.membership.findUniqueOrThrow({ where: { id: current.id }, select: memberSelect });

    const event = await recordEvent(tx, {
      eventType: spec.eventType,
      aggregateType: 'Membership',
      aggregateId: current.id,
      actorId: actor.id,
      payload: {
        kennelId: current.kennelId,
        userId: current.userId,
        fromStatus: current.status,
        toStatus: spec.to,
        type: updated.type,
        ...opts.payload,
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: spec.action,
      resourceType: 'Membership',
      resourceId: current.id,
      kennelId: current.kennelId,
      previousState: { status: current.status, type: current.type },
      newState: { status: spec.to, type: updated.type },
      reason: note,
      policyRef,
      domainEventId: event.id,
    });

    return serializeMember(updated);
  });
}

// FR-MEMBER-002
export function approve(actor: Actor, id: string, input: { type?: MembershipType; notes?: string | null }) {
  const now = new Date();
  return transition(actor, id, SPECS.approve, {
    note: input.notes,
    data: {
      approvedById: actor.id,
      approvedAt: now,
      startDate: now,
      approvalNotes: input.notes?.trim() || null,
      ...(input.type ? { type: input.type } : {}),
    },
  });
}

export function reject(actor: Actor, id: string, input: { notes?: string | null }) {
  return transition(actor, id, SPECS.reject, {
    note: input.notes,
    data: { approvalNotes: input.notes?.trim() || null },
  });
}

// FR-MEMBER-008
export function suspend(actor: Actor, id: string, input: { reason: string; until?: Date | null }) {
  return transition(actor, id, SPECS.suspend, {
    note: input.reason,
    data: { suspensionReason: input.reason.trim(), suspendedUntil: input.until ?? null },
    payload: { suspendedUntil: input.until ? input.until.toISOString() : null },
  });
}

// FR-MEMBER-009: the original start date and history are preserved.
export function reinstate(actor: Actor, id: string, input: { notes?: string | null }) {
  return transition(actor, id, SPECS.reinstate, {
    note: input.notes,
    data: { suspensionReason: null, suspendedUntil: null },
  });
}

// FR-MEMBER-015
export function remove(actor: Actor, id: string, input: { reason: string }) {
  return transition(actor, id, SPECS.remove, { note: input.reason });
}

// FR-MEMBER-014
export function resign(actor: Actor, id: string, input: { reason?: string | null }) {
  return transition(actor, id, SPECS.resign, { note: input.reason });
}

// D52
export function withdraw(actor: Actor, id: string, input: { reason?: string | null }) {
  return transition(actor, id, SPECS.withdraw, { note: input.reason });
}
