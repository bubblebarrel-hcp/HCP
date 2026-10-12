import { AccountStatus, AppealStatus, CoordinationOutcome, EnforcementLevel, PlatformRole, Prisma, ReportReason, ReportStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { logger } from '../utils/logger';
import { type Cluster, detect, SIGNAL_TEXT } from './coordination.service';
import { recordAudit, recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';
import { getNumberSetting } from './settings.service';

// Automatic action on reports (D74).
//
// When enough different hashers report the same person, the platform acts before
// a moderator can: it warns, then holds the account for a few days, then holds it
// until staff decide. It is the rules of D61 carried out sooner, not a new kind of
// judgement, so it is built to be hard to turn against somebody:
//
//   - What counts is *distinct reporters*, never reports. Reporting ten things
//     counts once. Six people reporting one thing counts six times.
//   - A reporter counts only if their account is old enough, active, and not in the
//     habit of being wrong: three reports staff dismissed and none upheld in 90
//     days, and their reports stop counting.
//   - A report staff dismissed never counts. One staff upheld counts double.
//   - Reasons are weighted: harassment, hate, violence, sexual content, scams and
//     private information count in full, spam and "other" count half, and
//     self-harm and impersonation count for nothing here (the first is somebody in
//     danger, not somebody at fault, and the second is fixed by a person).
//   - A hold is never permanent. It lifts by itself, or staff lift it, or staff
//     confirm it. Nothing automatic ends an account: that stays a human act.
//   - After a hold lifts, only reports filed afterwards count, so old reports
//     cannot suspend the same person twice. A second hold at the same score
//     becomes a hold for review, because that is a pattern.
//   - Platform staff are never acted on.
//   - Reporters who look like one count as one (D75, coordination.service). Where
//     that changes what would have happened, nothing happens to the hasher and a
//     person is asked which it was. A campaign confirmed by staff stops counting
//     for six months.
//   - A held hasher can appeal (appeal.service). Granting lifts the hold; denying
//     confirms it and says why.
//
// Nothing here is AI. It is arithmetic on reports, and every threshold is a
// platform setting (settings.service) that an admin can change.

const L = EnforcementLevel;

const WEIGHT: Partial<Record<ReportReason, number>> = {
  HARASSMENT: 1,
  HATE: 1,
  VIOLENCE: 1,
  SEXUAL: 1,
  SCAM: 1,
  PRIVATE_INFO: 1,
  SPAM: 0.5,
  OTHER: 0.5,
};
const UPHELD_WEIGHT = 2;
const DAY = 24 * 60 * 60 * 1000;
const DISCREDIT_WINDOW_MS = 90 * DAY;
const DISCREDIT_AFTER = 3;
const SWEEP_MS = 5 * 60 * 1000;
// How long reporters staff confirmed as a campaign stop counting.
const CAMPAIGN_MS = 180 * DAY;
const THIN_WEIGHT = 0.5;

const ABOVE: Record<EnforcementLevel, EnforcementLevel[]> = {
  [L.WARN]: [L.WARN, L.HOLD, L.REVIEW_HOLD],
  [L.HOLD]: [L.HOLD, L.REVIEW_HOLD],
  [L.REVIEW_HOLD]: [L.REVIEW_HOLD],
};

export interface Standing {
  // After linked reporters are counted as one: the number the rungs are read from.
  score: number;
  // Independent reporters: linked ones are one.
  reporterCount: number;
  reasons: Record<string, number>;
  reportIds: string[];
  since: Date;
  // Before that (D75): what it would be if every reporter were a stranger.
  rawScore: number;
  rawReporterCount: number;
  clusters: Cluster[];
  thin: string[];
}

async function settings() {
  const [enabled, windowDays, warn, hold, review, holdHours, minAge] = await Promise.all([
    getNumberSetting('moderation.auto.enabled'),
    getNumberSetting('moderation.auto.windowDays'),
    getNumberSetting('moderation.auto.warnScore'),
    getNumberSetting('moderation.auto.holdScore'),
    getNumberSetting('moderation.auto.reviewScore'),
    getNumberSetting('moderation.auto.holdHours'),
    getNumberSetting('moderation.auto.minReporterAgeDays'),
  ]);
  return { enabled: enabled === 1, windowDays, warn, hold, review, holdHours, minAge };
}

/** Where a hasher stands: the reports that count against them right now. */
export async function standing(userId: string, cfg?: Awaited<ReturnType<typeof settings>>): Promise<Standing> {
  const c = cfg ?? (await settings());
  const now = Date.now();
  let since = new Date(now - c.windowDays * DAY);

  // Whatever was cleared, by lifting a hold or dismissing a warning, starts clean.
  const cleared = await prisma.autoEnforcement.findFirst({
    where: { userId, liftedAt: { not: null } },
    orderBy: { liftedAt: 'desc' },
    select: { liftedAt: true },
  });
  if (cleared?.liftedAt && cleared.liftedAt > since) since = cleared.liftedAt;

  const reports = await prisma.contentReport.findMany({
    where: {
      targetUserId: userId,
      createdAt: { gte: since },
      status: { not: ReportStatus.DISMISSED },
      reason: { in: Object.keys(WEIGHT) as ReportReason[] },
    },
    select: {
      id: true,
      reporterId: true,
      reason: true,
      status: true,
      createdAt: true,
      reporter: { select: { createdAt: true, status: true, deletedAt: true } },
    },
  });

  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  // A reporter whose reports keep being dismissed and never upheld stops counting.
  const record = reporterIds.length
    ? await prisma.contentReport.groupBy({
        by: ['reporterId', 'status'],
        where: {
          reporterId: { in: reporterIds },
          createdAt: { gte: new Date(now - DISCREDIT_WINDOW_MS) },
          status: { in: [ReportStatus.DISMISSED, ReportStatus.ACTIONED] },
        },
        _count: { _all: true },
      })
    : [];
  const dismissed = new Map<string, number>();
  const upheld = new Map<string, number>();
  for (const row of record) {
    (row.status === ReportStatus.DISMISSED ? dismissed : upheld).set(row.reporterId, row._count._all);
  }
  const discredited = (id: string) => (dismissed.get(id) ?? 0) >= DISCREDIT_AFTER && (upheld.get(id) ?? 0) === 0;

  // What staff have said about suspected campaigns (D75): reporters they confirmed
  // as one stop counting; groups they cleared count as strangers again, here.
  const [confirmed, clearedHere] = await Promise.all([
    prisma.coordinationFlag.findMany({
      where: { outcome: CoordinationOutcome.CONFIRMED, reviewedAt: { gte: new Date(now - CAMPAIGN_MS) } },
      select: { reporterIds: true },
    }),
    prisma.coordinationFlag.findMany({
      where: { targetUserId: userId, outcome: CoordinationOutcome.CLEARED, createdAt: { gte: since } },
      select: { reporterIds: true },
    }),
  ]);
  const campaign = new Set(confirmed.flatMap((x) => x.reporterIds as string[]));
  const independent = new Set(clearedHere.flatMap((x) => x.reporterIds as string[]));

  // One value per reporter: the heaviest thing they said.
  const best = new Map<string, { weight: number; reason: ReportReason; createdAt: Date; reportedAt: Date }>();
  const counted: string[] = [];
  for (const r of reports) {
    const old = now - r.reporter.createdAt.getTime() >= c.minAge * DAY;
    if (!old || r.reporter.status !== AccountStatus.ACTIVE || r.reporter.deletedAt) continue;
    if (discredited(r.reporterId) || campaign.has(r.reporterId)) continue;
    const weight = r.status === ReportStatus.ACTIONED ? UPHELD_WEIGHT : (WEIGHT[r.reason] ?? 0);
    counted.push(r.id);
    const held = best.get(r.reporterId);
    if (!held) {
      best.set(r.reporterId, { weight, reason: r.reason, createdAt: r.reporter.createdAt, reportedAt: r.createdAt });
    } else {
      if (weight > held.weight) {
        held.weight = weight;
        held.reason = r.reason;
      }
      if (r.createdAt < held.reportedAt) held.reportedAt = r.createdAt;
    }
  }

  let rawScore = 0;
  for (const { weight } of best.values()) rawScore += weight;

  // Reporters who look like one count as one: the heaviest of them.
  const detection = await detect(
    userId,
    [...best.entries()].filter(([id]) => !independent.has(id)).map(([id, v]) => ({ id, createdAt: v.createdAt, reportedAt: v.reportedAt })),
  );
  const effective = new Map([...best.entries()].map(([id, v]) => [id, { weight: v.weight, reason: v.reason }]));
  for (const cluster of detection.clusters) {
    const members = cluster.reporterIds.filter((id) => effective.has(id));
    const keep = members.reduce((a, b) => (effective.get(b)!.weight > effective.get(a)!.weight ? b : a), members[0]);
    for (const id of members) if (id !== keep) effective.get(id)!.weight = 0;
  }
  // An account with no life on the platform counts for half.
  for (const id of detection.thin) {
    const e = effective.get(id);
    if (e) e.weight = Math.min(e.weight, THIN_WEIGHT);
  }

  const reasons: Record<string, number> = {};
  let score = 0;
  let units = 0;
  for (const { weight, reason } of effective.values()) {
    if (weight <= 0) continue;
    score += weight;
    units += 1;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    score,
    reporterCount: units,
    reasons,
    reportIds: counted,
    since,
    rawScore,
    rawReporterCount: best.size,
    clusters: detection.clusters,
    thin: detection.thin,
  };
}

/**
 * Looks at one hasher and, if the score has reached a rung they have not already
 * been put on, puts them there. Safe to call as often as is useful: it does
 * nothing the second time. Never throws into the caller.
 */
export async function evaluate(userId: string | null | undefined) {
  if (!userId || !isUuid(userId)) return null;
  try {
    const cfg = await settings();
    if (!cfg.enabled) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, platformRole: true, deletedAt: true },
    });
    // Staff are not acted on; a hold or a deactivation is already a decision.
    if (!user || user.deletedAt || user.status !== AccountStatus.ACTIVE || user.platformRole === PlatformRole.ADMIN) return null;

    const s = await standing(userId, cfg);
    const rung = (score: number): EnforcementLevel | null =>
      score >= cfg.review ? L.REVIEW_HOLD : score >= cfg.hold ? L.HOLD : score >= cfg.warn ? L.WARN : null;
    const order = [null, L.WARN, L.HOLD, L.REVIEW_HOLD];
    // Counting linked reporters as one lowered the answer: say so to a person, who
    // decides. Nothing more is done to this hasher than the lower rung allows.
    if (s.clusters.length > 0 && order.indexOf(rung(s.rawScore)) > order.indexOf(rung(s.score))) {
      await raiseFlag(userId, s);
    }

    let level: EnforcementLevel | null = rung(s.score);
    if (!level) return null;

    // A second hold in three months is a pattern, and a person should look.
    if (level === L.HOLD) {
      const earlier = await prisma.autoEnforcement.findFirst({
        where: { userId, level: L.HOLD, createdAt: { gte: new Date(Date.now() - DISCREDIT_WINDOW_MS) } },
        select: { id: true },
      });
      if (earlier) level = L.REVIEW_HOLD;
    }
    const chosen = level;

    return await prisma.$transaction(async (tx) => {
      // Two reports landing together must not each decide to suspend.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'enforce:' + userId}))`;
      const already = await tx.autoEnforcement.findFirst({
        where: { userId, createdAt: { gte: s.since }, level: { in: ABOVE[chosen] } },
        select: { id: true },
      });
      if (already) return null;

      const holds = chosen !== L.WARN;
      const endsAt = chosen === L.HOLD ? new Date(Date.now() + cfg.holdHours * 60 * 60 * 1000) : null;
      const row = await tx.autoEnforcement.create({
        data: {
          userId,
          level: chosen,
          score: s.score,
          reporterCount: s.reporterCount,
          reportIds: s.reportIds,
          reasons: s.reasons,
          windowStart: s.since,
          endsAt,
        },
      });
      if (holds) {
        await tx.user.update({ where: { id: userId }, data: { status: AccountStatus.SUSPENDED } });
        // Ends every session now rather than at the next refresh.
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
        // What staff open first.
        await tx.contentReport.updateMany({
          where: { id: { in: s.reportIds }, status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } },
          data: { priority: 2 },
        });
      }
      const event = await recordEvent(tx, {
        eventType: 'AutoEnforcementApplied',
        aggregateType: 'Identity',
        aggregateId: userId,
        // No actor: the platform did this, and the event says so.
        actorId: null,
        payload: { enforcementId: row.id, level: chosen, endsAt: endsAt?.toISOString() ?? null, reporterCount: s.reporterCount },
      });
      await recordAudit(tx, {
        actorId: null,
        action: `user.auto.${chosen.toLowerCase()}`,
        resourceType: 'Identity',
        resourceId: userId,
        previousState: { status: AccountStatus.ACTIVE },
        newState: { status: holds ? AccountStatus.SUSPENDED : AccountStatus.ACTIVE, level: chosen, score: s.score, reporterCount: s.reporterCount },
        reason: `${s.reporterCount} different hashers reported them (score ${s.score})`,
        policyRef: 'D74',
        domainEventId: event.id,
      });
      return row;
    });
  } catch (error) {
    logger.warn?.('Automatic enforcement check failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// ─── Lifting, confirming ───

/**
 * Lets the hasher back in (a hold ending, or staff deciding it was wrong), or, for
 * a warning, marks it dismissed. Either way what was reported before this moment
 * stops counting.
 */
export async function lift(enforcementId: string, by: { id: string } | null, note?: string | null) {
  if (!isUuid(enforcementId)) throw ApiError.notFound('Not found');
  return prisma.$transaction(async (tx) => {
    const row = await tx.autoEnforcement.findUnique({ where: { id: enforcementId } });
    if (!row) throw ApiError.notFound('Not found');
    if (row.liftedAt) return row;
    const now = new Date();
    const holds = row.level !== L.WARN;
    const user = await tx.user.findUnique({ where: { id: row.userId }, select: { status: true } });
    // Only undo what this did: a hasher who has since been deactivated or deleted
    // is left as they are.
    const restore = holds && user?.status === AccountStatus.SUSPENDED;
    const updated = await tx.autoEnforcement.update({
      where: { id: enforcementId },
      data: { liftedAt: now, liftedById: by?.id ?? null, reviewNote: note?.trim() || row.reviewNote },
    });
    // An appeal open on it is answered by this: granted if a person lifted it, moot
    // if it ran out first (D75).
    const open = await tx.enforcementAppeal.findFirst({ where: { enforcementId, status: AppealStatus.OPEN }, select: { id: true } });
    if (open) {
      await tx.enforcementAppeal.update({
        where: { id: open.id },
        data: { status: by ? AppealStatus.GRANTED : AppealStatus.MOOT, decidedById: by?.id ?? null, decidedAt: now, decisionNote: by ? note?.trim() || null : null },
      });
    }
    if (restore) await tx.user.update({ where: { id: row.userId }, data: { status: AccountStatus.ACTIVE } });
    const event = await recordEvent(tx, {
      eventType: 'AutoEnforcementLifted',
      aggregateType: 'Identity',
      aggregateId: row.userId,
      actorId: by?.id ?? null,
      payload: { enforcementId, level: row.level, by: by ? 'STAFF' : 'EXPIRED', restored: restore, appealed: Boolean(open) },
    });
    await recordAudit(tx, {
      actorId: by?.id ?? null,
      action: by ? 'user.auto.lift' : 'user.auto.expire',
      resourceType: 'Identity',
      resourceId: row.userId,
      previousState: { status: user?.status ?? null, level: row.level },
      newState: { status: restore ? AccountStatus.ACTIVE : (user?.status ?? null) },
      reason: note?.trim() || (by ? null : 'The hold ran its course'),
      policyRef: by ? 'platform-admin' : 'D74',
      domainEventId: event.id,
    });
    return updated;
  });
}

/** Staff decide the hold stands: it no longer lifts by itself, and is theirs. */
export async function confirm(enforcementId: string, by: { id: string }, note?: string | null) {
  if (!isUuid(enforcementId)) throw ApiError.notFound('Not found');
  return prisma.$transaction(async (tx) => {
    const row = await tx.autoEnforcement.findUnique({ where: { id: enforcementId } });
    if (!row) throw ApiError.notFound('Not found');
    if (row.level === L.WARN) throw ApiError.badRequest('A warning has nothing to confirm.', 'NOT_A_HOLD');
    if (row.liftedAt) throw ApiError.badRequest('That hold has already ended.', 'ALREADY_LIFTED');
    const openAppeal = await tx.enforcementAppeal.findFirst({ where: { enforcementId, status: AppealStatus.OPEN }, select: { id: true } });
    // Keeping a hold somebody has appealed is turning the appeal down, and they
    // will read why.
    if (openAppeal && (!note || note.trim().length < 3)) {
      throw ApiError.badRequest('They appealed. Say why it stands, in words they will read.', 'REASON_REQUIRED');
    }
    if (row.confirmedAt && !openAppeal) return row;
    const updated = await tx.autoEnforcement.update({
      where: { id: enforcementId },
      data: { confirmedAt: row.confirmedAt ?? new Date(), confirmedById: row.confirmedById ?? by.id, endsAt: null, reviewNote: note?.trim() || row.reviewNote },
    });
    if (openAppeal) {
      await tx.enforcementAppeal.update({
        where: { id: openAppeal.id },
        data: { status: AppealStatus.DENIED, decidedById: by.id, decidedAt: new Date(), decisionNote: note!.trim() },
      });
      await recordEvent(tx, {
        eventType: 'EnforcementAppealDecided',
        aggregateType: 'Identity',
        aggregateId: row.userId,
        actorId: by.id,
        payload: { enforcementId, outcome: 'DENIED', note: note!.trim() },
      });
    }
    const event = await recordEvent(tx, {
      eventType: 'AutoEnforcementConfirmed',
      aggregateType: 'Identity',
      aggregateId: row.userId,
      actorId: by.id,
      payload: { enforcementId, level: row.level },
    });
    await recordAudit(tx, {
      actorId: by.id,
      action: 'user.auto.confirm',
      resourceType: 'Identity',
      resourceId: row.userId,
      previousState: { level: row.level, endsAt: row.endsAt?.toISOString() ?? null },
      newState: { endsAt: null },
      reason: note?.trim() || null,
      policyRef: 'platform-admin',
      domainEventId: event.id,
    });
    return updated;
  });
}

/**
 * A person has changed the account's status by hand. A suspension takes it over
 * from any automatic hold, so the hold's clock can never undo it; a reinstatement
 * closes any automatic hold and starts the count again. Called from the same
 * transaction that changed the status.
 */
export async function afterStaffChange(tx: Prisma.TransactionClient, userId: string, status: AccountStatus, actorId: string) {
  const now = new Date();
  if (status === AccountStatus.SUSPENDED) {
    await tx.autoEnforcement.updateMany({
      where: { userId, level: { in: [L.HOLD, L.REVIEW_HOLD] }, liftedAt: null, confirmedAt: null },
      data: { confirmedAt: now, confirmedById: actorId, endsAt: null, reviewNote: 'Suspended by staff' },
    });
  } else if (status === AccountStatus.ACTIVE) {
    await tx.autoEnforcement.updateMany({
      where: { userId, liftedAt: null },
      data: { liftedAt: now, liftedById: actorId, reviewNote: 'Reinstated by staff' },
    });
  }
}

/** What the login screen should say to a suspended hasher. */
export async function holdFor(userId: string) {
  return prisma.autoEnforcement.findFirst({
    where: { userId, level: { in: [L.HOLD, L.REVIEW_HOLD] }, liftedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { level: true, endsAt: true, confirmedAt: true, appeal: { select: { status: true, message: true, decisionNote: true, createdAt: true, decidedAt: true } } },
  });
}

/** For a report's page: the latest automatic action on the person it is about. */
export async function latestFor(userId: string | null) {
  if (!userId) return null;
  const row = await prisma.autoEnforcement.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, level: true, score: true, reporterCount: true, endsAt: true, liftedAt: true, confirmedAt: true, createdAt: true },
  });
  return row;
}

// ─── Staff ───

type Row = Prisma.AutoEnforcementGetPayload<{ include: { appeal: true; user: { select: typeof userPublicSelect & { username: true; status: true; avatarUrl: true } } } }>;

function serialize(r: Row) {
  const state = r.liftedAt
    ? 'LIFTED'
    : r.confirmedAt
      ? 'CONFIRMED'
      : r.level === L.WARN
        ? 'WARNED'
        : r.level === L.HOLD
          ? 'ON_HOLD'
          : 'UNDER_REVIEW';
  return {
    id: r.id,
    state,
    level: r.level,
    score: r.score,
    reporterCount: r.reporterCount,
    reasons: r.reasons as Record<string, number>,
    reportIds: r.reportIds as string[],
    windowStart: r.windowStart,
    endsAt: r.endsAt,
    liftedAt: r.liftedAt,
    confirmedAt: r.confirmedAt,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt,
    // The hasher's answer back, if they gave one (D75).
    appeal: r.appeal
      ? { id: r.appeal.id, status: r.appeal.status, message: r.appeal.message, decisionNote: r.appeal.decisionNote, createdAt: r.appeal.createdAt, decidedAt: r.appeal.decidedAt }
      : null,
    user: { id: r.user.id, name: publicName(r.user), username: r.user.username, status: r.user.status, avatarUrl: r.user.avatarUrl },
  };
}

export async function list(opts: { filter: 'active' | 'appeals' | 'all'; page: number; limit: number }) {
  const where: Prisma.AutoEnforcementWhereInput =
    opts.filter === 'active'
      ? { liftedAt: null, OR: [{ confirmedAt: null }, { appeal: { status: AppealStatus.OPEN } }] }
      : opts.filter === 'appeals'
        ? { appeal: { status: AppealStatus.OPEN } }
        : {};
  const [total, rows] = await Promise.all([
    prisma.autoEnforcement.count({ where }),
    prisma.autoEnforcement.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { appeal: true, user: { select: { ...userPublicSelect, username: true, status: true, avatarUrl: true } } },
    }),
  ]);
  return page(rows.map(serialize), total, opts.page, opts.limit);
}

export async function activeCount() {
  return prisma.autoEnforcement.count({ where: { level: { in: [L.HOLD, L.REVIEW_HOLD] }, liftedAt: null, confirmedAt: null } });
}

export const openAppealCount = () => prisma.enforcementAppeal.count({ where: { status: AppealStatus.OPEN } });

// ─── Suspected coordination (D75) ───

/**
 * Counting linked reporters as one changed what would have happened, so a person
 * is asked. Raised once per hasher until someone answers; a later look only brings
 * the numbers up to date. Reporters are told nothing.
 */
async function raiseFlag(userId: string, s: Standing) {
  const groups = s.clusters.map((c) => ({ reporterIds: c.reporterIds, signals: c.signals }));
  const members = [...new Set(s.clusters.flatMap((c) => c.reporterIds))];
  const open = await prisma.coordinationFlag.findFirst({
    where: { targetUserId: userId, outcome: CoordinationOutcome.PENDING },
    select: { id: true, reporterIds: true },
  });
  if (open) {
    // Reports arrive while earlier looks are still finishing, so a slow, older look
    // must not shrink what a newer one found. A flag only ever grows until decided.
    if (members.length >= (open.reporterIds as string[]).length) {
      await prisma.coordinationFlag.update({
        where: { id: open.id },
        data: { reporterIds: members, clusters: groups, rawScore: s.rawScore, effectiveScore: s.score },
      });
    }
    return;
  }
  await prisma.$transaction(async (tx) => {
    const flag = await tx.coordinationFlag.create({
      data: { targetUserId: userId, reporterIds: members, clusters: groups, rawScore: s.rawScore, effectiveScore: s.score, windowStart: s.since },
    });
    const event = await recordEvent(tx, {
      eventType: 'CoordinatedReportingSuspected',
      aggregateType: 'CoordinationFlag',
      aggregateId: flag.id,
      actorId: null,
      payload: { targetUserId: userId, groups: groups.length, reporters: members.length },
    });
    await recordAudit(tx, {
      actorId: null,
      action: 'report.coordination.flag',
      resourceType: 'Identity',
      resourceId: userId,
      newState: { rawScore: s.rawScore, effectiveScore: s.score, groups: groups.length },
      reason: `${members.length} reporters look linked, so they were counted as ${groups.length} group${groups.length === 1 ? '' : 's'}`,
      policyRef: 'D75',
      domainEventId: event.id,
    });
  });
}

/**
 * Staff say which it was. Independent: those reporters count separately again, for
 * this hasher, and the platform looks again. A campaign: those reporters stop
 * counting, for anybody, for six months, and the platform looks again.
 */
export async function reviewFlag(flagId: string, by: { id: string }, outcome: 'CLEARED' | 'CONFIRMED', note?: string | null) {
  if (!isUuid(flagId)) throw ApiError.notFound('Not found');
  const flag = await prisma.$transaction(async (tx) => {
    const row = await tx.coordinationFlag.findUnique({ where: { id: flagId } });
    if (!row) throw ApiError.notFound('Not found');
    if (row.outcome !== CoordinationOutcome.PENDING) throw ApiError.conflict('That has already been decided.', 'ALREADY_REVIEWED');
    // The people covered by the answer are everyone linked right now as well as
    // everyone the flag was raised about: reports may have come in since.
    const now = await standing(row.targetUserId);
    const covered = [...new Set([...(row.reporterIds as string[]), ...now.clusters.flatMap((c) => c.reporterIds)])];
    const updated = await tx.coordinationFlag.update({
      where: { id: flagId },
      data: { outcome, reporterIds: covered, reviewedAt: new Date(), reviewedById: by.id, reviewNote: note?.trim() || null },
    });
    const event = await recordEvent(tx, {
      eventType: 'CoordinatedReportingReviewed',
      aggregateType: 'CoordinationFlag',
      aggregateId: flagId,
      actorId: by.id,
      payload: { targetUserId: row.targetUserId, outcome },
    });
    await recordAudit(tx, {
      actorId: by.id,
      action: `report.coordination.${outcome.toLowerCase()}`,
      resourceType: 'Identity',
      resourceId: row.targetUserId,
      previousState: { outcome: row.outcome },
      newState: { outcome },
      reason: note?.trim() || null,
      policyRef: 'platform-admin',
      domainEventId: event.id,
    });
    return updated;
  });
  // The answer changes what the reports add up to: look again, now.
  await evaluate(flag.targetUserId);
  return flag;
}

type FlagRow = Prisma.CoordinationFlagGetPayload<{ include: { target: { select: typeof userPublicSelect & { username: true; status: true } } } }>;

async function serializeFlags(rows: FlagRow[]) {
  const ids = [...new Set(rows.flatMap((r) => r.reporterIds as string[]))];
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { ...userPublicSelect, username: true, createdAt: true } }) : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id,
    outcome: r.outcome,
    rawScore: r.rawScore,
    effectiveScore: r.effectiveScore,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    reviewNote: r.reviewNote,
    target: { id: r.target.id, name: publicName(r.target), username: r.target.username, status: r.target.status },
    groups: (r.clusters as unknown as Cluster[]).map((c) => ({
      signals: c.signals.map((s) => SIGNAL_TEXT[s]),
      reporters: c.reporterIds.map((id) => {
        const p = byId.get(id);
        return { id, name: p ? publicName(p) : 'Deleted hasher', username: p?.username ?? null, joined: p?.createdAt ?? null };
      }),
    })),
  }));
}

export async function listFlags(opts: { filter: 'pending' | 'all'; page: number; limit: number }) {
  const where: Prisma.CoordinationFlagWhereInput = opts.filter === 'pending' ? { outcome: CoordinationOutcome.PENDING } : {};
  const [total, rows] = await Promise.all([
    prisma.coordinationFlag.count({ where }),
    prisma.coordinationFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { target: { select: { ...userPublicSelect, username: true, status: true } } },
    }),
  ]);
  return page(await serializeFlags(rows), total, opts.page, opts.limit);
}

export const pendingFlagCount = () => prisma.coordinationFlag.count({ where: { outcome: CoordinationOutcome.PENDING } });

// ─── Worker ───

let timer: ReturnType<typeof setInterval> | null = null;

/** Restores accounts whose hold has run its course. Staff-confirmed holds are never touched. */
export async function sweep() {
  const due = await prisma.autoEnforcement.findMany({
    where: { level: L.HOLD, endsAt: { lte: new Date() }, liftedAt: null, confirmedAt: null },
    select: { id: true },
    take: 50,
  });
  for (const { id } of due) {
    try {
      await lift(id, null);
    } catch (error) {
      logger.warn?.('Could not lift an expired hold', { id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return due.length;
}

export function startEnforcementSweeper() {
  if (timer) return;
  void sweep().catch(() => undefined);
  timer = setInterval(() => void sweep().catch(() => undefined), SWEEP_MS);
  timer.unref?.();
  logger.info(`Automatic hold sweeper started (every ${SWEEP_MS / 60000} minutes)`);
}

export function stopEnforcementSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
