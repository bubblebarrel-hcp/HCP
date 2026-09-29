import { ChalkSymbol, Prisma, ReleaseMode, RunStatus, TrailStatus, TrailStyle, WaypointKind } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { logger } from '../utils/logger';
import { type Actor, resolveKennelContext } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { canView, getAccess, publicName, userPublicSelect, viewableAccess } from './run.service';

// Trail Studio (Annex 08F, Ch.22 A.4). The rule that shapes this whole file:
// route geometry, waypoints, beer checks, chalk, notes and hazards are NEVER
// serialized to anyone but a planner until the trail is released (BR-TRAIL-005).

const T = TrailStatus;

const PLANNING_STATES: TrailStatus[] = [T.DRAFT, T.PLANNING, T.REVIEW];
const EDITABLE_STATES: TrailStatus[] = [...PLANNING_STATES];
const RELEASED_STATES: TrailStatus[] = [T.RELEASED, T.LIVE, T.COMPLETED, T.ARCHIVED, T.HISTORIC];

// Run states in order, for "has the run reached ..." checks.
const RUN_ORDER: RunStatus[] = [
  RunStatus.DRAFT,
  RunStatus.SCHEDULED,
  RunStatus.PLANNING,
  RunStatus.TRAIL_HIDDEN,
  RunStatus.TRAIL_RELEASED,
  RunStatus.CHECK_IN_OPEN,
  RunStatus.LIVE,
  RunStatus.CIRCLE,
  RunStatus.REPORTING,
  RunStatus.ARCHIVED,
];

function runReached(status: RunStatus, target: RunStatus) {
  const from = RUN_ORDER.indexOf(status);
  return from >= 0 && from >= RUN_ORDER.indexOf(target);
}

export const trailStatusWords: Record<TrailStatus, string> = {
  IDEA: 'an idea',
  DRAFT: 'a draft',
  PLANNING: 'in planning',
  REVIEW: 'in review',
  LOCKED: 'locked',
  HIDDEN: 'hidden',
  RELEASED: 'released',
  LIVE: 'live',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
  HISTORIC: 'historic',
};

// ─── Access ───

const trailSelect = {
  id: true,
  runId: true,
  name: true,
  style: true,
  status: true,
  estimatedDistanceM: true,
  estimatedDurationMin: true,
  terrain: true,
  notes: true,
  routeGeoJson: true,
  startLatitude: true,
  startLongitude: true,
  finishLatitude: true,
  finishLongitude: true,
  releaseMode: true,
  releaseAt: true,
  releasedAt: true,
  lockedAt: true,
  safetyReviewedAt: true,
  createdAt: true,
  updatedAt: true,
  hares: { orderBy: { isLead: 'desc' }, select: { isLead: true, user: { select: userPublicSelect } } },
} satisfies Prisma.TrailSelect;

type TrailRow = Prisma.TrailGetPayload<{ select: typeof trailSelect }>;

export interface TrailAccess {
  trail: TrailRow;
  // Plan and edit: the trail's hares, the run's hares, or kennel officers with
  // trail.manage / run.manage (08F-06 permission matrix).
  canPlan: boolean;
  // Lock, hide and release: the lead hare or an officer.
  canRelease: boolean;
  canArchive: boolean;
  isLead: boolean;
  // Secret detail is visible to planners always, and to everyone once released.
  canSeeSecret: boolean;
  kennelId: string;
  runStatus: RunStatus;
}

async function loadAccess(actor: Actor | undefined, trailId: string): Promise<TrailAccess> {
  if (!isUuid(trailId)) throw ApiError.notFound('Trail not found');
  const trail = await prisma.trail.findUnique({ where: { id: trailId }, select: trailSelect });
  if (!trail) throw ApiError.notFound('Trail not found');

  const runAccess = await getAccess(actor, trail.runId);
  if (!canView(runAccess)) throw ApiError.notFound('Trail not found');

  const hares = await prisma.trailHare.findMany({ where: { trailId }, select: { userId: true, isLead: true } });
  const isTrailHare = actor ? hares.some((h) => h.userId === actor.id) : false;
  const isLead = actor ? hares.some((h) => h.userId === actor.id && h.isLead) : false;
  const officer = runAccess.grants.has('trail.manage') || Boolean(runAccess.canManage);

  const canPlan = isTrailHare || runAccess.isHare || officer;
  const released = Boolean(trail.releasedAt) || RELEASED_STATES.includes(trail.status);

  return {
    trail,
    canPlan,
    canRelease: isLead || officer,
    canArchive: officer,
    isLead,
    canSeeSecret: canPlan || released,
    kennelId: runAccess.run.kennelId,
    runStatus: runAccess.run.status,
  };
}

async function plannerAccess(actor: Actor, trailId: string) {
  const access = await loadAccess(actor, trailId);
  if (!access.canPlan) {
    throw ApiError.forbidden('Only this trail’s hares and kennel officers can plan it.', 'TRAIL_ROLE_REQUIRED');
  }
  return access;
}

function assertEditable(access: TrailAccess) {
  if (!EDITABLE_STATES.includes(access.trail.status)) {
    throw ApiError.conflict(
      `This trail can't be edited while it is ${trailStatusWords[access.trail.status]}.`,
      'TRAIL_NOT_EDITABLE',
    );
  }
}

// ─── Release ───

// Release stays server-authoritative (D6/D12, Ch.22 B.3): the condition is
// evaluated here, never on a device. Checked lazily on read so a scheduled
// release lands the instant someone opens the trail even between sweeps;
// sweepDueReleases (below) is the background job that makes it land for
// everyone else too, without anyone having loaded a page.
async function autoReleaseIfDue(access: TrailAccess): Promise<TrailAccess> {
  const { trail, runStatus } = access;
  if (trail.releasedAt || trail.status !== T.HIDDEN) return access;

  const now = new Date();
  const due =
    (trail.releaseMode === ReleaseMode.SCHEDULED && trail.releaseAt !== null && trail.releaseAt <= now) ||
    (trail.releaseMode === ReleaseMode.CHECK_IN && runReached(runStatus, RunStatus.CHECK_IN_OPEN)) ||
    (trail.releaseMode === ReleaseMode.AT_RUN_START && runReached(runStatus, RunStatus.LIVE));
  if (!due) return access;

  await release(trail.id, null, access.kennelId, trail.releaseMode, 'Release condition met', now);
  return { ...access, trail: { ...trail, status: T.RELEASED, releasedAt: now }, canSeeSecret: true };
}

async function release(
  trailId: string,
  actorId: string | null,
  kennelId: string,
  releaseMode: ReleaseMode,
  reason: string,
  now: Date,
) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.trail.updateMany({
      where: { id: trailId, releasedAt: null },
      data: { status: T.RELEASED, releasedAt: now, releasedById: actorId },
    });
    if (count === 0) return;
    const event = await recordEvent(tx, {
      eventType: 'TrailReleased',
      aggregateType: 'Trail',
      aggregateId: trailId,
      actorId,
      payload: { releaseMode, trigger: reason },
    });
    await recordAudit(tx, {
      actorId,
      action: 'trail.release',
      resourceType: 'Trail',
      resourceId: trailId,
      kennelId,
      previousState: { status: T.HIDDEN },
      newState: { status: T.RELEASED, releaseMode },
      reason,
      policyRef: actorId ? 'hare-or-officer' : 'system',
      domainEventId: event.id,
    });
  });
}

// A background sweep for the same condition autoReleaseIfDue checks lazily.
// Both stay: this is what makes a release land without anyone loading the
// trail page first (the gap CODEX/TODO.md named); the lazy check on read
// still catches anything in the gap between sweeps. MANUAL is deliberately
// absent from `due` — that mode only ever moves on a hare's or officer's
// explicit action.
export async function sweepDueReleases(now = new Date()) {
  const rows = await prisma.trail.findMany({
    where: { status: T.HIDDEN, releasedAt: null },
    select: {
      id: true,
      releaseMode: true,
      releaseAt: true,
      run: { select: { kennelId: true, status: true } },
    },
  });

  let released = 0;
  for (const row of rows) {
    const due =
      (row.releaseMode === ReleaseMode.SCHEDULED && row.releaseAt !== null && row.releaseAt <= now) ||
      (row.releaseMode === ReleaseMode.CHECK_IN && runReached(row.run.status, RunStatus.CHECK_IN_OPEN)) ||
      (row.releaseMode === ReleaseMode.AT_RUN_START && runReached(row.run.status, RunStatus.LIVE));
    if (!due) continue;
    await release(row.id, null, row.run.kennelId, row.releaseMode, 'Release condition met', now);
    released++;
  }
  if (released > 0) logger.info?.('Trail releases swept', { released, considered: rows.length });
  return { considered: rows.length, released };
}

// ─── Serialization ───

function serializeHares(hares: TrailRow['hares']) {
  return hares.map((h) => ({ userId: h.user.id, isLead: h.isLead, displayName: publicName(h.user) }));
}

// What anyone who can see the run may know before release: that a trail exists,
// how long it is and when it opens. Never where it goes.
function publicShape(access: TrailAccess) {
  const { trail } = access;
  return {
    id: trail.id,
    runId: trail.runId,
    name: trail.name,
    style: trail.style,
    status: trail.status,
    estimatedDistanceM: trail.estimatedDistanceM,
    estimatedDurationMin: trail.estimatedDurationMin,
    terrain: trail.terrain,
    releaseMode: trail.releaseMode,
    releaseAt: trail.releaseAt,
    releasedAt: trail.releasedAt,
    lockedAt: trail.lockedAt,
    safetyReviewedAt: trail.safetyReviewedAt,
    createdAt: trail.createdAt,
    hares: serializeHares(trail.hares),
    isReleased: Boolean(trail.releasedAt),
    viewer: {
      canPlan: access.canPlan,
      canRelease: access.canRelease,
      canArchive: access.canArchive,
      canSeeSecret: access.canSeeSecret,
      isLead: access.isLead,
    },
  };
}

async function secretShape(access: TrailAccess) {
  const { trail } = access;
  const [waypoints, beerChecks, chalk] = await Promise.all([
    prisma.waypoint.findMany({
      where: { trailId: trail.id, deletedAt: null },
      orderBy: { sequence: 'asc' },
      select: { id: true, kind: true, label: true, latitude: true, longitude: true, sequence: true, notes: true },
    }),
    prisma.beerCheck.findMany({
      where: { trailId: trail.id, deletedAt: null },
      orderBy: { sequence: 'asc' },
      select: { id: true, name: true, latitude: true, longitude: true, sequence: true, notes: true },
    }),
    prisma.digitalChalkSymbol.findMany({
      where: { trailId: trail.id, deletedAt: null },
      orderBy: { placedAt: 'asc' },
      select: {
        id: true,
        symbol: true,
        customLabel: true,
        latitude: true,
        longitude: true,
        bearingDeg: true,
        sequence: true,
        placedAt: true,
        placedBy: { select: userPublicSelect },
      },
    }),
  ]);

  return {
    notes: trail.notes,
    routeGeoJson: trail.routeGeoJson,
    startLatitude: trail.startLatitude,
    startLongitude: trail.startLongitude,
    finishLatitude: trail.finishLatitude,
    finishLongitude: trail.finishLongitude,
    waypoints,
    beerChecks,
    chalk: chalk.map(({ placedBy, ...rest }) => ({ ...rest, placedBy: publicName(placedBy) })),
  };
}

async function serialize(access: TrailAccess) {
  const shape = publicShape(access);
  if (!access.canSeeSecret) return { ...shape, secret: null };
  return { ...shape, secret: await secretShape(access) };
}

// ─── Reads ───

export async function listForRun(actor: Actor | undefined, runId: string) {
  const runAccess = await viewableAccess(actor, runId);
  const rows = await prisma.trail.findMany({
    where: { runId: runAccess.run.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const trails = [];
  for (const row of rows) {
    const access = await autoReleaseIfDue(await loadAccess(actor, row.id));
    trails.push(await serialize(access));
  }
  return page(trails, trails.length, 1, Math.max(trails.length, 1));
}

export async function getTrail(actor: Actor | undefined, trailId: string) {
  const access = await autoReleaseIfDue(await loadAccess(actor, trailId));
  return serialize(access);
}

export async function listRevisions(actor: Actor, trailId: string) {
  const access = await plannerAccess(actor, trailId);
  const rows = await prisma.trailRevision.findMany({
    where: { trailId: access.trail.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, changes: true, reason: true, createdAt: true, editor: { select: userPublicSelect } },
  });
  const items = rows.map(({ editor, ...rest }) => ({ ...rest, editor: publicName(editor) }));
  return page(items, items.length, 1, Math.max(items.length, 1));
}

// ─── Revisions (BR-TRAIL-008) ───

async function recordRevision(
  tx: Prisma.TransactionClient,
  trailId: string,
  editorId: string,
  changes: Prisma.InputJsonValue,
  reason?: string | null,
) {
  await tx.trailRevision.create({ data: { trailId, editorId, changes, reason: reason?.trim() || null } });
  await recordEvent(tx, {
    eventType: 'TrailRevised',
    aggregateType: 'Trail',
    aggregateId: trailId,
    actorId: editorId,
    payload: { changes },
  });
}

// ─── Create and edit ───

export interface TrailInput {
  name?: string;
  style?: TrailStyle;
  estimatedDistanceM?: number | null;
  estimatedDurationMin?: number | null;
  terrain?: string | null;
  notes?: string | null;
  routeGeoJson?: Prisma.InputJsonValue | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  finishLatitude?: number | null;
  finishLongitude?: number | null;
  releaseMode?: ReleaseMode;
  releaseAt?: Date | null;
  hares?: { userId: string; isLead: boolean }[];
}

async function normaliseTrailHares(runId: string, hares: { userId: string; isLead: boolean }[]) {
  if (hares.length === 0) return [];
  const runHares = await prisma.runHare.findMany({ where: { runId }, select: { userId: true } });
  const allowed = new Set(runHares.map((h) => h.userId));
  if (hares.some((h) => !allowed.has(h.userId))) {
    throw ApiError.badRequest("A trail's hares are hares of its run.", 'TRAIL_HARE_NOT_RUN_HARE');
  }
  const leads = hares.filter((h) => h.isLead).length;
  if (leads > 1) throw ApiError.badRequest('A trail has one lead hare.', 'ONE_LEAD_HARE');
  return hares.map((h, i) => ({ userId: h.userId, isLead: leads === 0 ? i === 0 : h.isLead }));
}

export async function createTrail(actor: Actor, runId: string, input: TrailInput) {
  const runAccess = await viewableAccess(actor, runId);
  const officer = runAccess.grants.has('trail.manage') || Boolean(runAccess.canManage);
  if (!runAccess.isHare && !officer) {
    throw ApiError.forbidden("Only the run's hares and kennel officers can create a trail.", 'TRAIL_ROLE_REQUIRED');
  }
  if (runAccess.run.status === RunStatus.CANCELLED || runReached(runAccess.run.status, RunStatus.LIVE)) {
    throw ApiError.conflict('Trails are planned before the run goes live.', 'RUN_NOT_PLANNABLE');
  }

  const name = input.name?.trim() || 'Main Trail';
  const clash = await prisma.trail.findFirst({ where: { runId, name }, select: { id: true } });
  // BR-TRAIL-001: trail names are unique within a run.
  if (clash) throw ApiError.conflict(`This run already has a trail called "${name}".`, 'TRAIL_NAME_TAKEN');

  // The run's hares are the trail's hares unless told otherwise (BR-TRAIL-003).
  const hares =
    input.hares && input.hares.length > 0
      ? await normaliseTrailHares(runId, input.hares)
      : (await prisma.runHare.findMany({ where: { runId }, select: { userId: true, isLead: true } })).map((h) => ({
          userId: h.userId,
          isLead: h.isLead,
        }));

  return prisma.$transaction(async (tx) => {
    const trail = await tx.trail.create({
      data: {
        runId,
        name,
        style: input.style ?? TrailStyle.DEAD_HARE,
        status: T.DRAFT,
        estimatedDistanceM: input.estimatedDistanceM ?? null,
        estimatedDurationMin: input.estimatedDurationMin ?? null,
        terrain: input.terrain?.trim() || null,
        notes: input.notes?.trim() || null,
        releaseMode: input.releaseMode ?? ReleaseMode.AT_RUN_START,
        releaseAt: input.releaseAt ?? null,
        hares: { create: hares.map((h) => ({ userId: h.userId, isLead: h.isLead })) },
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'TrailCreated',
      aggregateType: 'Trail',
      aggregateId: trail.id,
      actorId: actor.id,
      payload: { runId, name, style: trail.style, releaseMode: trail.releaseMode },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'trail.create',
      resourceType: 'Trail',
      resourceId: trail.id,
      kennelId: runAccess.run.kennelId,
      newState: { name, status: trail.status, releaseMode: trail.releaseMode },
      policyRef: runAccess.isHare ? 'hare' : (runAccess.grants.get('trail.manage') ?? runAccess.canManage ?? 'officer'),
      domainEventId: event.id,
    });
    return { id: trail.id };
  });
}

const trackedFields = [
  'name',
  'style',
  'estimatedDistanceM',
  'estimatedDurationMin',
  'terrain',
  'notes',
  'routeGeoJson',
  'startLatitude',
  'startLongitude',
  'finishLatitude',
  'finishLongitude',
  'releaseMode',
  'releaseAt',
] as const;

export async function updateTrail(actor: Actor, trailId: string, input: TrailInput) {
  const access = await plannerAccess(actor, trailId);
  assertEditable(access);
  const before = access.trail;

  if (input.name && input.name.trim() !== before.name) {
    const clash = await prisma.trail.findFirst({
      where: { runId: before.runId, name: input.name.trim(), NOT: { id: trailId } },
      select: { id: true },
    });
    if (clash) throw ApiError.conflict(`This run already has a trail called "${input.name.trim()}".`, 'TRAIL_NAME_TAKEN');
  }

  const next: Record<string, unknown> = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
    ...(input.estimatedDistanceM !== undefined ? { estimatedDistanceM: input.estimatedDistanceM } : {}),
    ...(input.estimatedDurationMin !== undefined ? { estimatedDurationMin: input.estimatedDurationMin } : {}),
    ...(input.terrain !== undefined ? { terrain: input.terrain?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...(input.routeGeoJson !== undefined ? { routeGeoJson: input.routeGeoJson ?? Prisma.DbNull } : {}),
    ...(input.startLatitude !== undefined ? { startLatitude: input.startLatitude } : {}),
    ...(input.startLongitude !== undefined ? { startLongitude: input.startLongitude } : {}),
    ...(input.finishLatitude !== undefined ? { finishLatitude: input.finishLatitude } : {}),
    ...(input.finishLongitude !== undefined ? { finishLongitude: input.finishLongitude } : {}),
    ...(input.releaseMode !== undefined ? { releaseMode: input.releaseMode } : {}),
    ...(input.releaseAt !== undefined ? { releaseAt: input.releaseAt } : {}),
  };

  const changed = trackedFields.filter((field) => field in next);
  const hares = input.hares ? await normaliseTrailHares(before.runId, input.hares) : null;

  if (changed.length === 0 && !hares) return;

  await prisma.$transaction(async (tx) => {
    if (changed.length > 0) await tx.trail.update({ where: { id: trailId }, data: next });

    if (hares) {
      await tx.trailHare.deleteMany({ where: { trailId } });
      for (const hare of hares) await tx.trailHare.create({ data: { trailId, ...hare } });
    }

    // BR-TRAIL-008: the previous value of every changed element is kept. The
    // route itself is not repeated in every revision, only that it changed.
    const changes: Record<string, unknown> = Object.fromEntries(
      changed.map((field) => [
        field,
        {
          from: field === 'routeGeoJson' ? (before.routeGeoJson ? 'route' : null) : (before[field] ?? null),
          to: field === 'routeGeoJson' ? (next.routeGeoJson ? 'route' : null) : (next[field] ?? null),
        },
      ]),
    );
    if (hares) changes.hares = { to: hares.length };
    await recordRevision(tx, trailId, actor.id, changes as Prisma.InputJsonValue);
  });
}

// ─── Trail components ───

async function componentAccess(actor: Actor, trailId: string) {
  const access = await plannerAccess(actor, trailId);
  assertEditable(access);
  return access;
}

export async function addWaypoint(
  actor: Actor,
  trailId: string,
  input: { kind: WaypointKind; label?: string | null; latitude: number; longitude: number; sequence?: number; notes?: string | null },
) {
  const access = await componentAccess(actor, trailId);
  const last = await prisma.waypoint.findFirst({
    where: { trailId, deletedAt: null },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });
  await prisma.$transaction(async (tx) => {
    const waypoint = await tx.waypoint.create({
      data: {
        trailId,
        kind: input.kind,
        label: input.label?.trim() || null,
        latitude: input.latitude,
        longitude: input.longitude,
        sequence: input.sequence ?? (last?.sequence ?? -1) + 1,
        notes: input.notes?.trim() || null,
      },
    });
    await recordRevision(tx, trailId, actor.id, {
      waypointAdded: { id: waypoint.id, kind: waypoint.kind, label: waypoint.label },
    });
  });
  return access;
}

export async function updateWaypoint(
  actor: Actor,
  trailId: string,
  waypointId: string,
  input: Partial<{ kind: WaypointKind; label: string | null; latitude: number; longitude: number; sequence: number; notes: string | null }>,
) {
  await componentAccess(actor, trailId);
  if (!isUuid(waypointId)) throw ApiError.notFound('Waypoint not found');
  const before = await prisma.waypoint.findFirst({ where: { id: waypointId, trailId, deletedAt: null } });
  if (!before) throw ApiError.notFound('Waypoint not found');

  await prisma.$transaction(async (tx) => {
    await tx.waypoint.update({
      where: { id: waypointId },
      data: {
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });
    await recordRevision(tx, trailId, actor.id, {
      waypointChanged: { id: waypointId, from: { kind: before.kind, label: before.label, latitude: before.latitude, longitude: before.longitude } },
    });
  });
}

// Soft delete: the symbol stays in the history (BR-TRAIL-007).
export async function removeWaypoint(actor: Actor, trailId: string, waypointId: string) {
  await componentAccess(actor, trailId);
  if (!isUuid(waypointId)) throw ApiError.notFound('Waypoint not found');
  const before = await prisma.waypoint.findFirst({ where: { id: waypointId, trailId, deletedAt: null } });
  if (!before) throw ApiError.notFound('Waypoint not found');

  await prisma.$transaction(async (tx) => {
    await tx.waypoint.update({ where: { id: waypointId }, data: { deletedAt: new Date() } });
    await recordRevision(tx, trailId, actor.id, {
      waypointRemoved: { id: waypointId, kind: before.kind, label: before.label },
    });
  });
}

export async function addBeerCheck(
  actor: Actor,
  trailId: string,
  input: { name: string; latitude: number; longitude: number; sequence?: number; notes?: string | null },
) {
  await componentAccess(actor, trailId);
  const last = await prisma.beerCheck.findFirst({
    where: { trailId, deletedAt: null },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });
  await prisma.$transaction(async (tx) => {
    const beerCheck = await tx.beerCheck.create({
      data: {
        trailId,
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        sequence: input.sequence ?? (last?.sequence ?? -1) + 1,
        notes: input.notes?.trim() || null,
      },
    });
    await recordRevision(tx, trailId, actor.id, { beerCheckAdded: { id: beerCheck.id, name: beerCheck.name } });
  });
}

export async function updateBeerCheck(
  actor: Actor,
  trailId: string,
  beerCheckId: string,
  input: Partial<{ name: string; latitude: number; longitude: number; sequence: number; notes: string | null }>,
) {
  await componentAccess(actor, trailId);
  if (!isUuid(beerCheckId)) throw ApiError.notFound('Beer check not found');
  const before = await prisma.beerCheck.findFirst({ where: { id: beerCheckId, trailId, deletedAt: null } });
  if (!before) throw ApiError.notFound('Beer check not found');

  await prisma.$transaction(async (tx) => {
    await tx.beerCheck.update({
      where: { id: beerCheckId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });
    await recordRevision(tx, trailId, actor.id, { beerCheckChanged: { id: beerCheckId, from: { name: before.name } } });
  });
}

export async function removeBeerCheck(actor: Actor, trailId: string, beerCheckId: string) {
  await componentAccess(actor, trailId);
  if (!isUuid(beerCheckId)) throw ApiError.notFound('Beer check not found');
  const before = await prisma.beerCheck.findFirst({ where: { id: beerCheckId, trailId, deletedAt: null } });
  if (!before) throw ApiError.notFound('Beer check not found');

  await prisma.$transaction(async (tx) => {
    await tx.beerCheck.update({ where: { id: beerCheckId }, data: { deletedAt: new Date() } });
    await recordRevision(tx, trailId, actor.id, { beerCheckRemoved: { id: beerCheckId, name: before.name } });
  });
}

export async function placeChalk(
  actor: Actor,
  trailId: string,
  input: { symbol: ChalkSymbol; customLabel?: string | null; latitude: number; longitude: number; bearingDeg?: number | null; sequence?: number | null },
) {
  await componentAccess(actor, trailId);
  await prisma.$transaction(async (tx) => {
    const chalk = await tx.digitalChalkSymbol.create({
      data: {
        trailId,
        symbol: input.symbol,
        customLabel: input.customLabel?.trim() || null,
        latitude: input.latitude,
        longitude: input.longitude,
        bearingDeg: input.bearingDeg ?? null,
        sequence: input.sequence ?? null,
        placedById: actor.id,
      },
    });
    await recordEvent(tx, {
      eventType: 'DigitalChalkPlaced',
      aggregateType: 'Trail',
      aggregateId: trailId,
      actorId: actor.id,
      payload: { chalkId: chalk.id, symbol: chalk.symbol },
    });
  });
}

export async function removeChalk(actor: Actor, trailId: string, chalkId: string) {
  await componentAccess(actor, trailId);
  if (!isUuid(chalkId)) throw ApiError.notFound('Chalk mark not found');
  const before = await prisma.digitalChalkSymbol.findFirst({ where: { id: chalkId, trailId, deletedAt: null } });
  if (!before) throw ApiError.notFound('Chalk mark not found');

  await prisma.$transaction(async (tx) => {
    // Deleted symbols are kept, never destroyed (BR-TRAIL-007).
    await tx.digitalChalkSymbol.update({
      where: { id: chalkId },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
    await recordEvent(tx, {
      eventType: 'DigitalChalkRemoved',
      aggregateType: 'Trail',
      aggregateId: trailId,
      actorId: actor.id,
      payload: { chalkId, symbol: before.symbol },
    });
  });
}

// ─── Lifecycle (Ch.22 A.4) ───

interface TrailStep {
  from: TrailStatus[];
  to: TrailStatus;
  authority: 'plan' | 'release' | 'archive';
  events: string[];
  label: string;
}

const STEPS = {
  'start-planning': { from: [T.DRAFT], to: T.PLANNING, authority: 'plan', events: [], label: 'Start planning' },
  'submit-review': { from: [T.PLANNING], to: T.REVIEW, authority: 'plan', events: [], label: 'Send for review' },
  lock: {
    from: [T.REVIEW, T.PLANNING],
    to: T.LOCKED,
    authority: 'release',
    events: ['TrailReviewCompleted', 'TrailLocked'],
    label: 'Lock the trail',
  },
  // Restore Draft is allowed from Locked, never from Hidden or later: secrecy is
  // not silently reversible (Ch.22 A.4).
  'restore-draft': { from: [T.LOCKED], to: T.PLANNING, authority: 'plan', events: [], label: 'Unlock for editing' },
  hide: { from: [T.LOCKED], to: T.HIDDEN, authority: 'release', events: ['TrailHidden'], label: 'Hide the trail' },
  release: { from: [T.HIDDEN], to: T.RELEASED, authority: 'release', events: ['TrailReleased'], label: 'Release the trail' },
  archive: {
    from: [T.COMPLETED, T.RELEASED, T.LIVE],
    to: T.ARCHIVED,
    authority: 'archive',
    events: ['TrailArchived'],
    label: 'Archive the trail',
  },
} satisfies Record<string, TrailStep>;

export type TrailAction = keyof typeof STEPS;

const NEXT_STEP: Partial<Record<TrailStatus, TrailAction>> = {
  DRAFT: 'start-planning',
  PLANNING: 'submit-review',
  REVIEW: 'lock',
  LOCKED: 'hide',
  HIDDEN: 'release',
};

// BR-TRAIL-006: what must be true before a trail can be locked.
function assertReadyToLock(access: TrailAccess) {
  const { trail } = access;
  const problems: string[] = [];
  const route = trail.routeGeoJson as { coordinates?: unknown[] } | null;
  if (!route || !Array.isArray(route.coordinates) || route.coordinates.length < 2) problems.push('draw the route');
  if (trail.startLatitude === null || trail.startLongitude === null) problems.push('set the start');
  if (trail.finishLatitude === null || trail.finishLongitude === null) problems.push('set the finish');
  if (trail.hares.length === 0) problems.push('assign a hare');
  if (trail.releaseMode === ReleaseMode.SCHEDULED && !trail.releaseAt) problems.push('set the release time');
  if (problems.length > 0) {
    throw ApiError.conflict(`Before locking: ${problems.join(', ')}.`, 'TRAIL_NOT_READY');
  }
}

export async function transition(actor: Actor, trailId: string, action: string, input: { reason?: string | null }) {
  if (!Object.prototype.hasOwnProperty.call(STEPS, action)) throw ApiError.notFound('Unknown trail action');
  const spec: TrailStep = STEPS[action as TrailAction];
  const access = await loadAccess(actor, trailId);

  const allowed =
    spec.authority === 'plan' ? access.canPlan : spec.authority === 'release' ? access.canRelease : access.canArchive;
  if (!allowed) {
    throw ApiError.forbidden(
      spec.authority === 'plan'
        ? "Only this trail's hares and kennel officers can do that."
        : spec.authority === 'release'
          ? 'Only the lead hare or a kennel officer can do that.'
          : 'Only a kennel officer can do that.',
      'TRAIL_ROLE_REQUIRED',
    );
  }
  if (!spec.from.includes(access.trail.status)) {
    throw ApiError.conflict(
      `Can't ${spec.label.toLowerCase()} while it is ${trailStatusWords[access.trail.status]}.`,
      'INVALID_TRANSITION',
    );
  }
  if (action === 'lock') assertReadyToLock(access);

  const now = new Date();
  const reason = input.reason?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.trail.updateMany({
      where: { id: trailId, status: access.trail.status },
      data: {
        status: spec.to,
        ...(action === 'lock' ? { lockedAt: now, lockedById: actor.id, safetyReviewedAt: now, safetyReviewedById: actor.id } : {}),
        ...(action === 'restore-draft' ? { lockedAt: null, lockedById: null } : {}),
        ...(action === 'release' ? { releasedAt: now, releasedById: actor.id } : {}),
      },
    });
    if (count === 0) {
      throw ApiError.conflict('This trail changed while you were looking at it. Refresh and try again.', 'STALE_TRAIL');
    }

    let lastEventId: string | null = null;
    for (const eventType of spec.events) {
      const event = await recordEvent(tx, {
        eventType,
        aggregateType: 'Trail',
        aggregateId: trailId,
        actorId: actor.id,
        payload: {
          runId: access.trail.runId,
          fromStatus: access.trail.status,
          toStatus: spec.to,
          ...(action === 'release' ? { releaseMode: access.trail.releaseMode, trigger: 'manual' } : {}),
          ...(reason ? { reason } : {}),
        },
      });
      lastEventId = event.id;
    }

    await recordAudit(tx, {
      actorId: actor.id,
      action: `trail.${action}`,
      resourceType: 'Trail',
      resourceId: trailId,
      kennelId: access.kennelId,
      previousState: { status: access.trail.status },
      newState: { status: spec.to },
      reason,
      policyRef: access.isLead ? 'lead-hare' : access.canPlan ? 'hare-or-officer' : 'officer',
      domainEventId: lastEventId,
    });
  });
}

export function nextStepFor(status: TrailStatus): { action: TrailAction; label: string } | null {
  const action = NEXT_STEP[status];
  return action ? { action, label: STEPS[action].label } : null;
}
