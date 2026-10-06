import { KennelStatus, MembershipStatus, Prisma, RunStatus, TrailReportStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { recordEvent } from './record.service';
import { getNumberSetting } from './settings.service';

// FR-NOT-011 (reminders) and FR-NOT-013/016 (escalation): the platform speaks up,
// politely and a bounded number of times, about work that is waiting on a person.
//
// Three workflows, each a short ladder:
//   - a membership request nobody has answered     waiting -> escalated
//   - a run with no published trail report         overdue -> escalated
//   - a run tomorrow, for whoever said they'd come day-before
//
// What keeps it from becoming harassment (FR-NOT-016):
//   - every step happens at most once per subject, ever. The DomainEvent log is
//     the memory (as with the hare nudges), so a restart or a second sweep cannot
//     repeat one, and there is no step after the last;
//   - only the highest step a subject has reached is sent, so something already
//     a week late gets one message, not a backlog of them;
//   - nothing here is CRITICAL. An escalation can be HIGH, which skips a digest,
//     but quiet hours, a hasher's own category switches and a kennel's own rules
//     all still apply, because it goes through the same fan-out as everything else;
//   - the audience widens a step at a time: the person whose job it is, then
//     whoever runs the kennel.
// Nothing decides anything. A reminder asks; a human still acts (AI assists,
// humans decide, and no AI is the actor: these are SYSTEM events).

const DAYS = 24 * 60 * 60 * 1000;
const HOURS = 60 * 60 * 1000;

// How far back a late report is still worth nagging about. Past this the run is
// history, and an old gap is a conversation for officers, not a notification.
const REPORT_LOOKBACK_DAYS = 60;
// A page of subjects per sweep per workflow; the rest wait for the next one.
const BATCH = 200;

async function issued(eventType: string, aggregateId: string, stage: string) {
  const existing = await prisma.domainEvent.findFirst({
    where: { eventType, aggregateId, payload: { path: ['stage'], equals: stage } },
    select: { id: true },
  });
  return Boolean(existing);
}

async function issue(eventType: string, aggregateType: string, aggregateId: string, payload: Prisma.InputJsonValue) {
  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, {
      eventType,
      aggregateType,
      aggregateId,
      // Nobody pressed anything: the calendar did this.
      actorId: null,
      payload,
    });
  });
}

// ─── A membership request nobody has answered ───

export type MembershipStage = 'waiting' | 'escalated';
export const MEMBERSHIP_EVENT = 'MembershipRequestReminderIssued';

// `only` limits a sweep to one subject. The timers never pass it; it is for a
// check that must not touch anyone else's work.
export async function escalateMembershipRequests(now = new Date(), only?: string) {
  const waitingDays = await getNumberSetting('escalation.membership.waitingDays');
  const escalatedDays = await getNumberSetting('escalation.membership.escalatedDays');

  const rows = await prisma.membership.findMany({
    where: {
      ...(only ? { id: only } : {}),
      status: MembershipStatus.PENDING_REVIEW,
      createdAt: { lte: new Date(now.getTime() - waitingDays * DAYS) },
      kennel: { status: { not: KennelStatus.ARCHIVED } },
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: { id: true, kennelId: true, createdAt: true },
  });

  let issuedCount = 0;
  for (const row of rows) {
    const ageDays = Math.floor((now.getTime() - row.createdAt.getTime()) / DAYS);
    const stage: MembershipStage = ageDays >= escalatedDays ? 'escalated' : 'waiting';
    if (await issued(MEMBERSHIP_EVENT, row.id, stage)) continue;
    // Already escalated once counts for 'waiting' too: never step back down.
    if (stage === 'waiting' && (await issued(MEMBERSHIP_EVENT, row.id, 'escalated'))) continue;
    await issue(MEMBERSHIP_EVENT, 'Membership', row.id, { kennelId: row.kennelId, stage, ageDays });
    issuedCount++;
  }
  return { checked: rows.length, issued: issuedCount };
}

// ─── A run with no published trail report ───

export type ReportStage = 'overdue' | 'escalated';
export const REPORT_EVENT = 'TrailReportReminderIssued';

export async function escalateOverdueReports(now = new Date(), only?: string) {
  const overdueDays = await getNumberSetting('escalation.report.overdueDays');
  const escalatedDays = await getNumberSetting('escalation.report.escalatedDays');

  const runs = await prisma.run.findMany({
    where: {
      ...(only ? { id: only } : {}),
      status: { in: [RunStatus.REPORTING, RunStatus.ARCHIVED] },
      endedAt: {
        lte: new Date(now.getTime() - overdueDays * DAYS),
        gte: new Date(now.getTime() - REPORT_LOOKBACK_DAYS * DAYS),
      },
      kennel: { status: { not: KennelStatus.ARCHIVED } },
      OR: [
        { trailReport: { is: null } },
        { trailReport: { status: { notIn: [TrailReportStatus.PUBLISHED, TrailReportStatus.ARCHIVED] } } },
      ],
    },
    orderBy: { endedAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      kennelId: true,
      runNumber: true,
      endedAt: true,
      trailReport: { select: { officialScribeId: true } },
    },
  });

  let issuedCount = 0;
  for (const run of runs) {
    if (!run.endedAt) continue;
    const lateDays = Math.floor((now.getTime() - run.endedAt.getTime()) / DAYS);
    const stage: ReportStage = lateDays >= escalatedDays ? 'escalated' : 'overdue';
    if (await issued(REPORT_EVENT, run.id, stage)) continue;
    if (stage === 'overdue' && (await issued(REPORT_EVENT, run.id, 'escalated'))) continue;
    await issue(REPORT_EVENT, 'Run', run.id, {
      kennelId: run.kennelId,
      runNumber: run.runNumber,
      stage,
      lateDays,
      // The person whose job it is, carried so the notification needs no extra lookup.
      scribeId: run.trailReport?.officialScribeId ?? null,
    });
    issuedCount++;
  }
  return { checked: runs.length, issued: issuedCount };
}

// ─── A run tomorrow ───

export const RUN_REMINDER_EVENT = 'RunReminderIssued';
const RUN_REMINDER_WINDOW_MS = 24 * HOURS;
// Not for a run announced a moment ago: telling someone about it twice in an
// hour is what this is meant to avoid.
const FRESH_RUN_MS = 2 * HOURS;
const BEFORE_LIVE: RunStatus[] = [
  RunStatus.SCHEDULED,
  RunStatus.PLANNING,
  RunStatus.TRAIL_HIDDEN,
  RunStatus.TRAIL_RELEASED,
  RunStatus.CHECK_IN_OPEN,
];

export async function remindUpcomingRuns(now = new Date(), only?: string) {
  const runs = await prisma.run.findMany({
    where: {
      ...(only ? { id: only } : {}),
      status: { in: BEFORE_LIVE },
      cancelledAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + RUN_REMINDER_WINDOW_MS) },
      createdAt: { lte: new Date(now.getTime() - FRESH_RUN_MS) },
      participations: { some: { rsvpStatus: { in: ['GOING', 'MAYBE'] } } },
    },
    orderBy: { startsAt: 'asc' },
    take: BATCH,
    select: { id: true, kennelId: true, runNumber: true, startsAt: true },
  });

  let issuedCount = 0;
  for (const run of runs) {
    if (await issued(RUN_REMINDER_EVENT, run.id, 'day-before')) continue;
    await issue(RUN_REMINDER_EVENT, 'Run', run.id, {
      kennelId: run.kennelId,
      runNumber: run.runNumber,
      stage: 'day-before',
      startsAt: run.startsAt.toISOString(),
    });
    issuedCount++;
  }
  return { checked: runs.length, issued: issuedCount };
}

// The slow ladders (days), run by the 12-hour worker; the run reminder is minutes
// away from mattering, so it has its own faster call below.
export async function runEscalations(now = new Date()) {
  const result: Record<string, unknown> = {};
  for (const [name, fn] of [
    ['membership', escalateMembershipRequests],
    ['reports', escalateOverdueReports],
  ] as const) {
    try {
      result[name] = await fn(now);
    } catch (err) {
      logger.error(`Escalation sweep failed: ${name}`, { message: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

// ─── The sweep ───

// Half an hour: the day-before reminder lands within half an hour of the 24-hour
// mark, and the ladders measured in days are checked far more often than they
// need to be, which costs two small queries.
const INTERVAL_MS = 30 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runAllReminders(now = new Date()) {
  const result: Record<string, unknown> = await runEscalations(now);
  try {
    result.upcomingRuns = await remindUpcomingRuns(now);
  } catch (err) {
    logger.error('Escalation sweep failed: upcoming runs', { message: err instanceof Error ? err.message : String(err) });
  }
  return result;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await runAllReminders();
  } finally {
    running = false;
  }
}

export function startEscalationSweeper() {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  logger.info(`Reminder and escalation sweeper started (every ${INTERVAL_MS / 60000} minutes)`);
}

export function stopEscalationSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
