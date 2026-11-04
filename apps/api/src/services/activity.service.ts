import { ActivityKind, Audience, Prisma, TrailStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { computeStats, trimTrackEnds, type TrackPoint } from '../utils/activity-math';
import { canSeeAudience, contentVisibleAuthors } from './audience.service';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';

// A hasher's recorded runs (D79).
//
// The phone sends its raw GPS fixes; this service works out time, distance, pace,
// splits and climb from them and stores the result with the cleaned track. A
// recording belongs to the hasher and follows the D57 audience scale. Two things
// narrow it further for everyone but the hasher: a run whose trail has not been
// released is invisible (a hare's own track is the trail), and the first and last
// 200 m of every track are cut (that is where people live).

const RELEASED: TrailStatus[] = [
  TrailStatus.RELEASED,
  TrailStatus.LIVE,
  TrailStatus.COMPLETED,
  TrailStatus.ARCHIVED,
  TrailStatus.HISTORIC,
];

// A recording shorter than this is a mis-tap, not a run.
const MIN_DISTANCE_M = 50;
const MIN_MOVING_S = 10;
// A phone that was offline can upload late, but not forever, and not from the future.
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 24 * 3600 * 1000;
// How many points a list card gets to draw the shape of the route.
const PREVIEW_POINTS = 40;

export interface ActivityInput {
  clientId: string;
  kind: ActivityKind;
  runId?: string | null;
  trailId?: string | null;
  title?: string | null;
  notes?: string | null;
  audience?: Audience;
  points: TrackPoint[];
}

type Track = [number, number, number | null, number][];

const summarySelect = {
  id: true,
  userId: true,
  kind: true,
  runId: true,
  trailId: true,
  title: true,
  notes: true,
  startedAt: true,
  endedAt: true,
  elapsedTimeS: true,
  movingTimeS: true,
  distanceM: true,
  avgPaceSPerKm: true,
  elevationGainM: true,
  elevationLossM: true,
  audience: true,
  createdAt: true,
} satisfies Prisma.RunActivitySelect;

const detailSelect = { ...summarySelect, track: true, splits: true } satisfies Prisma.RunActivitySelect;

type Row = Prisma.RunActivityGetPayload<{ select: typeof detailSelect }>;

function downsample(track: Track, max: number): Track {
  if (track.length <= max) return track;
  const out: Track = [];
  for (let i = 0; i < max; i++) out.push(track[Math.round((i * (track.length - 1)) / (max - 1))]);
  return out;
}

// What a viewer is handed. The owner gets the track whole; anyone else gets it
// trimmed at both ends.
function serialize(row: Row, isOwner: boolean, withTrack: boolean) {
  const full = row.track as unknown as Track;
  const track = isOwner ? full : trimTrackEnds(full);
  const { track: _t, splits, ...rest } = row;
  return {
    ...rest,
    isOwner,
    // The route's shape for a list card.
    preview: downsample(track, PREVIEW_POINTS).map(([lat, lng]) => [lat, lng]),
    ...(withTrack ? { track, splits: splits as unknown } : {}),
  };
}

// Of these runs, the ones with a trail not yet released. No trail, nothing to hide.
async function runsWithSecretTrail(runIds: string[]) {
  const unreleased = new Set<string>();
  if (runIds.length === 0) return unreleased;
  const trails = await prisma.trail.findMany({
    where: { runId: { in: runIds } },
    select: { runId: true, releasedAt: true, status: true },
  });
  for (const t of trails) {
    if (!t.releasedAt && !RELEASED.includes(t.status)) unreleased.add(t.runId);
  }
  return unreleased;
}

// ─── Record ───

async function assertCanAttach(actor: Actor, input: ActivityInput) {
  if (input.kind === ActivityKind.SOLO) {
    if (input.runId || input.trailId) throw ApiError.badRequest('A solo run is tied to no hash run.', 'ACTIVITY_SOLO_HAS_RUN');
    return { runId: null, trailId: null };
  }
  if (!input.runId || !isUuid(input.runId)) throw ApiError.badRequest('Say which run this was.', 'ACTIVITY_RUN_REQUIRED');

  if (input.kind === ActivityKind.HASH_RUN) {
    if (input.trailId) throw ApiError.badRequest('Only a hare’s recording is tied to a trail.', 'ACTIVITY_TRAIL_NOT_ALLOWED');
    const taking = await prisma.participation.findFirst({ where: { runId: input.runId, userId: actor.id }, select: { id: true } });
    if (!taking) throw ApiError.notFound('Run not found');
    return { runId: input.runId, trailId: null };
  }

  // TRAIL_LAYING: only a hare of this run.
  const hare = await prisma.runHare.findUnique({
    where: { runId_userId: { runId: input.runId, userId: actor.id } },
    select: { userId: true },
  });
  const trailHare = await prisma.trailHare.findFirst({
    where: { userId: actor.id, trail: { runId: input.runId, ...(input.trailId ? { id: input.trailId } : {}) } },
    select: { trailId: true },
  });
  if (!hare && !trailHare) throw ApiError.notFound('Run not found');
  const trailId =
    trailHare?.trailId ??
    (await prisma.trail.findFirst({ where: { runId: input.runId }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ??
    null;
  if (input.trailId && trailId !== input.trailId) throw ApiError.notFound('Trail not found');
  return { runId: input.runId, trailId };
}

export async function recordActivity(actor: Actor, input: ActivityInput) {
  const existing = await prisma.runActivity.findUnique({
    where: { userId_clientId: { userId: actor.id, clientId: input.clientId } },
    select: detailSelect,
  });
  if (existing) return { activity: serialize(existing, true, true), created: false };

  const stats = computeStats(input.points);
  if (stats.distanceM < MIN_DISTANCE_M || stats.movingTimeS < MIN_MOVING_S) {
    throw ApiError.badRequest('That recording is too short to keep.', 'ACTIVITY_TOO_SHORT');
  }
  const now = Date.now();
  if (stats.endedAtMs > now + MAX_FUTURE_MS || stats.startedAtMs < now - MAX_AGE_MS) {
    throw ApiError.badRequest('That recording’s clock is out of range.', 'ACTIVITY_CLOCK');
  }
  if (stats.endedAtMs - stats.startedAtMs > MAX_DURATION_MS) {
    throw ApiError.badRequest('A recording can be at most 24 hours.', 'ACTIVITY_TOO_LONG');
  }

  const { runId, trailId } = await assertCanAttach(actor, input);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.runActivity.create({
      data: {
        userId: actor.id,
        kind: input.kind,
        runId,
        trailId,
        clientId: input.clientId,
        title: input.title?.trim() || null,
        notes: input.notes?.trim() || null,
        audience: input.audience ?? Audience.FOLLOWERS,
        startedAt: new Date(stats.startedAtMs),
        endedAt: new Date(stats.endedAtMs),
        elapsedTimeS: stats.elapsedTimeS,
        movingTimeS: stats.movingTimeS,
        distanceM: stats.distanceM,
        avgPaceSPerKm: stats.avgPaceSPerKm,
        elevationGainM: stats.elevationGainM,
        elevationLossM: stats.elevationLossM,
        track: stats.track as unknown as Prisma.InputJsonValue,
        splits: stats.splits as unknown as Prisma.InputJsonValue,
      },
      select: detailSelect,
    });
    // Numbers only: a coordinate never travels in an event.
    await recordEvent(tx, {
      eventType: 'RunActivityRecorded',
      aggregateType: 'RunActivity',
      aggregateId: created.id,
      actorId: actor.id,
      payload: { userId: actor.id, kind: created.kind, runId, distanceM: created.distanceM, movingTimeS: created.movingTimeS },
    });
    return created;
  });

  return { activity: serialize(row, true, true), created: true };
}

// ─── Read ───

export async function getActivity(actor: Actor | undefined, id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Recording not found');
  const row = await prisma.runActivity.findFirst({ where: { id, deletedAt: null }, select: detailSelect });
  if (!row) throw ApiError.notFound('Recording not found');

  const isOwner = actor?.id === row.userId;
  if (!isOwner) {
    // 404, never 403: a recording you may not see does not exist (D50).
    if (!(await canSeeAudience(actor, row.userId, row.audience))) throw ApiError.notFound('Recording not found');
    if (row.runId && (await runsWithSecretTrail([row.runId])).has(row.runId)) throw ApiError.notFound('Recording not found');
  }
  return serialize(row, isOwner, true);
}

export async function listMine(actor: Actor, query: { page: number; limit: number; runId?: string; kind?: ActivityKind }) {
  const where: Prisma.RunActivityWhereInput = {
    userId: actor.id,
    deletedAt: null,
    ...(query.runId ? { runId: query.runId } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.runActivity.count({ where }),
    prisma.runActivity.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: detailSelect,
    }),
  ]);
  return page(rows.map((r) => serialize(r, true, false)), total, query.page, query.limit);
}

// What a hasher's profile or Passport shows to a visitor: the recordings this
// viewer may see, newest first.
export async function listForHasher(actor: Actor | undefined, userId: string, query: { page: number; limit: number }) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  const isOwner = actor?.id === userId;
  if (!isOwner && !(await contentVisibleAuthors(actor, [userId])).has(userId)) {
    return page([], 0, query.page, query.limit);
  }

  const audiences: Audience[] = isOwner ? [Audience.PUBLIC, Audience.FOLLOWERS, Audience.ONLY_ME] : [Audience.PUBLIC];
  if (!isOwner && (await canSeeAudience(actor, userId, Audience.FOLLOWERS))) audiences.push(Audience.FOLLOWERS);

  const rows = await prisma.runActivity.findMany({
    where: { userId, deletedAt: null, audience: { in: audiences } },
    orderBy: { startedAt: 'desc' },
    select: detailSelect,
  });

  // Runs whose trail is still secret are left out for everyone but the hasher.
  const hidden = isOwner ? new Set<string>() : await runsWithSecretTrail([...new Set(rows.map((r) => r.runId).filter((r): r is string => Boolean(r)))]);
  const visible = rows.filter((r) => !r.runId || !hidden.has(r.runId));

  const start = (query.page - 1) * query.limit;
  return page(visible.slice(start, start + query.limit).map((r) => serialize(r, isOwner, false)), visible.length, query.page, query.limit);
}

// ─── Change ───

export async function updateActivity(
  actor: Actor,
  id: string,
  patch: { title?: string | null; notes?: string | null; audience?: Audience },
) {
  const current = await ownActivity(actor, id);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.runActivity.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
        ...(patch.audience ? { audience: patch.audience } : {}),
      },
      select: detailSelect,
    });
    await recordEvent(tx, {
      eventType: 'RunActivityUpdated',
      aggregateType: 'RunActivity',
      aggregateId: id,
      actorId: actor.id,
      payload: { userId: actor.id, audienceFrom: current.audience, audienceTo: updated.audience },
    });
    return updated;
  });
  return serialize(row, true, true);
}

// The row stays (history is append-only); it just stops being anyone's to read.
export async function removeActivity(actor: Actor, id: string) {
  await ownActivity(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.runActivity.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordEvent(tx, {
      eventType: 'RunActivityRemoved',
      aggregateType: 'RunActivity',
      aggregateId: id,
      actorId: actor.id,
      payload: { userId: actor.id },
    });
  });
}

async function ownActivity(actor: Actor, id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Recording not found');
  const row = await prisma.runActivity.findFirst({ where: { id, userId: actor.id, deletedAt: null }, select: { audience: true } });
  if (!row) throw ApiError.notFound('Recording not found');
  return row;
}
