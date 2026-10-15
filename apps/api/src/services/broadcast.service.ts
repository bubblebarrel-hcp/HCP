import { AccountStatus, BroadcastAudience, MembershipStatus, NotificationPriority, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { displayName } from '../serializers/user';
import { recordAudit, recordEvent } from './record.service';

// D76. A message from the platform to everyone, to one kennel's active
// members, or to one named hasher (a personal nudge, such as "please review your
// date of birth"). Staff write it; delivery is the ordinary notification fan-out
// (`BroadcastSent` in notification.service#specFor), so each hasher's own
// switches, quiet hours and digest still apply, except that an urgent one
// skips the last two. It is the platform's act on the record, not a direct
// message, and a broadcast is never edited or deleted once sent.

export interface BroadcastInput {
  title: string;
  body: string;
  audience: BroadcastAudience;
  kennelId?: string | null;
  // For the USER audience: the hasher's sign-in email, which staff can see.
  recipientEmail?: string | null;
  push: boolean;
  urgent: boolean;
}

// Active accounts only: a suspended, deactivated or unverified one has no
// session to read it in. For a kennel, its active members.
export async function recipientIds(
  audience: BroadcastAudience,
  kennelId?: string | null,
  recipientId?: string | null,
): Promise<string[]> {
  if (audience === BroadcastAudience.USER) {
    if (!recipientId) return [];
    const user = await prisma.user.findFirst({ where: { id: recipientId, status: AccountStatus.ACTIVE }, select: { id: true } });
    return user ? [user.id] : [];
  }
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

// The one hasher a USER broadcast is for, found by email. Throws 404 when there is
// no such account, so staff never send to a typo.
async function recipientOrThrow(email?: string | null) {
  const address = email?.trim().toLowerCase();
  if (!address) throw ApiError.badRequest("Enter the hasher's email", 'INVALID_BROADCAST');
  const user = await prisma.user.findUnique({
    where: { email: address },
    select: { id: true, hashHandle: true, person: { select: { firstName: true } } },
  });
  if (!user) throw ApiError.notFound('No hasher has that email');
  return { id: user.id, name: displayName(user.hashHandle, user.person?.firstName) };
}

// How many would be addressed, so the form can say so before anything is sent.
export async function preview(audience: BroadcastAudience, kennelId?: string | null, recipientEmail?: string | null) {
  if (audience === BroadcastAudience.KENNEL) await kennelOrThrow(kennelId);
  if (audience === BroadcastAudience.USER) {
    const who = await recipientOrThrow(recipientEmail);
    return { recipients: (await recipientIds(audience, null, who.id)).length, recipientName: who.name };
  }
  return { recipients: (await recipientIds(audience, kennelId)).length, recipientName: null };
}

export async function send(actorId: string, input: BroadcastInput) {
  const kennel = input.audience === BroadcastAudience.KENNEL ? await kennelOrThrow(input.kennelId) : null;
  const kennelId = kennel?.id ?? null;
  const recipient = input.audience === BroadcastAudience.USER ? await recipientOrThrow(input.recipientEmail) : null;
  const recipients = await recipientIds(input.audience, kennelId, recipient?.id);
  if (recipients.length === 0) throw ApiError.badRequest('That audience has nobody in it', 'INVALID_BROADCAST');
  // Urgent is the platform saying "this one is worth a buzz".
  const push = input.push || input.urgent;

  const row = await prisma.$transaction(async (tx) => {
    const broadcast = await tx.broadcast.create({
      data: {
        authorId: actorId,
        audience: input.audience,
        kennelId,
        recipientId: recipient?.id ?? null,
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
      payload: { audience: input.audience, kennelId, recipientId: recipient?.id ?? null, push, urgent: input.urgent, recipients: recipients.length },
    });
    await recordAudit(tx, {
      actorId,
      action: 'broadcast.send',
      resourceType: 'Broadcast',
      resourceId: broadcast.id,
      kennelId,
      newState: { title: input.title, audience: input.audience, recipientId: recipient?.id ?? null, push, urgent: input.urgent, recipients: recipients.length },
      policyRef: 'platform-admin',
      domainEventId: event.id,
    });
    return broadcast;
  });
  return present(row, kennel?.name ?? null, recipient?.name ?? null);
}

function present(row: Prisma.BroadcastGetPayload<object>, kennelName: string | null, recipientName: string | null = null) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    kennelId: row.kennelId,
    kennelName,
    recipientName,
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
      include: {
        kennel: { select: { name: true } },
        recipient: { select: { hashHandle: true, person: { select: { firstName: true } } } },
      },
    }),
    prisma.broadcast.count(),
  ]);
  return page(
    rows.map((r) =>
      present(r, r.kennel?.name ?? null, r.recipient ? displayName(r.recipient.hashHandle, r.recipient.person?.firstName) : null),
    ),
    total,
    opts.page,
    opts.limit,
  );
}

// What the notification carries: urgent rises above the rest.
export const priorityOf = (urgent: boolean) => (urgent ? NotificationPriority.CRITICAL : NotificationPriority.NORMAL);
