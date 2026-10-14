import { AccountStatus, BroadcastAudience, MembershipStatus, NotificationPriority, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { recordAudit, recordEvent } from './record.service';

// D76. A message from the platform to everyone, or to one kennel's active
// members. Staff write it; delivery is the ordinary notification fan-out
// (`BroadcastSent` in notification.service#specFor), so each hasher's own
// switches, quiet hours and digest still apply, except that an urgent one
// skips the last two. It is the platform's act on the record, not a direct
// message, and a broadcast is never edited or deleted once sent.

export interface BroadcastInput {
  title: string;
  body: string;
  audience: BroadcastAudience;
  kennelId?: string | null;
  push: boolean;
  urgent: boolean;
}

// Active accounts only: a suspended, deactivated or unverified one has no
// session to read it in. For a kennel, its active members.
export async function recipientIds(audience: BroadcastAudience, kennelId?: string | null): Promise<string[]> {
  if (audience === BroadcastAudience.KENNEL) {
    if (!kennelId) return [];
    const rows = await prisma.membership.findMany({
      where: { kennelId, status: MembershipStatus.ACTIVE, user: { status: AccountStatus.ACTIVE } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }
  const rows = await prisma.user.findMany({ where: { status: AccountStatus.ACTIVE }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function kennelOrThrow(kennelId?: string | null) {
  if (!kennelId || !isUuid(kennelId)) throw ApiError.badRequest('Choose a kennel', 'INVALID_BROADCAST');
  const kennel = await prisma.kennel.findUnique({ where: { id: kennelId }, select: { id: true, name: true } });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

// How many would be addressed, so the form can say so before anything is sent.
export async function preview(audience: BroadcastAudience, kennelId?: string | null) {
  if (audience === BroadcastAudience.KENNEL) await kennelOrThrow(kennelId);
  return { recipients: (await recipientIds(audience, kennelId)).length };
}

export async function send(actorId: string, input: BroadcastInput) {
  const kennel = input.audience === BroadcastAudience.KENNEL ? await kennelOrThrow(input.kennelId) : null;
  const kennelId = kennel?.id ?? null;
  const recipients = await recipientIds(input.audience, kennelId);
  if (recipients.length === 0) throw ApiError.badRequest('That audience has nobody in it', 'INVALID_BROADCAST');
  // Urgent is the platform saying "this one is worth a buzz".
  const push = input.push || input.urgent;

  const row = await prisma.$transaction(async (tx) => {
    const broadcast = await tx.broadcast.create({
      data: {
        authorId: actorId,
        audience: input.audience,
        kennelId,
        title: input.title,
        body: input.body,
        push,
        urgent: input.urgent,
        recipientCount: recipients.length,
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'BroadcastSent',
      aggregateType: 'Broadcast',
      aggregateId: broadcast.id,
      actorId,
      payload: { audience: input.audience, kennelId, push, urgent: input.urgent, recipients: recipients.length },
    });
    await recordAudit(tx, {
      actorId,
      action: 'broadcast.send',
      resourceType: 'Broadcast',
      resourceId: broadcast.id,
      kennelId,
      newState: { title: input.title, audience: input.audience, push, urgent: input.urgent, recipients: recipients.length },
      policyRef: 'platform-admin',
      domainEventId: event.id,
    });
    return broadcast;
  });
  return present(row, kennel?.name ?? null);
}

function present(row: Prisma.BroadcastGetPayload<object>, kennelName: string | null) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    kennelId: row.kennelId,
    kennelName,
    push: row.push,
    urgent: row.urgent,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt,
  };
}

export async function list(opts: { page: number; limit: number }) {
  const [rows, total] = await prisma.$transaction([
    prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { kennel: { select: { name: true } } },
    }),
    prisma.broadcast.count(),
  ]);
  return page(
    rows.map((r) => present(r, r.kennel?.name ?? null)),
    total,
    opts.page,
    opts.limit,
  );
}

// What the notification carries: urgent rises above the rest.
export const priorityOf = (urgent: boolean) => (urgent ? NotificationPriority.CRITICAL : NotificationPriority.NORMAL);
