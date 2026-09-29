import {
  CapsuleStatus,
  KennelStatus,
  KennelVisibility,
  MembershipStatus,
  Prisma,
  RoleAssignmentStatus,
  RsvpStatus,
  RunStatus,
  RunType,
  RunVisibility,
  ScopedRole,
} from '@prisma/client';
import prisma from '../config/prisma';
import { displayName } from '../serializers/user';
import { ApiError, isUuid, page } from '../utils/http';
import { isValidTimeZone, utcToZonedWallTime, zonedWallTimeToUtc } from '../utils/time';
import { type Actor, type GrantSource, type KennelPermission, resolveKennelContext } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { syncTrailsWithRun } from './trail-sync.service';

// Runs: visibility, authority and the Chapter 22 A.3 lifecycle (D21, D22).
// Attendance lives in attendance.service.ts and the Circle in circle.service.ts;
// both build on the access helpers exported here.

const R = RunStatus;

export const RSVP_OPEN: RunStatus[] = [R.SCHEDULED, R.PLANNING, R.TRAIL_HIDDEN, R.TRAIL_RELEASED, R.CHECK_IN_OPEN];
export const CHECK_IN_STATES: RunStatus[] = [R.CHECK_IN_OPEN, R.LIVE];
// Hares and officers may correct attendance until the run is archived (BR-RUN-008).
export const CORRECTION_STATES: RunStatus[] = [R.CHECK_IN_OPEN, R.LIVE, R.CIRCLE, R.REPORTING];
export const CIRCLE_STATES: RunStatus[] = [R.CIRCLE, R.REPORTING];
const CANCELLABLE: RunStatus[] = [R.DRAFT, ...RSVP_OPEN];
const MANAGER_EDITABLE: RunStatus[] = [R.DRAFT, ...RSVP_OPEN];
const HARE_EDITABLE: RunStatus[] = [R.DRAFT, R.SCHEDULED, R.PLANNING];
const UPCOMING: RunStatus[] = [...RSVP_OPEN, R.LIVE, R.CIRCLE];
const PAST: RunStatus[] = [R.REPORTING, R.ARCHIVED];

export const statusWords: Record<RunStatus, string> = {
  DRAFT: 'a draft',
  SCHEDULED: 'scheduled',
  PLANNING: 'in planning',
  TRAIL_HIDDEN: 'waiting for trail release',
  TRAIL_RELEASED: 'released',
  CHECK_IN_OPEN: 'open for check-in',
  LIVE: 'live',
  CIRCLE: 'in the Circle',
  REPORTING: 'in reporting',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
};

export const userPublicSelect = {
  id: true,
  hashHandle: true,
  person: { select: { firstName: true } },
} satisfies Prisma.UserSelect;

type UserPublic = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

export function publicName(user: UserPublic) {
  return displayName(user.hashHandle, user.person?.firstName);
}

// ─── Access ───

const runAccessSelect = {
  id: true,
  kennelId: true,
  runNumber: true,
  title: true,
  status: true,
  visibility: true,
  startsAt: true,
  capacity: true,
  allowGuests: true,
  allowVisitors: true,
  isPaused: true,
  // A called-off run is not a run anyone acts on; every access check wants it.
  cancelledAt: true,
  kennel: {
    select: { id: true, name: true, shortName: true, slug: true, status: true, visibility: true, timeZone: true },
  },
  hares: { select: { userId: true, isLead: true } },
} satisfies Prisma.RunSelect;

type RunAccessRow = Prisma.RunGetPayload<{ select: typeof runAccessSelect }>;

export interface RunAccess {
  run: RunAccessRow;
  actor?: Actor;
  isMember: boolean;
  isHare: boolean;
  // Every kennel permission the actor holds here, for callers that need more
  // than run.manage (trail.manage, report.publish, ...).
  grants: Map<KennelPermission, GrantSource>;
  // Grant sources, or null when not held.
  canManage: GrantSource | null;
  canChangeVisibility: GrantSource | null;
  membershipStatus: MembershipStatus | null;
  participation: { id: string; rsvpStatus: RsvpStatus; checkedInAt: Date | null; isVisitor: boolean } | null;
}

export async function getAccess(actor: Actor | undefined, runId: string): Promise<RunAccess> {
  if (!isUuid(runId)) throw ApiError.notFound('Run not found');
  const run = await prisma.run.findUnique({ where: { id: runId }, select: runAccessSelect });
  if (!run) throw ApiError.notFound('Run not found');

  if (!actor) {
    return {
      run,
      isMember: false,
      isHare: false,
      grants: new Map(),
      canManage: null,
      canChangeVisibility: null,
      membershipStatus: null,
      participation: null,
    };
  }

  const [context, participation, membership] = await Promise.all([
    resolveKennelContext(actor, run.kennelId),
    prisma.participation.findUnique({
      where: { runId_userId: { runId: run.id, userId: actor.id } },
      select: { id: true, rsvpStatus: true, checkedInAt: true, isVisitor: true },
    }),
    prisma.membership.findFirst({
      where: { userId: actor.id, kennelId: run.kennelId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    }),
  ]);

  return {
    run,
    actor,
    isMember: context.isMember,
    isHare: run.hares.some((h) => h.userId === actor.id),
    grants: context.grants,
    canManage: context.grants.get('run.manage') ?? null,
    canChangeVisibility: context.grants.get('run.visibility.change') ?? null,
    membershipStatus: membership?.status ?? null,
    participation,
  };
}

// Hares operate their own run; officers with run.manage operate every run of the kennel.
export function canOperate(a: RunAccess) {
  return a.isHare || Boolean(a.canManage);
}

export function operateSource(a: RunAccess): GrantSource {
  return a.canManage ?? 'hare';
}

// PERMISSION-MATRIX "Runs": who may see a run at all.
export function canView(a: RunAccess) {
  const insider = a.isMember || a.isHare || Boolean(a.canManage);
  if (a.run.status === R.DRAFT) return a.isHare || Boolean(a.canManage);
  if (a.run.kennel.visibility === KennelVisibility.HIDDEN && !insider && !a.participation) return false;
  switch (a.run.visibility) {
    case RunVisibility.PUBLIC:
      return true;
    case RunVisibility.MEMBERS_ONLY:
      return insider || Boolean(a.participation);
    case RunVisibility.INVITE_ONLY:
      return a.isHare || Boolean(a.canManage) || Boolean(a.participation);
    default:
      return false;
  }
}

// D23: names of who is going, the Circle record and the run timeline are for the
// hosting kennel's members, the run's hares and its officers.
export function canSeeNames(a: RunAccess) {
  return a.isMember || a.isHare || Boolean(a.canManage);
}

export async function viewableAccess(actor: Actor | undefined, runId: string) {
  const access = await getAccess(actor, runId);
  if (!canView(access)) throw ApiError.notFound('Run not found');
  return access;
}

export async function operatorAccess(actor: Actor, runId: string) {
  const access = await viewableAccess(actor, runId);
  if (!canOperate(access)) {
    throw ApiError.forbidden(
      "Only this run's hares and kennel officers with run permissions can do that.",
      'RUN_ROLE_REQUIRED',
    );
  }
  return access;
}

// ─── Lists ───

const runBaseSelect = {
  id: true,
  runNumber: true,
  title: true,
  runType: true,
  status: true,
  visibility: true,
  startsAt: true,
  timeZone: true,
  meetingPointName: true,
  city: true,
  country: true,
  capacity: true,
  allowGuests: true,
  isPaused: true,
  cancelledAt: true,
  kennel: { select: { id: true, name: true, shortName: true, slug: true, primaryColor: true } },
  hares: { orderBy: { isLead: 'desc' }, select: { isLead: true, user: { select: userPublicSelect } } },
} satisfies Prisma.RunSelect;

const runSummarySelect = {
  ...runBaseSelect,
  _count: { select: { participations: { where: { rsvpStatus: RsvpStatus.GOING } } } },
} satisfies Prisma.RunSelect;

type RunSummaryRow = Prisma.RunGetPayload<{ select: typeof runSummarySelect }>;

function serializeHares(hares: RunSummaryRow['hares']) {
  return hares.map((h) => ({ userId: h.user.id, isLead: h.isLead, displayName: publicName(h.user) }));
}

function serializeSummary({ hares, _count, ...rest }: RunSummaryRow) {
  return { ...rest, hares: serializeHares(hares), goingCount: _count.participations };
}

export async function visibleRunsWhere(actor: Actor | undefined): Promise<Prisma.RunWhereInput> {
  const openKennel: Prisma.KennelWhereInput = {
    status: { not: KennelStatus.ARCHIVED },
    visibility: { not: KennelVisibility.HIDDEN },
  };
  const publicRuns: Prisma.RunWhereInput = { visibility: RunVisibility.PUBLIC, status: { not: R.DRAFT }, kennel: openKennel };
  if (!actor) return publicRuns;

  const memberships = await prisma.membership.findMany({
    where: { userId: actor.id, status: MembershipStatus.ACTIVE },
    select: { kennelId: true },
  });
  const memberKennelIds = memberships.map((m) => m.kennelId);
  const contexts = await Promise.all(memberKennelIds.map((id) => resolveKennelContext(actor, id)));
  const managedKennelIds = memberKennelIds.filter((_, i) => contexts[i].grants.has('run.manage'));

  if (actor.role === 'ADMIN') return {};

  return {
    OR: [
      publicRuns,
      { kennelId: { in: memberKennelIds }, visibility: { not: RunVisibility.INVITE_ONLY }, status: { not: R.DRAFT } },
      { kennelId: { in: managedKennelIds } },
      { hares: { some: { userId: actor.id } } },
      { participations: { some: { userId: actor.id } }, status: { not: R.DRAFT } },
    ],
  };
}

type Scope = 'upcoming' | 'past' | 'drafts';

function scopeWhere(scope: Scope): { where: Prisma.RunWhereInput; orderBy: Prisma.RunOrderByWithRelationInput } {
  const now = new Date();
  if (scope === 'drafts') return { where: { status: R.DRAFT }, orderBy: { startsAt: 'asc' } };
  if (scope === 'past') {
    return {
      where: { OR: [{ status: { in: PAST } }, { status: R.CANCELLED, startsAt: { lt: now } }] },
      orderBy: { startsAt: 'desc' },
    };
  }
  return {
    where: { OR: [{ status: { in: UPCOMING } }, { status: R.CANCELLED, startsAt: { gte: now } }] },
    orderBy: { startsAt: 'asc' },
  };
}

async function listWhere(where: Prisma.RunWhereInput, scope: Scope, pageNum: number, limit: number) {
  const s = scopeWhere(scope);
  const combined: Prisma.RunWhereInput = { AND: [where, s.where] };
  const [rows, total] = await prisma.$transaction([
    prisma.run.findMany({
      where: combined,
      select: runSummarySelect,
      orderBy: s.orderBy,
      skip: (pageNum - 1) * limit,
      take: limit,
    }),
    prisma.run.count({ where: combined }),
  ]);
  return page(rows.map(serializeSummary), total, pageNum, limit);
}

export async function listRuns(actor: Actor | undefined, opts: { scope: Scope; page: number; limit: number }) {
  return listWhere(await visibleRunsWhere(actor), opts.scope, opts.page, opts.limit);
}

async function findKennel(slug: string) {
  const kennel = await prisma.kennel.findFirst({
    where: { slug, status: { not: KennelStatus.ARCHIVED } },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      city: true,
      country: true,
      timeZone: true,
      visibility: true,
      primaryColor: true,
      defaultRunVisibility: true,
    },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

export async function listKennelRuns(
  actor: Actor | undefined,
  slug: string,
  opts: { scope: Scope; page: number; limit: number },
) {
  const kennel = await findKennel(slug);
  const context = actor ? await resolveKennelContext(actor, kennel.id) : null;
  if (kennel.visibility === KennelVisibility.HIDDEN && !context?.isMember && !context?.grants.size) {
    throw ApiError.notFound('Kennel not found');
  }
  const visible = await visibleRunsWhere(actor);
  const result = await listWhere({ AND: [visible, { kennelId: kennel.id }] }, opts.scope, opts.page, opts.limit);
  return {
    ...result,
    kennel: { id: kennel.id, name: kennel.name, shortName: kennel.shortName, slug: kennel.slug, primaryColor: kennel.primaryColor },
    canPlan: Boolean(context?.grants.has('run.manage')),
  };
}

// ─── Detail ───

const LIFECYCLE_EVENTS = [
  'RunCreated',
  'RunScheduled',
  'RunPlanningStarted',
  'RunPlanningLocked',
  'TrailHidden',
  'TrailReleased',
  'CheckInOpened',
  'RunStarted',
  'RunPaused',
  'RunResumed',
  'RunEnded',
  'CircleClosed',
  'CircleSkipped',
  'RunArchived',
  'RunCancelled',
];

type Check = { ok: true } | { ok: false; code: string; message: string };
const allow: Check = { ok: true };
const deny = (code: string, message: string): Check => ({ ok: false, code, message });

// Visitors may join PUBLIC runs that allow visitors. A suspended member of the
// hosting kennel does not hash there as a "visitor".
export function visitorCheck(a: RunAccess): Check {
  if (a.membershipStatus === MembershipStatus.SUSPENDED) {
    return deny('MEMBERSHIP_SUSPENDED', `Your membership of ${a.run.kennel.shortName} is suspended.`);
  }
  if (a.isMember || a.isHare || a.canManage) return allow;
  if (a.run.visibility !== RunVisibility.PUBLIC || !a.run.allowVisitors) {
    return deny('MEMBERS_ONLY', `This run is for members of ${a.run.kennel.shortName}.`);
  }
  return allow;
}

export function rsvpWindowCheck(a: RunAccess): Check {
  if (a.run.status === R.CANCELLED) return deny('RUN_CANCELLED', 'This run was cancelled.');
  if (!RSVP_OPEN.includes(a.run.status)) return deny('RSVP_CLOSED', 'RSVPs are closed for this run.');
  return allow;
}

type StepAuthority = 'manage' | 'operate';

interface StepSpec {
  from: RunStatus[];
  to?: RunStatus;
  authority: StepAuthority;
  events: string[];
  label: string;
  reasonRequired?: boolean;
}

// Chapter 22 A.3, one step at a time. Pause/resume are the Live sub-state;
// cancel is the D22 exit before the run goes live.
const STEPS = {
  schedule: { from: [R.DRAFT], to: R.SCHEDULED, authority: 'manage', events: ['RunScheduled'], label: 'Publish run' },
  'start-planning': {
    from: [R.SCHEDULED],
    to: R.PLANNING,
    authority: 'operate',
    events: ['RunPlanningStarted'],
    label: 'Start planning',
  },
  'hide-trail': {
    from: [R.PLANNING],
    to: R.TRAIL_HIDDEN,
    authority: 'operate',
    events: ['RunPlanningLocked', 'TrailHidden'],
    label: 'Lock planning and hide the trail',
  },
  'release-trail': {
    from: [R.TRAIL_HIDDEN],
    to: R.TRAIL_RELEASED,
    authority: 'operate',
    events: ['TrailReleased'],
    label: 'Release the trail',
  },
  'open-check-in': {
    from: [R.TRAIL_RELEASED],
    to: R.CHECK_IN_OPEN,
    authority: 'operate',
    events: ['CheckInOpened'],
    label: 'Open check-in',
  },
  start: { from: [R.CHECK_IN_OPEN], to: R.LIVE, authority: 'operate', events: ['RunStarted'], label: 'Start the run' },
  end: { from: [R.LIVE], to: R.CIRCLE, authority: 'operate', events: ['RunEnded'], label: 'End the run and start the Circle' },
  'close-circle': {
    from: [R.CIRCLE],
    to: R.REPORTING,
    authority: 'operate',
    events: ['CircleClosed'],
    label: 'Close the Circle',
  },
  'skip-circle': {
    from: [R.CIRCLE],
    to: R.REPORTING,
    authority: 'manage',
    events: ['CircleSkipped'],
    label: 'Skip the Circle',
    reasonRequired: true,
  },
  archive: { from: [R.REPORTING], to: R.ARCHIVED, authority: 'manage', events: ['RunArchived'], label: 'Archive the run' },
  cancel: {
    from: CANCELLABLE,
    to: R.CANCELLED,
    authority: 'manage',
    events: ['RunCancelled'],
    label: 'Cancel the run',
    reasonRequired: true,
  },
  pause: { from: [R.LIVE], authority: 'operate', events: ['RunPaused'], label: 'Pause the run', reasonRequired: true },
  resume: { from: [R.LIVE], authority: 'operate', events: ['RunResumed'], label: 'Resume the run' },
} satisfies Record<string, StepSpec>;

export type RunAction = keyof typeof STEPS;

const NEXT_STEP: Partial<Record<RunStatus, RunAction>> = {
  DRAFT: 'schedule',
  SCHEDULED: 'start-planning',
  PLANNING: 'hide-trail',
  TRAIL_HIDDEN: 'release-trail',
  TRAIL_RELEASED: 'open-check-in',
  CHECK_IN_OPEN: 'start',
  LIVE: 'end',
  CIRCLE: 'close-circle',
  REPORTING: 'archive',
};

function holdsAuthority(a: RunAccess, spec: StepSpec) {
  return spec.authority === 'manage' ? Boolean(a.canManage) : canOperate(a);
}

export async function getRunDetail(actor: Actor | undefined, runId: string) {
  const a = await viewableAccess(actor, runId);
  const names = canSeeNames(a);

  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    select: {
      ...runBaseSelect,
      description: true,
      theme: true,
      meetingAddress: true,
      meetingLatitude: true,
      meetingLongitude: true,
      hashCash: true,
      posterUrl: true,
      allowVisitors: true,
      scheduledAt: true,
      trailReleasedAt: true,
      checkInOpenedAt: true,
      startedAt: true,
      endedAt: true,
      archivedAt: true,
      cancelReason: true,
      circleSkipReason: true,
      createdAt: true,
      kennel: {
        select: { id: true, name: true, shortName: true, slug: true, primaryColor: true, timeZone: true, downDownsEnabled: true },
      },
      pauses: { orderBy: { pausedAt: 'asc' }, select: { pausedAt: true, resumedAt: true, reason: true } },
      circle: {
        select: {
          startedAt: true,
          endedAt: true,
          songs: true,
          announcements: true,
          notes: true,
          awards: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              title: true,
              reason: true,
              isDownDown: true,
              recipientName: true,
              recipientUser: { select: userPublicSelect },
              recipientGuest: { select: { firstName: true } },
            },
          },
        },
      },
      participations: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          rsvpStatus: true,
          isVisitor: true,
          isVirginRun: true,
          homeKennelId: true,
          checkInMethod: true,
          checkedInAt: true,
          user: { select: userPublicSelect },
          guest: { select: { firstName: true, email: true, phone: true } },
        },
      },
    },
  });

  const { participations, hares, pauses, circle, ...rest } = run;
  // D23: a guest holds no account, so a hare who needs to reach one on trail
  // has no other channel. Kept tighter than the roster itself (canSeeNames,
  // below) — every member sees who is coming, only whoever actually operates
  // the run sees how to reach a guest.
  const canContactGuests = canOperate(a);
  const counts = {
    going: participations.filter((p) => p.rsvpStatus === RsvpStatus.GOING).length,
    maybe: participations.filter((p) => p.rsvpStatus === RsvpStatus.MAYBE).length,
    checkedIn: participations.filter((p) => p.checkedInAt).length,
    visitors: participations.filter((p) => p.isVisitor && (p.rsvpStatus === RsvpStatus.GOING || p.checkedInAt)).length,
    guests: participations.filter((p) => p.guest && (p.rsvpStatus === RsvpStatus.GOING || p.checkedInAt)).length,
  };

  let participants: unknown[] | null = null;
  let timeline: unknown[] | null = null;
  if (names) {
    // BR-RUN-009: the home kennel is the one snapshotted at RSVP time.
    const homeIds = [...new Set(participations.map((p) => p.homeKennelId).filter((id): id is string => Boolean(id)))];
    const homes = await prisma.kennel.findMany({ where: { id: { in: homeIds } }, select: { id: true, shortName: true } });
    const homeName = new Map(homes.map((k) => [k.id, k.shortName]));

    participants = participations
      .filter((p) => p.checkedInAt || p.rsvpStatus === RsvpStatus.GOING || p.rsvpStatus === RsvpStatus.MAYBE)
      .map((p) => ({
        id: p.id,
        kind: p.guest ? 'guest' : 'hasher',
        displayName: p.user ? publicName(p.user) : `${p.guest?.firstName ?? 'A'} (guest)`,
        rsvpStatus: p.rsvpStatus,
        isVisitor: p.isVisitor,
        isVirginRun: p.isVirginRun,
        homeKennel: p.homeKennelId ? (homeName.get(p.homeKennelId) ?? null) : null,
        checkedInAt: p.checkedInAt,
        checkInMethod: p.checkInMethod,
        contact: canContactGuests && p.guest ? { email: p.guest.email, phone: p.guest.phone } : null,
      }));

    const events = await prisma.domainEvent.findMany({
      where: { aggregateType: 'Run', aggregateId: runId, eventType: { in: LIFECYCLE_EVENTS } },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, eventType: true, occurredAt: true, actorId: true, payload: true },
    });
    const actorIds = [...new Set(events.map((e) => e.actorId).filter((id): id is string => Boolean(id)))];
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: userPublicSelect });
    const actorName = new Map(actors.map((u) => [u.id, publicName(u)]));
    timeline = events.map((e) => ({
      id: e.id,
      type: e.eventType,
      occurredAt: e.occurredAt,
      actor: e.actorId ? (actorName.get(e.actorId) ?? null) : null,
      reason: (e.payload as { reason?: string } | null)?.reason ?? null,
    }));
  }

  // ─── What this viewer may do ───
  const operate = canOperate(a);
  const manage = Boolean(a.canManage);
  const full = Boolean(run.capacity && counts.going >= run.capacity);

  let rsvp: Check = a.actor ? rsvpWindowCheck(a) : deny('SIGN_IN_REQUIRED', 'Log in to RSVP.');
  if (rsvp.ok && a.participation?.checkedInAt) rsvp = deny('ALREADY_CHECKED_IN', 'You are checked in.');
  if (rsvp.ok) rsvp = visitorCheck(a);
  const goingBlocked =
    rsvp.ok && full && a.participation?.rsvpStatus !== RsvpStatus.GOING ? 'This run is full.' : null;

  let checkIn: Check = a.actor ? allow : deny('SIGN_IN_REQUIRED', 'Log in to check in.');
  if (checkIn.ok && !CHECK_IN_STATES.includes(run.status)) checkIn = deny('CHECK_IN_CLOSED', 'Check-in is not open.');
  if (checkIn.ok) checkIn = visitorCheck(a);

  const nextAction = NEXT_STEP[run.status];
  const nextSpec: StepSpec | undefined = nextAction ? STEPS[nextAction] : undefined;

  return {
    ...rest,
    startsAtLocal: utcToZonedWallTime(run.startsAt, run.timeZone),
    hares: serializeHares(hares),
    counts,
    pauses,
    circle: names && circle
      ? {
          ...circle,
          awards: circle.awards.map(({ recipientUser, recipientGuest, ...award }) => ({
            ...award,
            recipient: recipientUser
              ? publicName(recipientUser)
              : recipientGuest
                ? `${recipientGuest.firstName} (guest)`
                : award.recipientName,
          })),
        }
      : null,
    participants,
    timeline,
    viewer: {
      signedIn: Boolean(a.actor),
      isMember: a.isMember,
      isHare: a.isHare,
      canSeeNames: names,
      participation: a.participation,
      canRespond: rsvp.ok,
      rsvpBlockedReason: rsvp.ok ? null : rsvp.message,
      goingBlockedReason: goingBlocked,
      canCheckIn: checkIn.ok && !a.participation?.checkedInAt,
      checkInBlockedReason: checkIn.ok ? null : checkIn.message,
      canRegisterAsGuest:
        !a.actor &&
        run.visibility === RunVisibility.PUBLIC &&
        a.run.kennel.visibility !== KennelVisibility.HIDDEN &&
        run.allowGuests &&
        RSVP_OPEN.includes(run.status) &&
        !full,
      canManage: manage,
      canOperate: operate,
      canChangeVisibility: Boolean(a.canChangeVisibility),
      canEdit: operate && (manage ? MANAGER_EDITABLE : HARE_EDITABLE).includes(run.status),
      nextStep: nextAction && nextSpec && holdsAuthority(a, nextSpec) ? { action: nextAction, label: nextSpec.label } : null,
      canPause: operate && run.status === R.LIVE && !run.isPaused,
      canResume: operate && run.status === R.LIVE && run.isPaused,
      canCancel: manage && CANCELLABLE.includes(run.status),
      canSkipCircle: manage && run.status === R.CIRCLE,
      canRecordCircle: operate && CIRCLE_STATES.includes(run.status),
      canCorrectAttendance: operate && CORRECTION_STATES.includes(run.status),
      canAddGuest: operate && [...RSVP_OPEN, ...CORRECTION_STATES].includes(run.status),
    },
  };
}

// ─── Planning: create and edit ───

export async function planningContext(actor: Actor, slug: string) {
  const kennel = await findKennel(slug);
  const context = await resolveKennelContext(actor, kennel.id);
  if (!context.grants.has('run.manage')) {
    throw ApiError.forbidden('Planning runs needs the run.manage permission in this kennel.', 'KENNEL_PERMISSION_REQUIRED');
  }
  const [last, members] = await Promise.all([
    prisma.run.findFirst({ where: { kennelId: kennel.id }, orderBy: { runNumber: 'desc' }, select: { runNumber: true } }),
    prisma.membership.findMany({
      where: { kennelId: kennel.id, status: MembershipStatus.ACTIVE },
      select: { user: { select: userPublicSelect } },
      take: 500,
    }),
  ]);
  return {
    kennel: {
      id: kennel.id,
      name: kennel.name,
      shortName: kennel.shortName,
      slug: kennel.slug,
      timeZone: kennel.timeZone,
      defaultRunVisibility: kennel.defaultRunVisibility,
    },
    nextRunNumber: (last?.runNumber ?? 0) + 1,
    canChangeVisibility: context.grants.has('run.visibility.change'),
    members: members
      .map((m) => ({ userId: m.user.id, hashHandle: m.user.hashHandle, displayName: publicName(m.user) }))
      .sort((x, y) => x.displayName.localeCompare(y.displayName)),
  };
}

export interface RunInput {
  runNumber?: number;
  title?: string;
  description?: string | null;
  theme?: string | null;
  runType?: RunType;
  visibility?: RunVisibility;
  startsAtLocal?: string;
  timeZone?: string;
  meetingPointName?: string;
  meetingAddress?: string | null;
  capacity?: number | null;
  allowGuests?: boolean;
  allowVisitors?: boolean;
  hashCash?: string | null;
  // The kennel flyer for this run (D43).
  posterUrl?: string | null;
  hares?: { userId: string; isLead: boolean }[];
}

const clean = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() || null);

// D21: hares are active members of the hosting kennel, with exactly one lead.
async function normaliseHares(kennelId: string, hares: { userId: string; isLead: boolean }[]) {
  if (hares.length === 0) return [];
  const active = await prisma.membership.findMany({
    where: { kennelId, status: MembershipStatus.ACTIVE, userId: { in: hares.map((h) => h.userId) } },
    select: { userId: true },
  });
  const members = new Set(active.map((m) => m.userId));
  if (hares.some((h) => !members.has(h.userId))) {
    throw ApiError.badRequest('Hares must be active members of the kennel.', 'HARE_NOT_MEMBER');
  }
  const leads = hares.filter((h) => h.isLead).length;
  if (leads > 1) throw ApiError.badRequest('A run has one lead hare.', 'ONE_LEAD_HARE');
  return hares.map((h, i) => ({ userId: h.userId, isLead: leads === 0 ? i === 0 : h.isLead }));
}

async function assertRunNumberFree(kennelId: string, runNumber: number, shortName: string, excludeId?: string) {
  const clash = await prisma.run.findFirst({
    where: { kennelId, runNumber, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw ApiError.conflict(`Run #${runNumber} already exists in ${shortName}.`, 'RUN_NUMBER_TAKEN');
}

export async function createRun(actor: Actor, slug: string, input: RunInput) {
  const kennel = await findKennel(slug);
  const context = await resolveKennelContext(actor, kennel.id);
  const policyRef = context.grants.get('run.manage');
  if (!policyRef) {
    throw ApiError.forbidden('Planning runs needs the run.manage permission in this kennel.', 'KENNEL_PERMISSION_REQUIRED');
  }

  // D3/D13: the kennel default applies unless the planner may set run privacy.
  const visibility = input.visibility ?? kennel.defaultRunVisibility;
  if (visibility !== kennel.defaultRunVisibility && !context.grants.has('run.visibility.change')) {
    throw ApiError.forbidden("You can't change this run's visibility.", 'VISIBILITY_PERMISSION_REQUIRED');
  }

  const timeZone = input.timeZone ?? kennel.timeZone;
  if (!isValidTimeZone(timeZone)) throw ApiError.badRequest(`Unknown time zone "${timeZone}".`, 'VALIDATION_ERROR');
  const startsAt = zonedWallTimeToUtc(input.startsAtLocal!, timeZone);
  const hares = await normaliseHares(kennel.id, input.hares ?? []);

  let runNumber = input.runNumber;
  if (!runNumber) {
    const last = await prisma.run.findFirst({ where: { kennelId: kennel.id }, orderBy: { runNumber: 'desc' }, select: { runNumber: true } });
    runNumber = (last?.runNumber ?? 0) + 1;
  }
  await assertRunNumberFree(kennel.id, runNumber, kennel.shortName);

  return prisma.$transaction(async (tx) => {
    const run = await tx.run.create({
      data: {
        kennelId: kennel.id,
        runNumber: runNumber!,
        title: input.title!.trim(),
        description: clean(input.description) ?? null,
        theme: clean(input.theme) ?? null,
        runType: input.runType ?? RunType.REGULAR,
        status: R.DRAFT,
        visibility,
        startsAt,
        timeZone,
        meetingPointName: input.meetingPointName!.trim(),
        meetingAddress: clean(input.meetingAddress) ?? null,
        country: kennel.country,
        city: kennel.city,
        capacity: input.capacity ?? null,
        allowGuests: input.allowGuests ?? true,
        allowVisitors: input.allowVisitors ?? true,
        hashCash: clean(input.hashCash) ?? null,
        posterUrl: clean(input.posterUrl) ?? null,
        createdById: actor.id,
      },
    });
    // Ch.23: the capsule exists from the start and is finalised at archive.
    const capsule = await tx.runCapsule.create({ data: { runId: run.id, status: CapsuleStatus.PLANNED } });

    const created = await recordEvent(tx, {
      eventType: 'RunCreated',
      aggregateType: 'Run',
      aggregateId: run.id,
      actorId: actor.id,
      payload: { kennelId: kennel.id, runNumber: run.runNumber, visibility, startsAt: startsAt.toISOString() },
    });
    await recordEvent(tx, {
      eventType: 'RunCapsuleCreated',
      aggregateType: 'RunCapsule',
      aggregateId: capsule.id,
      actorId: null,
      payload: { runId: run.id },
    });
    for (const hare of hares) await addHare(tx, actor.id, run.id, kennel.id, hare);

    await recordAudit(tx, {
      actorId: actor.id,
      action: 'run.create',
      resourceType: 'Run',
      resourceId: run.id,
      kennelId: kennel.id,
      newState: { runNumber: run.runNumber, status: run.status, visibility, startsAt: startsAt.toISOString() },
      policyRef,
      domainEventId: created.id,
    });
    return { id: run.id };
  });
}

// FR-RUN-003: RoleAssignment keeps the hare history; RunHare is the current
// roster. Exported because accepting a hare offer (D44) must land exactly here:
// one place writes a hare, so one place emits HareAssigned.
export async function addHare(
  tx: Prisma.TransactionClient,
  actorId: string,
  runId: string,
  kennelId: string,
  hare: { userId: string; isLead: boolean },
) {
  await tx.runHare.create({ data: { runId, userId: hare.userId, isLead: hare.isLead } });
  await tx.roleAssignment.create({
    data: {
      userId: hare.userId,
      role: hare.isLead ? ScopedRole.HARE : ScopedRole.CO_HARE,
      runId,
      kennelId,
      grantedById: actorId,
    },
  });
  await recordEvent(tx, {
    eventType: 'HareAssigned',
    aggregateType: 'Run',
    aggregateId: runId,
    actorId,
    payload: { userId: hare.userId, isLead: hare.isLead },
  });
}

async function endHare(tx: Prisma.TransactionClient, actorId: string, runId: string, userId: string, now: Date) {
  await tx.runHare.delete({ where: { runId_userId: { runId, userId } } });
  await tx.roleAssignment.updateMany({
    where: { runId, userId, status: RoleAssignmentStatus.ACTIVE },
    data: { status: RoleAssignmentStatus.REVOKED, endDate: now },
  });
  await recordEvent(tx, { eventType: 'HareRemoved', aggregateType: 'Run', aggregateId: runId, actorId, payload: { userId } });
}

const editableSelect = {
  runNumber: true,
  title: true,
  description: true,
  theme: true,
  runType: true,
  visibility: true,
  startsAt: true,
  timeZone: true,
  meetingPointName: true,
  meetingAddress: true,
  capacity: true,
  allowGuests: true,
  allowVisitors: true,
  hashCash: true,
  posterUrl: true,
} satisfies Prisma.RunSelect;

export async function updateRun(actor: Actor, runId: string, input: RunInput) {
  const a = await operatorAccess(actor, runId);
  const editable = a.canManage ? MANAGER_EDITABLE : HARE_EDITABLE;
  if (!editable.includes(a.run.status)) {
    throw ApiError.conflict(`This run can't be edited while it is ${statusWords[a.run.status]}.`, 'RUN_NOT_EDITABLE');
  }

  const before = await prisma.run.findUniqueOrThrow({ where: { id: runId }, select: editableSelect });

  if (input.hares && !a.canManage) {
    throw ApiError.forbidden('Only kennel officers with run permissions choose the hares.', 'KENNEL_PERMISSION_REQUIRED');
  }
  if (input.visibility && input.visibility !== before.visibility && !a.canChangeVisibility) {
    // D13: hares change run privacy only through a delegation.
    throw ApiError.forbidden("You can't change this run's visibility.", 'VISIBILITY_PERMISSION_REQUIRED');
  }
  if (input.runNumber && input.runNumber !== before.runNumber) {
    if (!a.canManage) throw ApiError.forbidden('Only kennel officers renumber runs.', 'KENNEL_PERMISSION_REQUIRED');
    await assertRunNumberFree(a.run.kennelId, input.runNumber, a.run.kennel.shortName, runId);
  }

  const timeZone = input.timeZone ?? before.timeZone;
  if (input.timeZone && !isValidTimeZone(timeZone)) throw ApiError.badRequest(`Unknown time zone "${timeZone}".`, 'VALIDATION_ERROR');
  const startsAt =
    input.startsAtLocal || input.timeZone
      ? zonedWallTimeToUtc(input.startsAtLocal ?? utcToZonedWallTime(before.startsAt, before.timeZone), timeZone)
      : undefined;

  const next: Prisma.RunUncheckedUpdateInput = {
    ...(input.runNumber !== undefined ? { runNumber: input.runNumber } : {}),
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: clean(input.description) } : {}),
    ...(input.theme !== undefined ? { theme: clean(input.theme) } : {}),
    ...(input.runType !== undefined ? { runType: input.runType } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(startsAt ? { startsAt, timeZone } : {}),
    ...(input.meetingPointName !== undefined ? { meetingPointName: input.meetingPointName.trim() } : {}),
    ...(input.meetingAddress !== undefined ? { meetingAddress: clean(input.meetingAddress) } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.allowGuests !== undefined ? { allowGuests: input.allowGuests } : {}),
    ...(input.allowVisitors !== undefined ? { allowVisitors: input.allowVisitors } : {}),
    ...(input.hashCash !== undefined ? { hashCash: clean(input.hashCash) } : {}),
    ...(input.posterUrl !== undefined ? { posterUrl: clean(input.posterUrl) } : {}),
  };

  const serialise = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
  const changed = (Object.keys(next) as (keyof typeof before)[]).filter(
    (k) => JSON.stringify(serialise(next[k as keyof typeof next])) !== JSON.stringify(serialise(before[k])),
  );

  let hares: { userId: string; isLead: boolean }[] | null = null;
  if (input.hares) {
    hares = await normaliseHares(a.run.kennelId, input.hares);
    if (hares.length === 0 && a.run.status !== R.DRAFT) {
      throw ApiError.badRequest('A published run needs at least one hare (BR-RUN-003).', 'HARE_REQUIRED');
    }
  }
  const current = new Map(a.run.hares.map((h) => [h.userId, h.isLead]));
  const wanted = new Map((hares ?? []).map((h) => [h.userId, h.isLead]));
  const haresChanged =
    hares !== null && (current.size !== wanted.size || [...wanted].some(([id, lead]) => current.get(id) !== lead));

  if (changed.length === 0 && !haresChanged) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updateData = Object.fromEntries(changed.map((k) => [k, next[k as keyof typeof next]]));
    if (changed.includes('startsAt')) Object.assign(updateData, { timeZone });
    if (changed.length > 0) await tx.run.update({ where: { id: runId }, data: updateData });

    if (haresChanged) {
      for (const [userId, lead] of current) {
        // A lead/co-hare swap ends the old role and starts the new one.
        if (!wanted.has(userId) || wanted.get(userId) !== lead) await endHare(tx, actor.id, runId, userId, now);
      }
      for (const [userId, lead] of wanted) {
        if (!current.has(userId) || current.get(userId) !== lead) {
          await addHare(tx, actor.id, runId, a.run.kennelId, { userId, isLead: lead });
        }
      }
    }

    const event = await recordEvent(tx, {
      eventType: 'RunUpdated',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { fields: haresChanged ? [...changed, 'hares'] : changed },
    });
    // FR-RUNPLAN-015: field, previous value, new value, user, time.
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'run.update',
      resourceType: 'Run',
      resourceId: runId,
      kennelId: a.run.kennelId,
      previousState: Object.fromEntries(
        changed.map((k) => [k, serialise(before[k]) as Prisma.InputJsonValue]),
      ) as Prisma.InputJsonObject,
      newState: Object.fromEntries(
        changed.map((k) => [k, serialise(next[k as keyof typeof next]) as Prisma.InputJsonValue]),
      ) as Prisma.InputJsonObject,
      policyRef: operateSource(a),
      domainEventId: event.id,
    });
  });
}

// ─── Lifecycle transitions ───

export async function transition(actor: Actor, runId: string, action: string, input: { reason?: string | null }) {
  if (!Object.prototype.hasOwnProperty.call(STEPS, action)) throw ApiError.notFound('Unknown run action');
  const spec: StepSpec = STEPS[action as RunAction];
  const a = await viewableAccess(actor, runId);

  if (!holdsAuthority(a, spec)) {
    throw ApiError.forbidden(
      spec.authority === 'manage'
        ? 'Only kennel officers with run permissions can do that.'
        : "Only this run's hares and kennel officers with run permissions can do that.",
      spec.authority === 'manage' ? 'KENNEL_PERMISSION_REQUIRED' : 'RUN_ROLE_REQUIRED',
    );
  }
  if (!spec.from.includes(a.run.status)) {
    throw ApiError.conflict(
      `Can't ${spec.label.toLowerCase()} while the run is ${statusWords[a.run.status]}.`,
      'INVALID_TRANSITION',
    );
  }

  const reason = input.reason?.trim() || null;
  if (spec.reasonRequired && (!reason || reason.length < 3)) {
    throw ApiError.badRequest('Give a reason of at least 3 characters.', 'REASON_REQUIRED');
  }
  if (action === 'pause' && a.run.isPaused) throw ApiError.conflict('The run is already paused.', 'ALREADY_PAUSED');
  if (action === 'resume' && !a.run.isPaused) throw ApiError.conflict('The run is not paused.', 'NOT_PAUSED');
  if (action === 'schedule') {
    if (a.run.hares.length === 0) {
      throw ApiError.conflict('Add at least one hare before publishing the run (BR-RUN-003).', 'HARE_REQUIRED');
    }
    if (a.run.startsAt <= new Date()) {
      throw ApiError.conflict('The start time is in the past. Update it before publishing.', 'START_IN_PAST');
    }
  }

  const now = new Date();
  const policyRef = spec.authority === 'manage' ? a.canManage! : operateSource(a);
  const toStatus = spec.to ?? a.run.status;

  const data: Prisma.RunUncheckedUpdateManyInput = { ...(spec.to ? { status: spec.to } : {}) };
  switch (action) {
    case 'schedule':
      data.scheduledAt = now;
      break;
    case 'release-trail':
      data.trailReleasedAt = now;
      break;
    case 'open-check-in':
      data.checkInOpenedAt = now;
      break;
    case 'start':
      data.startedAt = now;
      break;
    case 'end':
      data.endedAt = now;
      data.isPaused = false;
      break;
    case 'skip-circle':
      data.circleSkipReason = reason;
      data.circleSkippedById = actor.id;
      break;
    case 'archive':
      data.archivedAt = now;
      break;
    case 'cancel':
      data.cancelledAt = now;
      data.cancelReason = reason;
      data.cancelledById = actor.id;
      break;
    case 'pause':
      data.isPaused = true;
      break;
    case 'resume':
      data.isPaused = false;
      break;
  }

  await prisma.$transaction(async (tx) => {
    // Guarded on what we read, so two hares tapping at once cannot double-advance.
    const { count } = await tx.run.updateMany({
      where: {
        id: runId,
        status: a.run.status,
        ...(action === 'pause' ? { isPaused: false } : action === 'resume' ? { isPaused: true } : {}),
      },
      data,
    });
    if (count === 0) {
      throw ApiError.conflict('This run changed while you were looking at it. Refresh and try again.', 'STALE_RUN');
    }

    if (action === 'pause') await tx.runPause.create({ data: { runId, reason, actorId: actor.id } });
    if (action === 'resume' || (action === 'end' && a.run.isPaused)) {
      await tx.runPause.updateMany({ where: { runId, resumedAt: null }, data: { resumedAt: now } });
    }
    if (action === 'end') {
      await tx.circle.upsert({ where: { runId }, create: { runId, startedAt: now }, update: { startedAt: now } });
    }
    if (action === 'close-circle' || action === 'skip-circle') {
      await tx.circle.upsert({ where: { runId }, create: { runId, endedAt: now }, update: { endedAt: now } });
    }

    // D22: the capsule follows the run (Ch.22 A.6 Planned → Preparing → Live → Draft).
    const capsuleStatus: Partial<Record<string, CapsuleStatus>> = {
      schedule: CapsuleStatus.PREPARING,
      start: CapsuleStatus.LIVE,
      end: CapsuleStatus.DRAFT,
      // Ch.22 A.6: once the run is archived the capsule is ready for a human to
      // publish it. It never publishes itself.
      archive: CapsuleStatus.PENDING_PUBLICATION,
    };
    if (capsuleStatus[action]) {
      // Published, Archived and Legacy capsules are history and never reopen
      // (Ch.22 A.6 invalid transitions), so the sync only moves a capsule that
      // is still assembling.
      await tx.runCapsule.updateMany({
        where: {
          runId,
          status: {
            in: [
              CapsuleStatus.PLANNED,
              CapsuleStatus.PREPARING,
              CapsuleStatus.LIVE,
              CapsuleStatus.DRAFT,
              CapsuleStatus.PENDING_PUBLICATION,
            ],
          },
        },
        data: { status: capsuleStatus[action] },
      });
    }

    // Opening check-in or starting the run can meet a trail's release condition;
    // ending and archiving close the trail out (Ch.22 A.4).
    await syncTrailsWithRun(tx, runId, action, actor.id, now);

    let lastEventId: string | null = null;
    for (const eventType of spec.events) {
      const event = await recordEvent(tx, {
        eventType,
        aggregateType: 'Run',
        aggregateId: runId,
        actorId: actor.id,
        payload: {
          kennelId: a.run.kennelId,
          runNumber: a.run.runNumber,
          fromStatus: a.run.status,
          toStatus,
          ...(reason ? { reason } : {}),
        },
      });
      lastEventId = event.id;
    }

    if (action === 'archive') {
      // BR-RUN-008: attendance is immutable once archived.
      await tx.participation.updateMany({ where: { runId, lockedAt: null }, data: { lockedAt: now } });
      // FR-CAPSULE-003: the capsule keeps the run's timeline. It is assembled by
      // services/capsule.service.ts from the same domain events, so it has one
      // owner and one shape rather than two writers disagreeing (D30).
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: `run.${action}`,
      resourceType: 'Run',
      resourceId: runId,
      kennelId: a.run.kennelId,
      previousState: { status: a.run.status, isPaused: a.run.isPaused },
      newState: {
        status: toStatus,
        isPaused: action === 'pause' ? true : action === 'resume' || action === 'end' ? false : a.run.isPaused,
      },
      reason,
      policyRef,
      domainEventId: lastEventId,
    });
  });
}
