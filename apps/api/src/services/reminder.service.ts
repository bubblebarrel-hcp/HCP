import { HareOfferStatus, MembershipStatus, MembershipTimelineType, Prisma, RunStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { recordAudit, recordEvent } from './record.service';
import { getNumberSetting } from './settings.service';
import { sweepDueReleases } from './trail.service';

// Nudging a kennel about a date nobody is haring (D45).
//
// D44 gave a kennel a list of its un-hared dates and a way for hashers to
// answer. A list waits to be looked at, and the run comes anyway — so this is
// the part that speaks up, on a schedule, and then stops.
//
// Four things are worth saying, and each is said once per run:
//   - offers are waiting and nobody has answered   → the officers
//   - the date is a few weeks out with no hare     → the officers
//   - the date is close and still has no hare      → the whole kennel
//   - a hare exists but no trail has been started  → the hare(s) themselves
//
// Nothing here decides anything; it asks. Idempotency is the DomainEvent log
// itself: a nudge that has been recorded for a run at a given stage is never
// recorded again, so a restart, a second drain or a long-running process cannot
// send it twice.

// A run can still take a hare while it is being planned.
const OPEN_TO_OFFERS: RunStatus[] = [RunStatus.SCHEDULED, RunStatus.PLANNING, RunStatus.TRAIL_HIDDEN];

export type NudgeStage = 'offers-waiting' | 'no-hare-soon' | 'no-hare-urgent' | 'no-trail-planned';

const EVENT = 'RunHareReminderIssued';

// How long an offer may sit unanswered before the officers hear about it.
const UNANSWERED_OFFER_DAYS = 3;

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

interface Nudge {
  runId: string;
  kennelId: string;
  stage: NudgeStage;
  daysAway: number;
  offerCount: number;
  // Only for 'no-trail-planned': who to ask, carried in the payload so
  // notification.service.ts does not need a second query to find them.
  hareUserIds?: string[];
}

const runSelect = {
  id: true,
  kennelId: true,
  runNumber: true,
  startsAt: true,
  _count: { select: { hareOffers: { where: { status: HareOfferStatus.OFFERED } } } },
  // D45 follow-up: a kennel's own thresholds, null meaning "use the platform
  // default" — resolved per run below, since runs in the same sweep can
  // belong to kennels with different thresholds.
  kennel: { select: { hareNudgeSoonDays: true, hareNudgeUrgentDays: true } },
} satisfies Prisma.RunSelect;

async function alreadyNudged(runId: string, stage: NudgeStage) {
  const existing = await prisma.domainEvent.findFirst({
    where: { eventType: EVENT, aggregateId: runId, payload: { path: ['stage'], equals: stage } },
    select: { id: true },
  });
  return Boolean(existing);
}

async function record(nudge: Nudge) {
  if (await alreadyNudged(nudge.runId, nudge.stage)) return false;
  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, {
      eventType: EVENT,
      aggregateType: 'Run',
      aggregateId: nudge.runId,
      // Nobody pressed anything: the calendar did this.
      actorId: null,
      payload: {
        kennelId: nudge.kennelId,
        stage: nudge.stage,
        daysAway: nudge.daysAway,
        offerCount: nudge.offerCount,
        ...(nudge.hareUserIds ? { hareUserIds: nudge.hareUserIds } : {}),
      },
    });
  });
  return true;
}

function daysUntil(when: Date, now: number) {
  return Math.max(0, Math.round((when.getTime() - now) / DAYS));
}

export async function nudgeUnharedRuns(now = new Date()) {
  const platformSoonDays = await getNumberSetting('hare.nudge.soonDays');
  const platformUrgentDays = await getNumberSetting('hare.nudge.urgentDays');
  const at = now.getTime();

  // A kennel may push its own window further out than the platform default,
  // so the query's own cutoff has to be at least as wide as the widest one in
  // play, or an overridden kennel's later-arriving nudge would never be seen
  // at all. Each run is still re-checked against its own kennel's window
  // below — this only decides what's worth fetching.
  const widestOverride = await prisma.kennel.aggregate({ _max: { hareNudgeSoonDays: true } });
  const outerSoonDays = Math.max(platformSoonDays, widestOverride._max.hareNudgeSoonDays ?? 0);

  // Every upcoming run that still has nobody laying its trail.
  const unhared = await prisma.run.findMany({
    where: {
      status: { in: OPEN_TO_OFFERS },
      cancelledAt: null,
      startsAt: { gt: now, lte: new Date(at + outerSoonDays * DAYS) },
      hares: { none: {} },
    },
    orderBy: { startsAt: 'asc' },
    select: runSelect,
  });

  const nudges: Nudge[] = [];
  for (const run of unhared) {
    const soonDays = run.kennel.hareNudgeSoonDays ?? platformSoonDays;
    const urgentDays = run.kennel.hareNudgeUrgentDays ?? platformUrgentDays;
    const daysAway = daysUntil(run.startsAt, at);
    // Outside this run's own kennel's window — only in the fetch because
    // another kennel's wider override pulled the query cutoff out further.
    if (daysAway > soonDays) continue;
    const offerCount = run._count.hareOffers;

    // Someone has already put their hand up. The kennel does not need more
    // volunteers, it needs to answer the one it has.
    if (offerCount > 0) {
      const oldest = await prisma.hareOffer.findFirst({
        where: { runId: run.id, status: HareOfferStatus.OFFERED },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      if (oldest && at - oldest.createdAt.getTime() >= UNANSWERED_OFFER_DAYS * DAYS) {
        nudges.push({ runId: run.id, kennelId: run.kennelId, stage: 'offers-waiting', daysAway, offerCount });
      }
      continue;
    }

    nudges.push({
      runId: run.id,
      kennelId: run.kennelId,
      stage: daysAway <= urgentDays ? 'no-hare-urgent' : 'no-hare-soon',
      daysAway,
      offerCount,
    });
  }

  let issued = 0;
  for (const nudge of nudges) {
    if (await record(nudge)) issued++;
  }
  if (issued > 0) logger.info?.('Hare reminders issued', { issued, considered: unhared.length });
  return { considered: unhared.length, issued };
}

// D45 follow-up: the other thing a kennel forgets — a run has a hare, but
// nobody has started a trail for it. One stage, sent to the hares themselves
// (trail planning is their job, not the whole kennel's), on the same
// soonDays window — including a kennel's own override — as the no-hare
// nudges, since a trail is roughly as urgent to plan as a hare is to find.
export async function nudgeMissingTrails(now = new Date()) {
  const platformSoonDays = await getNumberSetting('hare.nudge.soonDays');
  const at = now.getTime();

  const widestOverride = await prisma.kennel.aggregate({ _max: { hareNudgeSoonDays: true } });
  const outerSoonDays = Math.max(platformSoonDays, widestOverride._max.hareNudgeSoonDays ?? 0);

  const unplanned = await prisma.run.findMany({
    where: {
      status: { in: OPEN_TO_OFFERS },
      cancelledAt: null,
      startsAt: { gt: now, lte: new Date(at + outerSoonDays * DAYS) },
      hares: { some: {} },
      trails: { none: {} },
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      kennelId: true,
      startsAt: true,
      hares: { select: { userId: true } },
      kennel: { select: { hareNudgeSoonDays: true } },
    },
  });

  let issued = 0;
  for (const run of unplanned) {
    const soonDays = run.kennel.hareNudgeSoonDays ?? platformSoonDays;
    const daysAway = daysUntil(run.startsAt, at);
    if (daysAway > soonDays) continue;

    const nudged = await record({
      runId: run.id,
      kennelId: run.kennelId,
      stage: 'no-trail-planned',
      daysAway,
      offerCount: 0,
      hareUserIds: run.hares.map((h) => h.userId),
    });
    if (nudged) issued++;
  }
  if (issued > 0) logger.info?.('Trail-not-planned reminders issued', { issued, considered: unplanned.length });
  return { considered: unplanned.length, issued };
}

// ─── Delegation expiry (D32) ───
//
// A delegation lapses on its own the moment `expiresAt` passes — nothing to
// mutate, `permission.service.ts#resolveKennelContext` already stops honouring
// it by reading `expiresAt` at query time. But that means the timeline goes
// quiet with no record of it, so this sweep exists purely to mark the moment:
// a DomainEvent, once, idempotent the same way the hare reminders are.
export async function sweepExpiredDelegations(now = new Date()) {
  const lapsed = await prisma.delegation.findMany({
    where: { revokedAt: null, expiresAt: { lte: now } },
    select: { id: true, kennelId: true, delegatorId: true, delegateId: true, permissions: true },
  });

  let issued = 0;
  for (const d of lapsed) {
    const already = await prisma.domainEvent.findFirst({
      where: { eventType: 'RoleDelegationExpired', aggregateId: d.id },
      select: { id: true },
    });
    if (already) continue;

    await prisma.$transaction(async (tx) => {
      const event = await recordEvent(tx, {
        eventType: 'RoleDelegationExpired',
        aggregateType: 'Delegation',
        aggregateId: d.id,
        // A rule-based automatic transition, not anyone's action.
        actorId: null,
        payload: {
          kennelId: d.kennelId,
          delegatorId: d.delegatorId,
          delegateId: d.delegateId,
          permissions: d.permissions,
        },
      });
      await recordAudit(tx, {
        actorId: null,
        action: 'delegation.expire',
        resourceType: 'Delegation',
        resourceId: d.id,
        kennelId: d.kennelId,
        previousState: { revoked: false },
        newState: { expired: true },
        policyRef: 'system',
        domainEventId: event.id,
      });
    });
    issued++;
  }
  if (issued > 0) logger.info?.('Delegation expirations recorded', { issued, considered: lapsed.length });
  return { considered: lapsed.length, issued };
}

// ─── Suspension expiry (FR-MEMBER-008) ───
//
// suspend() lets an officer set a `suspendedUntil`, but nothing ever read it
// back — a time-boxed suspension only ever ended if an officer noticed and
// reinstated by hand. This sweep is that noticing. It reuses the same
// `MembershipReinstated` event and `REINSTATEMENT` timeline type an officer's
// own reinstate() writes, actorId null for "the calendar did this" (system),
// same as the hare reminders above.
export async function sweepExpiredSuspensions(now = new Date()) {
  const due = await prisma.membership.findMany({
    where: { status: MembershipStatus.SUSPENDED, suspendedUntil: { not: null, lte: now } },
    select: { id: true, userId: true, kennelId: true },
  });

  let lifted = 0;
  for (const m of due) {
    await prisma.$transaction(async (tx) => {
      // Guarded on the status read, so a manual reinstate racing this sweep
      // cannot double-write.
      const { count } = await tx.membership.updateMany({
        where: { id: m.id, status: MembershipStatus.SUSPENDED },
        data: { status: MembershipStatus.ACTIVE, suspensionReason: null, suspendedUntil: null },
      });
      if (count === 0) return;

      await tx.membershipTimelineEntry.create({
        data: {
          membershipId: m.id,
          type: MembershipTimelineType.REINSTATEMENT,
          fromStatus: MembershipStatus.SUSPENDED,
          toStatus: MembershipStatus.ACTIVE,
          actorId: null,
          note: 'Automatically reinstated: the suspension period ended.',
        },
      });

      const event = await recordEvent(tx, {
        eventType: 'MembershipReinstated',
        aggregateType: 'Membership',
        aggregateId: m.id,
        actorId: null,
        payload: { kennelId: m.kennelId, userId: m.userId, automatic: true },
      });
      await recordAudit(tx, {
        actorId: null,
        action: 'membership.reinstate',
        resourceType: 'Membership',
        resourceId: m.id,
        kennelId: m.kennelId,
        previousState: { status: 'SUSPENDED' },
        newState: { status: 'ACTIVE' },
        policyRef: 'system',
        domainEventId: event.id,
      });
      lifted++;
    });
  }
  if (lifted > 0) logger.info?.('Suspensions automatically lifted', { lifted, considered: due.length });
  return { considered: due.length, lifted };
}

// ─── The timer ───

// Twice a day is enough for something measured in weeks, and it means a kennel
// in any time zone gets its nudge during waking hours rather than at 3am —
// quiet hours (D36) hold back the push either way.
const INTERVAL_MS = 12 * HOURS;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await nudgeUnharedRuns();
  } catch (err) {
    // A failed sweep is retried on the next tick; it must never take the
    // process down.
    logger.error('Hare reminder sweep failed', { message: err instanceof Error ? err.message : String(err) });
  }
  try {
    await nudgeMissingTrails();
  } catch (err) {
    logger.error('Trail-not-planned sweep failed', { message: err instanceof Error ? err.message : String(err) });
  }
  try {
    await sweepExpiredDelegations();
  } catch (err) {
    logger.error('Delegation expiry sweep failed', { message: err instanceof Error ? err.message : String(err) });
  }
  try {
    await sweepExpiredSuspensions();
  } catch (err) {
    logger.error('Suspension expiry sweep failed', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

export function startReminders() {
  if (timer) return;
  // Not at boot: a restart loop would otherwise sweep on every restart. The
  // first sweep happens one interval in.
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  logger.info(`Hare/trail reminder, delegation expiry, suspension expiry worker started (every ${INTERVAL_MS / HOURS}h)`);
}

export function stopReminders() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ─── Trail release sweep (D6/D12, Ch.22 B.3) ───
//
// A separate, much faster timer from the one above on purpose: a scheduled
// 3pm release is meant to land near 3pm, not up to 12 hours late. The lazy
// check in trail.service.ts#autoReleaseIfDue still runs on every read, so
// between sweeps a page load still catches it instantly — this timer is only
// what makes it land for everyone else, without anyone having loaded a page.
const RELEASE_SWEEP_INTERVAL_MS = 60 * 1000;

let releaseTimer: NodeJS.Timeout | null = null;
let releaseRunning = false;

async function releaseTick() {
  if (releaseRunning) return;
  releaseRunning = true;
  try {
    await sweepDueReleases();
  } catch (err) {
    logger.error('Trail release sweep failed', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    releaseRunning = false;
  }
}

export function startTrailReleaseSweeper() {
  if (releaseTimer) return;
  releaseTimer = setInterval(() => void releaseTick(), RELEASE_SWEEP_INTERVAL_MS);
  releaseTimer.unref?.();
  logger.info(`Trail release sweep worker started (every ${RELEASE_SWEEP_INTERVAL_MS / 1000}s)`);
}

export function stopTrailReleaseSweeper() {
  if (releaseTimer) clearInterval(releaseTimer);
  releaseTimer = null;
}
