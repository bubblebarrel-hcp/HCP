import { ConversationStatus, DirectMessageStatus, FollowStatus, FollowTargetType, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { decryptField, encryptField } from '../utils/field-crypto';
import { ApiError, isUuid } from '../utils/http';
import { hiddenFor, isBlockedBetween } from './block.service';
import type { Actor } from './permission.service';
import { emitToUser } from './realtime.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// Direct messages (D71, which supersedes D8).
//
// Two hashers, text only, no groups. What keeps it from becoming a way to
// harass somebody:
//
//   - Anyone can ask; only people the recipient follows or shares a kennel with
//     arrive in the inbox. Everyone else arrives as a request, and the asker may
//     send exactly one message until it is accepted.
//   - Block ends it in both directions and answers 404, so a block does not
//     announce itself (D60). Mute keeps the conversation but silences it.
//   - `User.dmPolicy = NOBODY` closes the door to new conversations.
//   - Bodies are encrypted at rest and never reach a notification, an event
//     payload or a log. Staff cannot read a conversation; they see only what a
//     reporter files, as a snapshot (ReportTargetType.DIRECT_MESSAGE).
//   - History is append-only: unsending clears what is served, not the row.

export const MAX_BODY = 2000;
const PER_WINDOW = 60;
const WINDOW_MS = 10 * 60 * 1000;
const NEW_PER_DAY = 20;
const REPORT_CONTEXT = 5;

const S = ConversationStatus;

// ─── Helpers ───

const pairOf = (a: string, b: string) => (a < b ? ([a, b] as const) : ([b, a] as const));

const mine = (userId: string): Prisma.DirectConversationWhereInput => ({
  OR: [{ userLowId: userId }, { userHighId: userId }],
});

const otherOf = (c: { userLowId: string; userHighId: string }, me: string) => (c.userLowId === me ? c.userHighId : c.userLowId);

// Realtime (D72). Pushed after the change has committed, never inside it, and
// never carrying more than the REST answer would: the recipient's copy of a
// message is serialized for the recipient. The asker is never told of a decline.
async function pushUnread(userId: string) {
  emitToUser(userId, 'dm:unread', await unreadCount({ id: userId } as Actor));
}

function pushTo(userId: string, event: string, payload: Record<string, unknown>, withUnread = true) {
  emitToUser(userId, event, payload);
  if (withUnread) void pushUnread(userId).catch(() => undefined);
}

function cleanBody(raw: unknown) {
  if (typeof raw !== 'string') throw ApiError.badRequest('Write something first.', 'BODY_REQUIRED');
  // eslint-disable-next-line no-control-regex
  const body = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!body) throw ApiError.badRequest('Write something first.', 'BODY_REQUIRED');
  if (body.length > MAX_BODY) {
    throw ApiError.badRequest(`Keep it under ${MAX_BODY} characters.`, 'BODY_TOO_LONG');
  }
  return body;
}

async function reachableUser(actor: Actor, userId: string) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  if (userId === actor.id) throw ApiError.badRequest('You cannot message yourself.', 'SELF');
  const user = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, dmPolicy: true },
  });
  if (!user || (await isBlockedBetween(actor.id, userId))) throw ApiError.notFound('Hasher not found');
  return user;
}

// Whether the recipient already has a reason to hear from the sender: they
// follow them, or both belong to a kennel. Following is still not joining
// (D50): this only decides inbox or request, never who may ask.
async function isKnownTo(recipientId: string, senderId: string) {
  const follow = await prisma.follow.findFirst({
    where: {
      followerId: recipientId,
      targetType: FollowTargetType.USER,
      targetId: senderId,
      status: FollowStatus.ACTIVE,
      unfollowedAt: null,
    },
    select: { id: true },
  });
  if (follow) return true;
  const theirs = await prisma.membership.findMany({
    where: { userId: recipientId, status: 'ACTIVE' },
    select: { kennelId: true },
  });
  if (theirs.length === 0) return false;
  const shared = await prisma.membership.findFirst({
    where: { userId: senderId, status: 'ACTIVE', kennelId: { in: theirs.map((m) => m.kennelId) } },
    select: { id: true },
  });
  return Boolean(shared);
}

async function assertNotFlooding(senderId: string, startingNew: boolean) {
  const recent = await prisma.directMessage.count({
    where: { senderId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  if (recent >= PER_WINDOW) {
    throw new ApiError(429, 'Slow down a little. Try again in a few minutes.', 'DM_RATE_LIMITED');
  }
  if (startingNew) {
    const started = await prisma.directConversation.count({
      where: { initiatorId: senderId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (started >= NEW_PER_DAY) {
      throw new ApiError(429, 'You have started a lot of conversations today. Try again tomorrow.', 'DM_NEW_RATE_LIMITED');
    }
  }
}

const personSelect = { ...userPublicSelect, username: true, avatarUrl: true, avatarPosition: true } satisfies Prisma.UserSelect;

function serializePerson(u: Prisma.UserGetPayload<{ select: typeof personSelect }>) {
  return {
    id: u.id,
    displayName: publicName(u),
    username: u.deletedAt ? null : u.username,
    avatarUrl: u.deletedAt ? null : u.avatarUrl,
    avatarPosition: u.deletedAt ? null : u.avatarPosition,
    deleted: Boolean(u.deletedAt),
  };
}

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: DirectMessageStatus;
  createdAt: Date;
};

export function serializeMessage(m: MessageRow, me: string) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    mine: m.senderId === me,
    // An unsent or removed message keeps its place and loses its words.
    body: m.status === DirectMessageStatus.SENT ? decryptField(m.body) : null,
    status: m.status,
    createdAt: m.createdAt,
  };
}

// The asker is not told a request was declined (D71): it just never opens.
function statusFor(status: ConversationStatus, asker: boolean): ConversationStatus {
  return asker && status === S.DECLINED ? S.REQUESTED : status;
}

async function load(actor: Actor, id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Conversation not found');
  const conversation = await prisma.directConversation.findFirst({
    where: { id, ...mine(actor.id) },
    include: { participants: { where: { userId: actor.id } } },
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const otherId = otherOf(conversation, actor.id);
  // A block hides the conversation completely, from both sides.
  if (await isBlockedBetween(actor.id, otherId)) throw ApiError.notFound('Conversation not found');
  return { conversation, me: conversation.participants[0] ?? null, otherId };
}

// ─── Sending ───

export async function startWith(actor: Actor, userId: string, rawBody: string, clientKey?: string) {
  const body = cleanBody(rawBody);
  const target = await reachableUser(actor, userId);
  const [low, high] = pairOf(actor.id, target.id);

  const existing = await prisma.directConversation.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    select: { id: true },
  });
  if (existing) return sendInto(actor, existing.id, body, clientKey);

  if (target.dmPolicy === 'NOBODY') {
    throw ApiError.forbidden('This hasher is not taking new messages.', 'DM_CLOSED');
  }
  await assertNotFlooding(actor.id, true);

  // Someone who muted the sender is not told, and does not get it in the inbox.
  const { muted } = await hiddenFor(target.id);
  const known = !muted.has(actor.id) && (await isKnownTo(target.id, actor.id));
  const status = known ? S.ACTIVE : S.REQUESTED;

  try {
    const conversation = await prisma.directConversation.create({
      data: {
        userLowId: low,
        userHighId: high,
        initiatorId: actor.id,
        status,
        participants: { create: [{ userId: actor.id }, { userId: target.id }] },
      },
      select: { id: true },
    });
    return await sendInto(actor, conversation.id, body, clientKey);
  } catch (error) {
    // Two people wrote first at the same moment: the pair is one row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.directConversation.findUniqueOrThrow({
        where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
        select: { id: true },
      });
      return sendInto(actor, raced.id, body, clientKey);
    }
    throw error;
  }
}

export async function send(actor: Actor, conversationId: string, rawBody: string, clientKey?: string) {
  return sendInto(actor, conversationId, cleanBody(rawBody), clientKey);
}

async function sendInto(actor: Actor, conversationId: string, body: string, clientKey?: string) {
  const { conversation, otherId } = await load(actor, conversationId);

  const other = await prisma.user.findFirst({
    where: { id: otherId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!other) throw ApiError.notFound('Conversation not found');

  if (clientKey) {
    const again = await prisma.directMessage.findUnique({
      where: { conversationId_senderId_clientKey: { conversationId, senderId: actor.id, clientKey } },
    });
    if (again) return { message: serializeMessage(again, actor.id), conversationId, status: statusFor(conversation.status, conversation.initiatorId === actor.id) };
  }

  const asker = conversation.initiatorId === actor.id;
  let nextStatus: ConversationStatus = conversation.status;
  let accepting = false;

  if (conversation.status === S.REQUESTED) {
    if (asker) {
      const sent = await prisma.directMessage.count({ where: { conversationId, senderId: actor.id } });
      if (sent >= 1) {
        throw ApiError.conflict('Wait for them to accept before you send more.', 'DM_REQUEST_PENDING');
      }
    } else {
      // Answering a request is accepting it.
      nextStatus = S.ACTIVE;
      accepting = true;
    }
  } else if (conversation.status === S.DECLINED) {
    if (asker) throw ApiError.forbidden('You cannot message this hasher right now.', 'DM_UNAVAILABLE');
    nextStatus = S.ACTIVE;
    accepting = true;
  }

  await assertNotFlooding(actor.id, false);

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: { conversationId, senderId: actor.id, body: encryptField(body), clientKey: clientKey ?? null },
    });
    await tx.directConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: created.createdAt,
        ...(accepting ? { status: nextStatus, acceptedAt: now, declinedAt: null } : {}),
      },
    });
    // Sending reads everything before it; new words bring the other side's
    // conversation back from the archive.
    await tx.directParticipant.updateMany({ where: { conversationId, userId: actor.id }, data: { lastReadAt: now, archivedAt: null } });
    await tx.directParticipant.updateMany({ where: { conversationId, userId: otherId }, data: { archivedAt: null } });

    if (accepting) {
      await recordEvent(tx, {
        eventType: 'DirectMessageRequestAccepted',
        aggregateType: 'DirectConversation',
        aggregateId: conversationId,
        actorId: actor.id,
        payload: { askerId: conversation.initiatorId },
      });
    }
    // The payload names ids and a flag, never the words (D71).
    await recordEvent(tx, {
      eventType: 'DirectMessageSent',
      aggregateType: 'DirectConversation',
      aggregateId: conversationId,
      actorId: actor.id,
      payload: { messageId: created.id, recipientId: otherId, requested: nextStatus === S.REQUESTED },
    });
    return created;
  });

  const recipientAsks = otherId === conversation.initiatorId;
  pushTo(otherId, 'dm:message', {
    conversationId,
    message: serializeMessage(message, otherId),
    status: statusFor(nextStatus, recipientAsks),
    isRequest: nextStatus === S.REQUESTED && !recipientAsks,
  });
  // The sender's other devices see it too.
  pushTo(actor.id, 'dm:message', {
    conversationId,
    message: serializeMessage(message, actor.id),
    status: statusFor(nextStatus, asker),
    isRequest: false,
  });
  if (accepting) {
    pushTo(otherId, 'dm:conversation', { conversationId, status: nextStatus }, false);
    pushTo(actor.id, 'dm:conversation', { conversationId, status: nextStatus }, false);
  }

  return { message: serializeMessage(message, actor.id), conversationId, status: statusFor(nextStatus, asker) };
}

// ─── Reading ───

export async function listMine(actor: Actor, opts: { box: 'inbox' | 'requests'; page: number; limit: number }) {
  const { blocked } = await hiddenFor(actor.id);
  const blockedIds = [...blocked];

  const base: Prisma.DirectConversationWhereInput = {
    ...mine(actor.id),
    participants: { some: { userId: actor.id, archivedAt: null } },
    ...(blockedIds.length
      ? { NOT: { OR: [{ userLowId: { in: blockedIds } }, { userHighId: { in: blockedIds } }] } }
      : {}),
  };
  const where: Prisma.DirectConversationWhereInput =
    opts.box === 'requests'
      ? { ...base, status: S.REQUESTED, initiatorId: { not: actor.id } }
      : {
          ...base,
          // A request I sent stays visible to me, even once it is quietly declined.
          OR: [{ status: S.ACTIVE }, { status: { in: [S.REQUESTED, S.DECLINED] }, initiatorId: actor.id }],
        };

  const [total, rows] = await Promise.all([
    prisma.directConversation.count({ where }),
    prisma.directConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { participants: { where: { userId: actor.id } } },
    }),
  ]);

  const otherIds = rows.map((r) => otherOf(r, actor.id));
  const people = otherIds.length
    ? await prisma.user.findMany({ where: { id: { in: otherIds } }, select: personSelect })
    : [];
  const byId = new Map(people.map((p) => [p.id, p]));

  const items = await Promise.all(
    rows.map(async (c) => {
      const part = c.participants[0];
      const [last, unread] = await Promise.all([
        prisma.directMessage.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' } }),
        prisma.directMessage.count({
          where: {
            conversationId: c.id,
            senderId: { not: actor.id },
            status: DirectMessageStatus.SENT,
            ...(part?.lastReadAt ? { createdAt: { gt: part.lastReadAt } } : {}),
          },
        }),
      ]);
      const person = byId.get(otherOf(c, actor.id));
      const asker = c.initiatorId === actor.id;
      return {
        id: c.id,
        status: statusFor(c.status, asker),
        // I am the one being asked.
        isRequest: c.status === S.REQUESTED && !asker,
        other: person ? serializePerson(person) : null,
        lastMessage: last
          ? { ...serializeMessage(last, actor.id), body: last.status === DirectMessageStatus.SENT ? decryptField(last.body).slice(0, 140) : null }
          : null,
        unreadCount: unread,
        muted: Boolean(part?.mutedAt),
        lastMessageAt: c.lastMessageAt,
      };
    }),
  );
  return { items, total, page: opts.page, limit: opts.limit };
}

export async function get(actor: Actor, id: string) {
  const { conversation, me, otherId } = await load(actor, id);
  const person = await prisma.user.findUnique({ where: { id: otherId }, select: personSelect });
  const asker = conversation.initiatorId === actor.id;
  const canReply =
    Boolean(person) &&
    !person!.deletedAt &&
    !(conversation.status === S.DECLINED && asker) &&
    !(conversation.status === S.REQUESTED && asker && (await prisma.directMessage.count({ where: { conversationId: id, senderId: actor.id } })) >= 1);
  return {
    id: conversation.id,
    status: statusFor(conversation.status, asker),
    isRequest: conversation.status === S.REQUESTED && !asker,
    other: person ? serializePerson(person) : null,
    muted: Boolean(me?.mutedAt),
    canReply,
    createdAt: conversation.createdAt,
  };
}

// Newest page first, then older ones with `before`. The caller reverses.
export async function messages(actor: Actor, id: string, opts: { before?: string; limit: number }) {
  await load(actor, id);
  let cursor: Date | undefined;
  if (opts.before) {
    if (!isUuid(opts.before)) throw ApiError.badRequest('Bad cursor.', 'BAD_CURSOR');
    const anchor = await prisma.directMessage.findFirst({
      where: { id: opts.before, conversationId: id },
      select: { createdAt: true },
    });
    cursor = anchor?.createdAt;
  }
  const rows = await prisma.directMessage.findMany({
    where: { conversationId: id, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
  });
  const hasMore = rows.length > opts.limit;
  const page = rows.slice(0, opts.limit);
  return { items: page.map((m) => serializeMessage(m, actor.id)), hasMore };
}

// Newer than a message the client already has: what polling asks for.
export async function messagesAfter(actor: Actor, id: string, afterId: string) {
  await load(actor, id);
  if (!isUuid(afterId)) throw ApiError.badRequest('Bad cursor.', 'BAD_CURSOR');
  const anchor = await prisma.directMessage.findFirst({ where: { id: afterId, conversationId: id }, select: { createdAt: true } });
  const rows = await prisma.directMessage.findMany({
    where: { conversationId: id, ...(anchor ? { createdAt: { gt: anchor.createdAt } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return { items: rows.map((m) => serializeMessage(m, actor.id)) };
}

export async function markRead(actor: Actor, id: string) {
  await load(actor, id);
  await prisma.directParticipant.updateMany({ where: { conversationId: id, userId: actor.id }, data: { lastReadAt: new Date() } });
  // Only the reader's own devices hear this: there are no read receipts.
  pushTo(actor.id, 'dm:read', { conversationId: id });
  return { read: true };
}

export async function unreadCount(actor: Actor) {
  const { blocked } = await hiddenFor(actor.id);
  const rows = await prisma.$queryRaw<{ requested: boolean }[]>`
    SELECT (c."status" = 'REQUESTED') AS requested
    FROM "DirectConversation" c
    JOIN "DirectParticipant" p ON p."conversationId" = c."id" AND p."userId" = ${actor.id}::uuid
    WHERE p."archivedAt" IS NULL
      AND c."status" <> 'DECLINED'
      AND (c."userLowId" = ${actor.id}::uuid OR c."userHighId" = ${actor.id}::uuid)
      AND CASE WHEN c."userLowId" = ${actor.id}::uuid THEN c."userHighId" ELSE c."userLowId" END <> ALL (${[...blocked]}::uuid[])
      AND EXISTS (
        SELECT 1 FROM "DirectMessage" m
        WHERE m."conversationId" = c."id"
          AND m."senderId" <> ${actor.id}::uuid
          AND m."status" = 'SENT'
          AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
      )`;
  const requests = rows.filter((r) => r.requested).length;
  return { unread: rows.length - requests, requests };
}

// ─── Deciding ───

async function decide(actor: Actor, id: string, accept: boolean) {
  const { conversation } = await load(actor, id);
  if (conversation.initiatorId === actor.id || conversation.status !== S.REQUESTED) {
    throw ApiError.badRequest('There is no request to answer.', 'NOT_A_REQUEST');
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.directConversation.update({
      where: { id },
      data: accept ? { status: S.ACTIVE, acceptedAt: now } : { status: S.DECLINED, declinedAt: now },
    });
    await recordEvent(tx, {
      eventType: accept ? 'DirectMessageRequestAccepted' : 'DirectMessageRequestDeclined',
      aggregateType: 'DirectConversation',
      aggregateId: id,
      actorId: actor.id,
      payload: { askerId: conversation.initiatorId },
    });
  });
  const { id: askerId } = { id: conversation.initiatorId };
  if (accept) {
    pushTo(askerId, 'dm:conversation', { conversationId: id, status: S.ACTIVE }, false);
    pushTo(actor.id, 'dm:conversation', { conversationId: id, status: S.ACTIVE });
  } else {
    // A decline is silent to the asker (D71): only the decliner's devices hear it.
    pushTo(actor.id, 'dm:conversation', { conversationId: id, status: S.DECLINED });
  }
  return { status: accept ? S.ACTIVE : S.DECLINED };
}

export const accept = (actor: Actor, id: string) => decide(actor, id, true);
export const decline = (actor: Actor, id: string) => decide(actor, id, false);

// ─── My own copy ───

export async function setMuted(actor: Actor, id: string, muted: boolean) {
  await load(actor, id);
  await prisma.directParticipant.updateMany({ where: { conversationId: id, userId: actor.id }, data: { mutedAt: muted ? new Date() : null } });
  pushTo(actor.id, 'dm:refresh', { conversationId: id }, false);
  return { muted };
}

// Clears it from my list until something new arrives. The other side keeps theirs.
export async function archive(actor: Actor, id: string) {
  await load(actor, id);
  await prisma.directParticipant.updateMany({ where: { conversationId: id, userId: actor.id }, data: { archivedAt: new Date() } });
  pushTo(actor.id, 'dm:refresh', { conversationId: id });
  return { archived: true };
}

// Unsend: the words stop being served to both sides; the row stays (append-only).
export async function unsend(actor: Actor, messageId: string) {
  if (!isUuid(messageId)) throw ApiError.notFound('Message not found');
  const message = await prisma.directMessage.findFirst({ where: { id: messageId, senderId: actor.id } });
  if (!message) throw ApiError.notFound('Message not found');
  await load(actor, message.conversationId);
  if (message.status !== DirectMessageStatus.SENT) return { status: message.status };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.directMessage.update({ where: { id: messageId }, data: { status: DirectMessageStatus.DELETED, deletedAt: new Date() } });
    await recordEvent(tx, {
      eventType: 'DirectMessageDeleted',
      aggregateType: 'DirectConversation',
      aggregateId: message.conversationId,
      actorId: actor.id,
      payload: { messageId },
    });
    return row;
  });
  await pushMessageUpdated(updated);
  return { status: DirectMessageStatus.DELETED };
}

// ─── Reporting and moderation ───

// What a report about a message keeps: the message and the few before it, so a
// moderator can read it in context. The only way staff ever see a conversation,
// and only because one of its two people chose to show it.
export async function inspectForReport(actor: Actor, messageId: string) {
  if (!isUuid(messageId)) throw ApiError.notFound('Message not found');
  const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  await load(actor, message.conversationId);
  const context = await prisma.directMessage.findMany({
    where: { conversationId: message.conversationId, createdAt: { lte: message.createdAt }, status: DirectMessageStatus.SENT },
    orderBy: { createdAt: 'desc' },
    take: REPORT_CONTEXT + 1,
  });
  const messages = context.reverse().map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: decryptField(m.body),
    createdAt: m.createdAt.toISOString(),
    reported: m.id === messageId,
  }));
  return { targetUserId: message.senderId, snapshot: { kind: 'DIRECT_MESSAGE', conversationId: message.conversationId, messages } };
}

export async function removeByModeration(actor: Actor, messageId: string, reason: string) {
  const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.status === DirectMessageStatus.REMOVED) return;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.directMessage.update({
      where: { id: messageId },
      data: { status: DirectMessageStatus.REMOVED, removedAt: new Date(), removedReason: reason },
    });
    await recordEvent(tx, {
      eventType: 'DirectMessageRemoved',
      aggregateType: 'DirectConversation',
      aggregateId: message.conversationId,
      actorId: actor.id,
      payload: { messageId },
    });
    return row;
  });
  await pushMessageUpdated(updated);
}

// An unsent or removed message loses its words for both people, live.
async function pushMessageUpdated(message: MessageRow) {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: message.conversationId },
    select: { userLowId: true, userHighId: true },
  });
  if (!conversation) return;
  for (const userId of [conversation.userLowId, conversation.userHighId]) {
    pushTo(userId, 'dm:message-updated', { conversationId: message.conversationId, message: serializeMessage(message, userId) }, false);
  }
}

export async function currentStatus(messageId: string) {
  const m = await prisma.directMessage.findUnique({ where: { id: messageId }, select: { status: true } });
  return m?.status ?? null;
}

// ─── Who can I message? (the profile's button) ───

export async function canMessage(actor: Actor, userId: string) {
  if (!isUuid(userId) || userId === actor.id) return { allowed: false, conversationId: null, reason: 'SELF' };
  const user = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, dmPolicy: true },
  });
  if (!user || (await isBlockedBetween(actor.id, userId))) return { allowed: false, conversationId: null, reason: 'NOT_FOUND' };
  const [low, high] = pairOf(actor.id, userId);
  const existing = await prisma.directConversation.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    select: { id: true, status: true, initiatorId: true },
  });
  if (existing) {
    const declinedForMe = existing.status === S.DECLINED && existing.initiatorId === actor.id;
    return { allowed: !declinedForMe, conversationId: declinedForMe ? null : existing.id, reason: declinedForMe ? 'UNAVAILABLE' : null };
  }
  if (user.dmPolicy === 'NOBODY') return { allowed: false, conversationId: null, reason: 'CLOSED' };
  return { allowed: true, conversationId: null, reason: null };
}

