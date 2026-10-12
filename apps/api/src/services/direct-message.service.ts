import { ConversationStatus, DirectMessageKind, DirectMessageStatus, FollowStatus, FollowTargetType, MediaKind, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { decryptField, encryptField } from '../utils/field-crypto';
import { ApiError, isUuid } from '../utils/http';
import { hiddenFor, isBlockedBetween } from './block.service';
import type { Actor } from './permission.service';
import { emitToUser } from './realtime.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';
import { signedReadUrl } from './storage.service';

// Direct messages (D71, widened by D73; D71 supersedes D8).
//
// Two hashers, no groups. A message is words, photos or clips, a sticker or a
// voice note. What keeps it from becoming a way to harass somebody:
//
//   - Anyone can ask; only people the recipient follows or shares a kennel with
//     arrive in the inbox. Everyone else arrives as a request, and the asker may
//     send exactly one message until it is accepted. That one message is words:
//     pictures, stickers and voice need the conversation to be accepted first.
//   - Block ends it in both directions and answers 404, so a block does not
//     announce itself (D60). Mute keeps the conversation but silences it.
//   - `User.dmPolicy = NOBODY` closes the door to new conversations.
//   - Bodies are encrypted at rest and never reach a notification, an event
//     payload or a log. Files are private: served only by short-lived signed
//     addresses to the two people in the conversation. Staff cannot read a
//     conversation; they see only what a reporter files, as a snapshot
//     (ReportTargetType.DIRECT_MESSAGE).
//   - History is append-only. A message cannot be unsent (D73); the sender can
//     fix the words for two minutes, and what it said before is kept.

export const MAX_BODY = 2000;
export const MAX_CAPTION = 1000;
export const MAX_ATTACHMENTS = 10;
// How long after sending a message's words may be edited (D73).
export const EDIT_WINDOW_MS = 2 * 60 * 1000;
const MAX_EDITS = 5;
const PER_WINDOW = 60;
const WINDOW_MS = 10 * 60 * 1000;
const NEW_PER_DAY = 20;
const REPORT_CONTEXT = 5;

const S = ConversationStatus;
const K = DirectMessageKind;

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

// Returns how many of the hasher's devices were connected to hear it.
function pushTo(userId: string, event: string, payload: Record<string, unknown>, withUnread = true) {
  const heard = emitToUser(userId, event, payload);
  if (withUnread) void pushUnread(userId).catch(() => undefined);
  return heard;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanBody(raw: unknown) {
  if (typeof raw !== 'string') throw ApiError.badRequest('Write something first.', 'BODY_REQUIRED');
  const body = raw.replace(CONTROL, '').trim();
  if (!body) throw ApiError.badRequest('Write something first.', 'BODY_REQUIRED');
  if (body.length > MAX_BODY) {
    throw ApiError.badRequest(`Keep it under ${MAX_BODY} characters.`, 'BODY_TOO_LONG');
  }
  return body;
}

// A caption may be empty: the picture is the message.
function cleanCaption(raw: unknown) {
  if (raw == null || raw === '') return '';
  if (typeof raw !== 'string') throw ApiError.badRequest('That caption is not text.', 'BODY_INVALID');
  const body = raw.replace(CONTROL, '').trim();
  if (body.length > MAX_CAPTION) {
    throw ApiError.badRequest(`Keep a caption under ${MAX_CAPTION} characters.`, 'BODY_TOO_LONG');
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

// ─── Presenting a message ───

const parts = { attachments: { orderBy: { position: 'asc' as const } }, sticker: true } satisfies Prisma.DirectMessageInclude;
type MessageRow = Prisma.DirectMessageGetPayload<{ include: typeof parts }>;

export type Receipt = 'SENT' | 'DELIVERED' | 'SEEN';

// What the other person's side of the conversation says about my messages. Only
// an accepted conversation tells anybody anything (D71: a request learns nothing),
// and "seen" needs both people to have receipts on (D73).
interface Receipts {
  show: boolean;
  deliveredAt: Date | null;
  readAt: Date | null;
  seen: boolean;
}

async function receiptsFor(conversationId: string, me: string): Promise<Receipts> {
  const c = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    select: {
      status: true,
      userLowId: true,
      userHighId: true,
      participants: { select: { userId: true, deliveredAt: true, lastReadAt: true } },
    },
  });
  if (!c) return { show: false, deliveredAt: null, readAt: null, seen: false };
  const otherId = otherOf(c, me);
  const other = c.participants.find((p) => p.userId === otherId);
  const people = await prisma.user.findMany({ where: { id: { in: [me, otherId] } }, select: { readReceipts: true } });
  return {
    show: c.status === S.ACTIVE,
    deliveredAt: other?.deliveredAt ?? null,
    readAt: other?.lastReadAt ?? null,
    seen: people.length === 2 && people.every((p) => p.readReceipts),
  };
}

function receiptOf(m: { createdAt: Date }, r?: Receipts): Receipt {
  if (!r?.show) return 'SENT';
  if (r.seen && r.readAt && r.readAt >= m.createdAt) return 'SEEN';
  if ((r.deliveredAt && r.deliveredAt >= m.createdAt) || (r.readAt && r.readAt >= m.createdAt)) return 'DELIVERED';
  return 'SENT';
}

async function presentOne(m: MessageRow, me: string, receipts?: Receipts) {
  const live = m.status === DirectMessageStatus.SENT;
  const own = m.senderId === me;
  const withinWindow = Date.now() - m.createdAt.getTime() < EDIT_WINDOW_MS;
  const editable = own && live && (m.kind === K.TEXT || m.kind === K.MEDIA) && withinWindow;
  // A removed message keeps its place and loses its words and its files.
  const attachments = live
    ? await Promise.all(
        m.attachments.map(async (a) => ({
          id: a.id,
          kind: a.kind,
          mimeType: a.mimeType,
          url: await signedReadUrl(a.storageKey),
          width: a.width,
          height: a.height,
          durationSec: a.durationSec,
          sizeBytes: a.sizeBytes,
        })),
      )
    : [];
  const sticker =
    live && m.sticker
      ? { id: m.sticker.id, url: await signedReadUrl(m.sticker.storageKey), width: m.sticker.width, height: m.sticker.height }
      : null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    mine: own,
    kind: m.kind,
    body: live ? decryptField(m.body) : null,
    status: m.status,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    // The moment the edit window shuts, for the person who can still use it.
    editableUntil: editable ? new Date(m.createdAt.getTime() + EDIT_WINDOW_MS) : null,
    attachments,
    sticker,
    receipt: own && live ? receiptOf(m, receipts) : null,
  };
}

export type SerializedMessage = Awaited<ReturnType<typeof presentOne>>;

async function present(rows: MessageRow[], me: string, receipts?: Receipts) {
  return Promise.all(rows.map((m) => presentOne(m, me, receipts)));
}

// The line the inbox shows under a name. The kind, never more than the words.
function previewOf(m: MessageRow) {
  if (m.status === DirectMessageStatus.DELETED) return 'Message deleted';
  if (m.status === DirectMessageStatus.REMOVED) return 'Removed by moderators';
  const caption = decryptField(m.body).slice(0, 140);
  switch (m.kind) {
    case K.MEDIA: {
      if (caption) return caption;
      const videos = m.attachments.filter((a) => a.kind === MediaKind.VIDEO).length;
      const photos = m.attachments.length - videos;
      if (photos && videos) return `${m.attachments.length} items`;
      if (videos) return videos === 1 ? 'Video' : `${videos} videos`;
      return photos === 1 ? 'Photo' : `${photos} photos`;
    }
    case K.STICKER:
      return 'Sticker';
    case K.VOICE:
      return 'Voice message';
    default:
      return caption;
  }
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

/** For the media and sticker services: who is allowed to attach what to this conversation. */
export async function conversationFor(actor: Actor, id: string) {
  const { conversation } = await load(actor, id);
  return {
    id: conversation.id,
    status: conversation.status,
    // The asker cannot send pictures, stickers or voice until it is accepted.
    mayShareFiles: !(conversation.initiatorId === actor.id && conversation.status !== S.ACTIVE),
  };
}

/** Whether this hasher has been sent, or has sent, this sticker. */
export async function hasSeenSticker(userId: string, stickerId: string) {
  const found = await prisma.directMessage.findFirst({
    where: {
      stickerId,
      status: DirectMessageStatus.SENT,
      conversation: { OR: [{ userLowId: userId }, { userHighId: userId }] },
    },
    select: { id: true },
  });
  return Boolean(found);
}

/** The stickers this hasher has sent most recently, newest first, once each. */
export async function recentStickerIds(userId: string, limit = 30) {
  const rows = await prisma.directMessage.findMany({
    where: { senderId: userId, kind: K.STICKER, status: DirectMessageStatus.SENT, stickerId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { stickerId: true },
    take: limit * 4,
  });
  return [...new Set(rows.map((r) => r.stickerId as string))].slice(0, limit);
}

// ─── Sending ───

export interface SendInput {
  kind?: DirectMessageKind;
  body?: string;
  attachmentIds?: string[];
  stickerId?: string;
  clientKey?: string;
}

interface Content {
  kind: DirectMessageKind;
  body: string;
  attachmentIds: string[];
  stickerId: string | null;
}

// Checks what is being sent against what the sender is allowed to send here.
async function prepare(actor: Actor, conversation: { id: string; status: ConversationStatus; initiatorId: string }, input: SendInput): Promise<Content> {
  const kind = input.kind ?? K.TEXT;
  if (kind === K.TEXT) {
    return { kind, body: cleanBody(input.body), attachmentIds: [], stickerId: null };
  }

  // Pictures, stickers and voice come from people already in the conversation.
  if (conversation.initiatorId === actor.id && conversation.status !== S.ACTIVE) {
    throw ApiError.forbidden('Wait for them to accept before you send pictures, stickers or voice.', 'DM_MEDIA_NEEDS_ACCEPT');
  }

  if (kind === K.STICKER) {
    if (!input.stickerId || !isUuid(input.stickerId)) throw ApiError.badRequest('Pick a sticker.', 'STICKER_REQUIRED');
    const sticker = await prisma.sticker.findFirst({ where: { id: input.stickerId, confirmedAt: { not: null } }, select: { id: true, ownerId: true, deletedAt: true } });
    const usable = sticker && (sticker.ownerId === actor.id ? !sticker.deletedAt : await hasSeenSticker(actor.id, sticker.id));
    if (!usable) throw ApiError.notFound('Sticker not found');
    return { kind, body: '', attachmentIds: [], stickerId: sticker.id };
  }

  const ids = [...new Set(input.attachmentIds ?? [])];
  const wanted: MediaKind[] = kind === K.VOICE ? [MediaKind.AUDIO] : [MediaKind.PHOTO, MediaKind.VIDEO];
  if (kind === K.VOICE ? ids.length !== 1 : ids.length < 1 || ids.length > MAX_ATTACHMENTS) {
    throw ApiError.badRequest(
      kind === K.VOICE ? 'A voice message is one recording.' : `Send between 1 and ${MAX_ATTACHMENTS} photos or clips.`,
      'ATTACHMENTS_INVALID',
    );
  }
  if (ids.some((id) => !isUuid(id))) throw ApiError.badRequest('Those files are not available.', 'ATTACHMENTS_INVALID');
  const files = await prisma.directAttachment.findMany({
    where: { id: { in: ids }, uploaderId: actor.id, conversationId: conversation.id, messageId: null, state: 'READY' },
    select: { id: true, kind: true },
  });
  if (files.length !== ids.length || files.some((f) => !wanted.includes(f.kind))) {
    throw ApiError.badRequest('Those files are not available.', 'ATTACHMENTS_INVALID');
  }
  return { kind, body: kind === K.MEDIA ? cleanCaption(input.body) : '', attachmentIds: ids, stickerId: null };
}

export async function startWith(actor: Actor, userId: string, input: SendInput) {
  const target = await reachableUser(actor, userId);
  const [low, high] = pairOf(actor.id, target.id);

  const existing = await prisma.directConversation.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    select: { id: true },
  });
  if (existing) return sendInto(actor, existing.id, input);

  // A first message is words: a stranger is not sent a picture (D73).
  if ((input.kind ?? K.TEXT) !== K.TEXT) {
    throw ApiError.badRequest('Start with a few words.', 'DM_FIRST_MESSAGE_TEXT');
  }
  const first: SendInput = { kind: K.TEXT, body: cleanBody(input.body), clientKey: input.clientKey };

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
    return await sendInto(actor, conversation.id, first);
  } catch (error) {
    // Two people wrote first at the same moment: the pair is one row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.directConversation.findUniqueOrThrow({
        where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
        select: { id: true },
      });
      return sendInto(actor, raced.id, first);
    }
    throw error;
  }
}

export async function send(actor: Actor, conversationId: string, input: SendInput) {
  return sendInto(actor, conversationId, input);
}

async function sendInto(actor: Actor, conversationId: string, input: SendInput) {
  const { conversation, otherId } = await load(actor, conversationId);
  const clientKey = input.clientKey;

  const other = await prisma.user.findFirst({
    where: { id: otherId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!other) throw ApiError.notFound('Conversation not found');

  if (clientKey) {
    const again = await prisma.directMessage.findUnique({
      where: { conversationId_senderId_clientKey: { conversationId, senderId: actor.id, clientKey } },
      include: parts,
    });
    if (again) {
      return {
        message: (await present([again], actor.id))[0],
        conversationId,
        status: statusFor(conversation.status, conversation.initiatorId === actor.id),
      };
    }
  }

  const content = await prepare(actor, conversation, input);

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
      data: {
        conversationId,
        senderId: actor.id,
        kind: content.kind,
        body: encryptField(content.body),
        stickerId: content.stickerId,
        clientKey: clientKey ?? null,
      },
    });
    // Files are claimed by this message and no other: a double send of the same
    // upload loses the race here and nothing is written.
    if (content.attachmentIds.length) {
      for (const [position, id] of content.attachmentIds.entries()) {
        const claimed = await tx.directAttachment.updateMany({
          where: { id, uploaderId: actor.id, conversationId, messageId: null, state: 'READY' },
          data: { messageId: created.id, position },
        });
        if (claimed.count !== 1) throw ApiError.conflict('Those files were already sent.', 'ATTACHMENTS_USED');
      }
    }
    await tx.directConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: created.createdAt,
        ...(accepting ? { status: nextStatus, acceptedAt: now, declinedAt: null } : {}),
      },
    });
    // Sending reads everything before it; new words bring the other side's
    // conversation back from the archive.
    await tx.directParticipant.updateMany({ where: { conversationId, userId: actor.id }, data: { lastReadAt: now, deliveredAt: now, archivedAt: null } });
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
    // The payload names ids and a kind, never the words (D71).
    await recordEvent(tx, {
      eventType: 'DirectMessageSent',
      aggregateType: 'DirectConversation',
      aggregateId: conversationId,
      actorId: actor.id,
      payload: { messageId: created.id, recipientId: otherId, requested: nextStatus === S.REQUESTED, kind: content.kind },
    });
    return tx.directMessage.findUniqueOrThrow({ where: { id: created.id }, include: parts });
  });

  const recipientAsks = otherId === conversation.initiatorId;
  const [forThem, forMe] = await Promise.all([present([message], otherId), present([message], actor.id)]);
  const heard = pushTo(otherId, 'dm:message', {
    conversationId,
    message: forThem[0],
    status: statusFor(nextStatus, recipientAsks),
    isRequest: nextStatus === S.REQUESTED && !recipientAsks,
  });
  // The sender's other devices see it too.
  pushTo(actor.id, 'dm:message', {
    conversationId,
    message: forMe[0],
    status: statusFor(nextStatus, asker),
    isRequest: false,
  });
  if (accepting) {
    pushTo(otherId, 'dm:conversation', { conversationId, status: nextStatus }, false);
    pushTo(actor.id, 'dm:conversation', { conversationId, status: nextStatus }, false);
  }
  // A device that was connected received it: that is delivery (D73). Otherwise
  // it is delivered the next time they open the app and ask.
  if (heard > 0) void markDelivered(otherId, [conversationId]).catch(() => undefined);

  return { message: forMe[0], conversationId, status: statusFor(nextStatus, asker) };
}

// ─── Reading ───

export async function listMine(actor: Actor, opts: { box: 'inbox' | 'requests'; page: number; limit: number }) {
  void markDelivered(actor.id).catch(() => undefined);
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
        prisma.directMessage.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' }, include: parts }),
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
          ? {
              id: last.id,
              mine: last.senderId === actor.id,
              kind: last.kind,
              status: last.status,
              // Words for a text message, a label for the rest ("Photo", "Sticker").
              preview: previewOf(last),
              body: last.status === DirectMessageStatus.SENT && last.kind === K.TEXT ? decryptField(last.body).slice(0, 140) : null,
              createdAt: last.createdAt,
            }
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
  void markDelivered(actor.id, [id]).catch(() => undefined);
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
    // Pictures, stickers and voice wait for the conversation to be accepted (D73).
    canShareFiles: canReply && !(asker && conversation.status !== S.ACTIVE),
    editWindowMs: EDIT_WINDOW_MS,
    createdAt: conversation.createdAt,
  };
}

// Newest page first, then older ones with `before`. The caller reverses.
export async function messages(actor: Actor, id: string, opts: { before?: string; limit: number }) {
  await load(actor, id);
  void markDelivered(actor.id, [id]).catch(() => undefined);
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
    include: parts,
  });
  const hasMore = rows.length > opts.limit;
  const page = rows.slice(0, opts.limit);
  return { items: await present(page, actor.id, await receiptsFor(id, actor.id)), hasMore };
}

// Newer than a message the client already has: what polling asks for. Also
// answers "did anything change since", because it carries the current receipts
// of what I sent.
export async function messagesAfter(actor: Actor, id: string, afterId: string) {
  await load(actor, id);
  void markDelivered(actor.id, [id]).catch(() => undefined);
  if (!isUuid(afterId)) throw ApiError.badRequest('Bad cursor.', 'BAD_CURSOR');
  const anchor = await prisma.directMessage.findFirst({ where: { id: afterId, conversationId: id }, select: { createdAt: true } });
  const rows = await prisma.directMessage.findMany({
    where: { conversationId: id, ...(anchor ? { createdAt: { gt: anchor.createdAt } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: parts,
  });
  const receipts = await receiptsFor(id, actor.id);
  return {
    items: await present(rows, actor.id, receipts),
    receipts: receipts.show
      ? { deliveredAt: receipts.deliveredAt, seenAt: receipts.seen ? receipts.readAt : null }
      : { deliveredAt: null, seenAt: null },
  };
}

export async function markRead(actor: Actor, id: string) {
  await load(actor, id);
  const now = new Date();
  await prisma.directParticipant.updateMany({ where: { conversationId: id, userId: actor.id }, data: { lastReadAt: now, deliveredAt: now } });
  // The reader's own devices clear their badge.
  pushTo(actor.id, 'dm:read', { conversationId: id });
  // The sender sees "seen" if both of them have receipts on (D73).
  void announceReceipt(id, actor.id).catch(() => undefined);
  return { read: true };
}

// Tells the other person where the conversation now stands for what they sent.
// Silent for a request or a declined one: nothing reveals that it was opened (D71).
async function announceReceipt(conversationId: string, readerId: string) {
  const c = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    select: { userLowId: true, userHighId: true },
  });
  if (!c) return;
  const senderId = otherOf(c, readerId);
  const r = await receiptsFor(conversationId, senderId);
  if (!r.show) return;
  emitToUser(senderId, 'dm:receipt', {
    conversationId,
    deliveredAt: r.deliveredAt,
    seenAt: r.seen ? r.readAt : null,
  });
}

/**
 * A device of theirs received the conversation (D73). Called when something is
 * pushed to a connected socket, and whenever the app asks for its inbox or a
 * thread, which is what a phone that was asleep does on waking.
 */
export async function markDelivered(userId: string, only?: string[]) {
  const due = await prisma.$queryRaw<{ conversationId: string }[]>`
    SELECT p."conversationId" AS "conversationId"
    FROM "DirectParticipant" p
    WHERE p."userId" = ${userId}::uuid
      ${only ? Prisma.sql`AND p."conversationId" = ANY(${only}::uuid[])` : Prisma.empty}
      AND EXISTS (
        SELECT 1 FROM "DirectMessage" m
        WHERE m."conversationId" = p."conversationId"
          AND m."senderId" <> p."userId"
          AND (p."deliveredAt" IS NULL OR m."createdAt" > p."deliveredAt")
      )`;
  if (due.length === 0) return;
  const ids = due.map((d) => d.conversationId);
  await prisma.directParticipant.updateMany({ where: { userId, conversationId: { in: ids } }, data: { deliveredAt: new Date() } });
  await Promise.all(ids.map((id) => announceReceipt(id, userId)));
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

// The header badge asking is a device of theirs being awake: that is delivery too.
export async function unreadFor(actor: Actor) {
  void markDelivered(actor.id).catch(() => undefined);
  return unreadCount(actor);
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
    // Now that it is open, the asker learns what has happened to what they sent.
    void announceReceipt(id, actor.id).catch(() => undefined);
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

// ─── Editing (D73) ───

// The sender may fix the words for two minutes. What it said before is kept
// (history is append-only), shown to staff if the message is ever reported, and
// the message says "Edited" to both people. Unsending was withdrawn: there is no
// way to make a sent message disappear.
export async function edit(actor: Actor, messageId: string, rawBody: unknown) {
  if (!isUuid(messageId)) throw ApiError.notFound('Message not found');
  const message = await prisma.directMessage.findFirst({
    where: { id: messageId, senderId: actor.id },
    include: { ...parts, _count: { select: { edits: true } } },
  });
  if (!message) throw ApiError.notFound('Message not found');
  await load(actor, message.conversationId);

  if (message.status !== DirectMessageStatus.SENT || (message.kind !== K.TEXT && message.kind !== K.MEDIA)) {
    throw ApiError.badRequest('That message cannot be edited.', 'DM_NOT_EDITABLE');
  }
  if (Date.now() - message.createdAt.getTime() >= EDIT_WINDOW_MS) {
    throw new ApiError(409, 'You can only edit a message for two minutes after sending it.', 'DM_EDIT_WINDOW_CLOSED');
  }
  if (message._count.edits >= MAX_EDITS) {
    throw new ApiError(409, 'That message has been edited as many times as it can be.', 'DM_EDIT_LIMIT');
  }
  const next = message.kind === K.TEXT ? cleanBody(rawBody) : cleanCaption(rawBody);
  if (next === decryptField(message.body)) return { message: (await present([message], actor.id, await receiptsFor(message.conversationId, actor.id)))[0] };

  const updated = await prisma.$transaction(async (tx) => {
    await tx.directMessageEdit.create({ data: { messageId, previousBody: message.body } });
    const row = await tx.directMessage.update({
      where: { id: messageId },
      data: { body: encryptField(next), editedAt: new Date() },
      include: parts,
    });
    // Ids only, never the words (D71).
    await recordEvent(tx, {
      eventType: 'DirectMessageEdited',
      aggregateType: 'DirectConversation',
      aggregateId: message.conversationId,
      actorId: actor.id,
      payload: { messageId },
    });
    return row;
  });
  await pushMessageUpdated(updated);
  return { message: (await present([updated], actor.id, await receiptsFor(updated.conversationId, actor.id)))[0] };
}

// ─── Reporting and moderation ───

// What a report about a message keeps: the message and the few before it, so a
// moderator can read it in context. The only way staff ever see a conversation,
// and only because one of its two people chose to show it. A message that was
// edited shows what it first said, so tidying it up afterwards hides nothing.
export async function inspectForReport(actor: Actor, messageId: string) {
  if (!isUuid(messageId)) throw ApiError.notFound('Message not found');
  const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  await load(actor, message.conversationId);
  const context = await prisma.directMessage.findMany({
    where: { conversationId: message.conversationId, createdAt: { lte: message.createdAt }, status: DirectMessageStatus.SENT },
    orderBy: { createdAt: 'desc' },
    take: REPORT_CONTEXT + 1,
    include: { attachments: { orderBy: { position: 'asc' } }, edits: { orderBy: { editedAt: 'asc' } } },
  });
  const messages = context.reverse().map((m) => ({
    id: m.id,
    senderId: m.senderId,
    kind: m.kind,
    body: decryptField(m.body),
    // Oldest first: the first entry is what was sent before any edit.
    editedFrom: m.edits.map((e) => decryptField(e.previousBody)),
    // Ids and shapes only; staff fetch a signed address per file, one report at a time.
    attachments: m.attachments.map((a) => ({ id: a.id, kind: a.kind, mimeType: a.mimeType, durationSec: a.durationSec })),
    stickerId: m.stickerId,
    createdAt: m.createdAt.toISOString(),
    reported: m.id === messageId,
  }));
  return { targetUserId: message.senderId, snapshot: { kind: 'DIRECT_MESSAGE', conversationId: message.conversationId, messages } };
}

/** For staff, on a report that names it: one file of a reported message, for a few minutes. */
export async function reportedAttachmentUrl(attachmentId: string, allowedIds: string[]) {
  if (!isUuid(attachmentId) || !allowedIds.includes(attachmentId)) throw ApiError.notFound('File not found');
  const file = await prisma.directAttachment.findUnique({ where: { id: attachmentId }, select: { storageKey: true, mimeType: true, kind: true } });
  if (!file) throw ApiError.notFound('File not found');
  return { url: await signedReadUrl(file.storageKey, 5 * 60), mimeType: file.mimeType, kind: file.kind };
}

/** The sticker a reported message showed, for staff. */
export async function reportedStickerUrl(stickerId: string, allowedIds: string[]) {
  if (!isUuid(stickerId) || !allowedIds.includes(stickerId)) throw ApiError.notFound('File not found');
  const sticker = await prisma.sticker.findUnique({ where: { id: stickerId }, select: { storageKey: true, mimeType: true } });
  if (!sticker) throw ApiError.notFound('File not found');
  return { url: await signedReadUrl(sticker.storageKey, 5 * 60), mimeType: sticker.mimeType, kind: 'STICKER' };
}

export async function removeByModeration(actor: Actor, messageId: string, reason: string) {
  const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.status === DirectMessageStatus.REMOVED) return;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.directMessage.update({
      where: { id: messageId },
      data: { status: DirectMessageStatus.REMOVED, removedAt: new Date(), removedReason: reason },
      include: parts,
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

// An edited or removed message changes for both people, live.
async function pushMessageUpdated(message: MessageRow) {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: message.conversationId },
    select: { userLowId: true, userHighId: true },
  });
  if (!conversation) return;
  for (const userId of [conversation.userLowId, conversation.userHighId]) {
    const receipts = await receiptsFor(message.conversationId, userId);
    pushTo(userId, 'dm:message-updated', { conversationId: message.conversationId, message: (await present([message], userId, receipts))[0] }, false);
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
