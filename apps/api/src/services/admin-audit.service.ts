import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, page } from '../utils/http';
import { displayName } from '../serializers/user';
import { recordAudit } from './record.service';
import { SETTING_DEFAULTS } from './settings.service';

// Platform-admin reads of the governance record (AuditLog) and the event stream
// (DomainEvent), plus the platform settings. Both logs are append-only: nothing
// here edits or deletes a row.

type Range = { from?: Date; to?: Date };
const between = (r: Range) => (r.from || r.to ? { gte: r.from, lte: r.to } : undefined);

// AuditLog.actorId is a plain column, not a relation: resolve handles in one query.
async function actorNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, hashHandle: true, person: { select: { firstName: true } } },
  });
  return new Map(users.map((u) => [u.id, displayName(u.hashHandle, u.person?.firstName)]));
}

export async function listAudit(opts: {
  page: number;
  limit: number;
  q?: string;
  actorId?: string;
  resourceType?: string;
  decision?: 'ALLOWED' | 'DENIED';
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.q ? { action: { contains: opts.q, mode: 'insensitive' } } : {}),
    ...(opts.actorId ? { actorId: opts.actorId } : {}),
    ...(opts.resourceType ? { resourceType: opts.resourceType } : {}),
    ...(opts.decision ? { decision: opts.decision } : {}),
    ...(between(opts) ? { createdAt: between(opts) } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      // ipAddress / userAgent are deliberately not returned.
      select: {
        id: true,
        actorId: true,
        actorType: true,
        action: true,
        resourceType: true,
        resourceId: true,
        kennelId: true,
        decision: true,
        previousState: true,
        newState: true,
        reason: true,
        policyRef: true,
        domainEventId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const names = await actorNames(rows.map((r) => r.actorId));
  const items = rows.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? null) : null }));
  return page(items, total, opts.page, opts.limit);
}

export async function listEvents(opts: {
  page: number;
  limit: number;
  q?: string;
  aggregateType?: string;
  published?: 'true' | 'false';
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.DomainEventWhereInput = {
    ...(opts.q ? { eventType: { contains: opts.q, mode: 'insensitive' } } : {}),
    ...(opts.aggregateType ? { aggregateType: opts.aggregateType } : {}),
    ...(opts.published === 'true' ? { publishedAt: { not: null } } : {}),
    ...(opts.published === 'false' ? { publishedAt: null } : {}),
    ...(between(opts) ? { occurredAt: between(opts) } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.domainEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.domainEvent.count({ where }),
  ]);
  const names = await actorNames(rows.map((r) => r.actorId));
  const items = rows.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? null) : null }));
  return page(items, total, opts.page, opts.limit);
}

// The in-process outbox worker publishes events on a timer. Unpublished events
// that are old, or that keep failing, mean it is stuck.
export async function eventsHealth() {
  const stuckBefore = new Date(Date.now() - 5 * 60 * 1000);
  const [unpublished, stuck, failing, oldest, last] = await prisma.$transaction([
    prisma.domainEvent.count({ where: { publishedAt: null } }),
    prisma.domainEvent.count({ where: { publishedAt: null, occurredAt: { lt: stuckBefore } } }),
    prisma.domainEvent.count({ where: { publishedAt: null, attempts: { gt: 0 } } }),
    prisma.domainEvent.findFirst({ where: { publishedAt: null }, orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } }),
    prisma.domainEvent.findFirst({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } }),
  ]);
  return {
    unpublished,
    stuck,
    failing,
    oldestUnpublishedAt: oldest?.occurredAt ?? null,
    lastPublishedAt: last?.publishedAt ?? null,
  };
}

// --- platform settings -------------------------------------------------------

const SETTING_DESCRIPTIONS: Record<keyof typeof SETTING_DEFAULTS, string> = {
  'kennel.verification.minMismanagement': 'D10: active mismanagement members a kennel needs to be verified',
  'membership.reapplyCooldownDays': 'D20: days before a rejected or removed hasher may reapply to a kennel',
  'hare.nudge.soonDays': 'D45: days ahead a kennel is told a run still has no hare',
  'hare.nudge.urgentDays': 'D45: days ahead the whole kennel, not just officers, is asked for a hare',
  'membership.invitationExpiryDays': 'FR-MEMBER-005: days an invitation stays redeemable',
  'escalation.membership.waitingDays': 'FR-NOT-013: days a membership request waits before the first reminder',
  'escalation.membership.escalatedDays': 'FR-NOT-016: days before a waiting request is raised with kennel leadership',
  'escalation.report.overdueDays': 'FR-NOT-013: days a trail report is overdue before the first reminder',
  'escalation.report.escalatedDays': 'FR-NOT-016: days before an overdue report is raised with kennel leadership',
};

type SettingKey = keyof typeof SETTING_DEFAULTS;
const isSettingKey = (key: string): key is SettingKey => Object.prototype.hasOwnProperty.call(SETTING_DEFAULTS, key);

export async function listSettings() {
  const rows = await prisma.platformSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const items = (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => {
    const row = byKey.get(key);
    const stored = row && typeof row.value === 'number' ? row.value : null;
    return {
      key,
      description: SETTING_DESCRIPTIONS[key],
      defaultValue: SETTING_DEFAULTS[key],
      // The database row wins when present (settings.service#getNumberSetting).
      value: stored ?? SETTING_DEFAULTS[key],
      overridden: stored !== null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
  return { items };
}

// Only keys the code reads are editable: an unknown key would be a row nothing
// ever consults. PlatformSetting.key is a string, not a uuid, so there is no
// aggregate for a DomainEvent; the change is recorded in the AuditLog alone.
export async function updateSetting(actorId: string, key: string, value: number, reason?: string | null) {
  if (!isSettingKey(key)) throw ApiError.notFound('Unknown setting');
  if (key === 'kennel.verification.minMismanagement' && value < 1) {
    throw ApiError.badRequest('Kennel verification needs at least one mismanagement member', 'INVALID_SETTING');
  }
  const before = await prisma.platformSetting.findUnique({ where: { key } });
  const previous = typeof before?.value === 'number' ? before.value : SETTING_DEFAULTS[key];

  await prisma.$transaction(async (tx) => {
    await tx.platformSetting.upsert({
      where: { key },
      create: { key, value, description: SETTING_DESCRIPTIONS[key], updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    await recordAudit(tx, {
      actorId,
      action: 'platformSetting.change',
      resourceType: 'PlatformSetting',
      previousState: { key, value: previous },
      newState: { key, value },
      reason: reason ?? null,
      policyRef: 'platform-admin',
    });
  });
  return (await listSettings()).items.find((s) => s.key === key);
}
