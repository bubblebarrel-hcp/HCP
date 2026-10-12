// D71 checks: direct messages. Requests versus inbox, the one-message limit, a
// silent decline, block, mute, dmPolicy, unsend, encryption at rest, the words
// staying out of notifications, and a report reaching staff with context.
// Run against a local API on the seeded heavy database: `npx tsx scripts/dm-check.ts`.
//
// Direct messages are append-only, so the conversations this makes are removed
// by hand at the start and the end (it is a local test database). Nothing else
// is left behind.

import 'dotenv/config';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const PASSWORD = 'OnOn2026!';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}

type R = { status: number; data?: any; code?: string };
async function call(method: string, path: string, token?: string, body?: unknown): Promise<R> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.code}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string, email };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // ── Cast: a, a stranger b, a second stranger d, somebody who shares a's kennel (k), and a closed door (e).
  const members = await prisma.user.findMany({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE' },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
    take: 60,
  });
  const kennelsOf = async (id: string) =>
    new Set((await prisma.membership.findMany({ where: { userId: id, status: 'ACTIVE' }, select: { kennelId: true } })).map((m) => m.kennelId));

  let cast: { a: typeof members[0]; b: typeof members[0]; d: typeof members[0]; e: typeof members[0]; k: typeof members[0] } | null = null;
  for (const a of members) {
    const ak = await kennelsOf(a.id);
    const strangers: typeof members = [];
    let known: typeof members[0] | undefined;
    for (const m of members) {
      if (m.id === a.id) continue;
      const mk = await kennelsOf(m.id);
      const shares = [...mk].some((x) => ak.has(x));
      if (shares) known ??= m;
      else strangers.push(m);
    }
    if (known && strangers.length >= 3) {
      cast = { a, k: known, b: strangers[0], d: strangers[1], e: strangers[2] };
      break;
    }
  }
  if (!cast) throw new Error('could not find a hasher with three strangers and a kennel-mate in the seed');
  // One more stranger, for the "no pictures until accepted" rule.
  const aKennels = await kennelsOf(cast.a.id);
  let x: typeof members[0] | undefined;
  for (const m of members) {
    if ([cast.a.id, cast.b.id, cast.d.id, cast.e.id, cast.k.id].includes(m.id)) continue;
    if (![...(await kennelsOf(m.id))].some((kid) => aKennels.has(kid))) {
      x = m;
      break;
    }
  }
  if (!x) throw new Error('could not find a fourth stranger');
  const ids = [cast.a.id, cast.b.id, cast.d.id, cast.e.id, cast.k.id, x.id];

  const cleanup = async () => {
    const convs = await prisma.directConversation.findMany({
      where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] },
      select: { id: true },
    });
    const convIds = convs.map((c) => c.id);
    const msgs = await prisma.directMessage.findMany({ where: { conversationId: { in: convIds } }, select: { id: true } });
    // Files and stickers (D73): the rows, then what the local driver wrote to disk.
    await prisma.directAttachment.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directMessageEdit.deleteMany({ where: { messageId: { in: msgs.map((m) => m.id) } } });
    const reports = await prisma.contentReport.findMany({
      where: { targetType: 'DIRECT_MESSAGE', targetId: { in: msgs.map((m) => m.id) } },
      select: { id: true },
    });
    await prisma.contentReport.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } });
    await prisma.notification.deleteMany({ where: { contextType: 'DirectConversation', contextId: { in: convIds } } });
    await prisma.directMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.pushDevice.deleteMany({ where: { pushToken: { startsWith: 'ExponentPushToken[dmcheck-fake' } } });
    await prisma.stickerFavorite.deleteMany({ where: { userId: { in: ids } } });
    await prisma.sticker.deleteMany({ where: { ownerId: { in: ids } } });
    for (const id of convIds) await rm(path.join(process.cwd(), 'uploads', 'dm', id), { recursive: true, force: true });
    for (const id of ids) await rm(path.join(process.cwd(), 'uploads', 'stickers', id), { recursive: true, force: true });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { dmPolicy: 'EVERYONE', readReceipts: true } });
    await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: { in: ids }, blockedId: { in: ids } }] } });
    await prisma.follow.deleteMany({ where: { followerId: { in: ids }, targetType: 'USER', targetId: { in: ids } } });
  };
  await cleanup();

  const a = await login(cast.a.email);
  const b = await login(cast.b.email);
  const d = await login(cast.d.email);
  const e = await login(cast.e.email);
  const k = await login(cast.k.email);
  const admin = await login('admin@hcp.test');

  // ── Signed out ──
  check('signed out cannot list', (await call('GET', '/me/conversations')).status === 401);

  // ── Validation ──
  let r = await call('POST', '/conversations', a.token, { userId: b.id, body: '   ' });
  check('blank body refused', r.status === 400, r);
  r = await call('POST', '/conversations', a.token, { userId: b.id, body: 'x'.repeat(2001) });
  check('2001 characters refused', r.status === 400 && r.code === 'BODY_TOO_LONG', r);
  r = await call('POST', '/conversations', a.token, { userId: a.id, body: 'me' });
  check('cannot message yourself', r.status === 400 && r.code === 'SELF', r);
  r = await call('POST', '/conversations', a.token, { userId: '00000000-0000-4000-8000-000000000000', body: 'hi' });
  check('unknown hasher is 404', r.status === 404, r);

  // ── A stranger: arrives as a request ──
  r = await call('GET', `/hashers/${b.id}/can-message`, a.token);
  check('can-message allowed', r.status === 200 && r.data.allowed === true && r.data.conversationId === null, r);

  const secret = 'check-secret-words-7731';
  r = await call('POST', '/conversations', a.token, { userId: b.id, body: secret, clientKey: 'k1' });
  check('stranger message created', r.status === 201 && r.data.status === 'REQUESTED', r);
  const abId = r.data.conversationId as string;
  const firstMsg = r.data.message.id as string;
  check('sender sees own words', r.data.message.body === secret && r.data.message.mine === true, r);

  r = await call('POST', `/conversations/${abId}/messages`, a.token, { body: 'again', clientKey: 'k1' });
  check('same clientKey is the same message', r.status === 201 && r.data.message.id === firstMsg, r);
  r = await call('POST', `/conversations/${abId}/messages`, a.token, { body: 'second before accept' });
  check('one message until accepted', r.status === 409 && r.code === 'DM_REQUEST_PENDING', r);

  const row = await prisma.directMessage.findUniqueOrThrow({ where: { id: firstMsg } });
  check('body is encrypted at rest', row.body.startsWith('v1:') && !row.body.includes(secret), row.body.slice(0, 20));

  // Recipient: in requests, not the inbox.
  let inbox = (await call('GET', '/me/conversations?box=inbox', b.token)).data.items as any[];
  let requests = (await call('GET', '/me/conversations?box=requests', b.token)).data.items as any[];
  check('request is not in the inbox', !inbox.some((c) => c.id === abId));
  check('request is in requests', requests.some((c) => c.id === abId && c.isRequest === true && c.unreadCount === 1), requests);
  let unread = (await call('GET', '/me/conversations/unread', b.token)).data;
  check('requests counted apart from unread', unread.requests === 1 && unread.unread === 0, unread);

  // Sender sees it in their inbox, as pending.
  inbox = (await call('GET', '/me/conversations', a.token)).data.items as any[];
  check('asker sees it as a pending request', inbox.some((c) => c.id === abId && c.status === 'REQUESTED' && c.isRequest === false), inbox);

  // A non-participant cannot find it.
  r = await call('GET', `/conversations/${abId}`, d.token);
  check('outsider gets 404', r.status === 404, r);
  r = await call('GET', `/conversations/${abId}/messages`, d.token);
  check('outsider cannot read messages', r.status === 404, r);

  // Notification: who, never what.
  await wait(7000);
  const notes = (await call('GET', '/me/notifications?limit=20', b.token)).data.items as any[];
  const note = notes.find((n) => n.contextType === 'DirectConversation' && n.contextId === abId);
  check('recipient is notified', Boolean(note) && note.category === 'MESSAGE', notes.slice(0, 3));
  check('notification never carries the words', note && !JSON.stringify(note).includes(secret), note);
  check('request notification says so', note && /wants to message you/.test(note.title), note?.title);
  const events = await prisma.domainEvent.findMany({ where: { aggregateId: abId } });
  check('events never carry the words', events.length >= 1 && !JSON.stringify(events).includes(secret));

  // Accept.
  r = await call('POST', `/conversations/${abId}/accept`, b.token);
  check('recipient accepts', r.status === 200 && r.data.status === 'ACTIVE', r);
  r = await call('POST', `/conversations/${abId}/accept`, a.token);
  check('the asker cannot accept their own request', r.status === 400, r);
  r = await call('POST', `/conversations/${abId}/messages`, a.token, { body: 'now we can talk' });
  check('asker can send after accept', r.status === 201 && r.data.status === 'ACTIVE', r);
  r = await call('POST', `/conversations/${abId}/messages`, b.token, { body: 'hello back' });
  check('recipient replies', r.status === 201, r);
  const bReplyId = r.data.message.id as string;

  unread = (await call('GET', '/me/conversations/unread', a.token)).data;
  check('asker has one unread conversation', unread.unread === 1, unread);
  const msgs = (await call('GET', `/conversations/${abId}/messages`, a.token)).data;
  check('messages come newest first with the words', msgs.items.length === 3 && msgs.items[0].body === 'hello back' && msgs.hasMore === false, msgs);
  r = await call('POST', `/conversations/${abId}/read`, a.token);
  unread = (await call('GET', '/me/conversations/unread', a.token)).data;
  check('reading clears unread', r.status === 200 && unread.unread === 0, unread);
  const after = (await call('GET', `/conversations/${abId}/messages?after=${firstMsg}`, a.token)).data;
  check('after= returns only newer, oldest first', after.items.length === 2 && after.items[0].body === 'now we can talk', after);

  // ── Unsend is gone (D73) ──
  r = await call('DELETE', `/messages/${bReplyId}`, b.token);
  check('there is no unsend', r.status === 404, r);

  // ── Edit, for two minutes (D73) ──
  r = await call('PATCH', `/messages/${bReplyId}`, a.token, { body: 'not mine to edit' });
  check('cannot edit somebody else’s message', r.status === 404, r);
  r = await call('PATCH', `/messages/${bReplyId}`, b.token, { body: '   ' });
  check('an edit cannot be blank', r.status === 400, r);
  r = await call('PATCH', `/messages/${bReplyId}`, b.token, { body: 'hello again' });
  check('sender edits inside the window', r.status === 200 && r.data.message.body === 'hello again' && r.data.message.editedAt !== null, r);
  const edited = (await call('GET', `/conversations/${abId}/messages`, a.token)).data.items.find((m: any) => m.id === bReplyId);
  check('the other side sees the new words and "edited"', edited.body === 'hello again' && edited.editedAt !== null && edited.mine === false, edited);
  check('the first words are kept', (await prisma.directMessageEdit.count({ where: { messageId: bReplyId } })) === 1);
  const editedRow = await prisma.directMessage.findUniqueOrThrow({ where: { id: bReplyId } });
  check('edited body is encrypted too', editedRow.body.startsWith('v1:') && !editedRow.body.includes('hello again'));
  await prisma.directMessage.update({ where: { id: bReplyId }, data: { createdAt: new Date(Date.now() - 3 * 60 * 1000) } });
  r = await call('PATCH', `/messages/${bReplyId}`, b.token, { body: 'too late' });
  check('after two minutes it is final', r.status === 409 && r.code === 'DM_EDIT_WINDOW_CLOSED', r);
  const late = (await call('GET', `/conversations/${abId}/messages`, b.token)).data.items.find((m: any) => m.id === bReplyId);
  check('…and no longer offers an edit', late.editableUntil === null, late);

  // ── Receipts (D73) ──
  // a sent "now we can talk"; b has not opened the thread since.
  const mineList = async (token: string, id: string) => (await call('GET', `/conversations/${abId}/messages`, token)).data.items.find((m: any) => m.id === id);
  const sentByA = (await call('GET', `/conversations/${abId}/messages`, a.token)).data.items.find((m: any) => m.body === 'now we can talk');
  await wait(300);
  // b's earlier calls to the thread count as delivery; the message is at least delivered.
  const viaB = await mineList(a.token, sentByA.id);
  check('a sent message shows a receipt', ['SENT', 'DELIVERED', 'SEEN'].includes(viaB.receipt), viaB);
  r = await call('POST', `/conversations/${abId}/read`, b.token);
  const seenByB = await mineList(a.token, sentByA.id);
  check('seen once the other side reads', seenByB.receipt === 'SEEN', seenByB);
  check('somebody else’s message has no receipt', (await mineList(a.token, bReplyId)).receipt === null);
  await call('PATCH', '/me/privacy', b.token, { readReceipts: false });
  const hidden = await mineList(a.token, sentByA.id);
  check('with receipts off, "seen" is hidden both ways', hidden.receipt === 'DELIVERED', hidden);
  await call('PATCH', '/me/privacy', b.token, { readReceipts: true });
  r = await call('PATCH', '/me/privacy', a.token, { readReceipts: false });
  check('readReceipts is a privacy setting', r.status === 200 && r.data.readReceipts === false, r);
  const hiddenFromB = await mineList(b.token, bReplyId);
  check('…and a reader with receipts off sees none either', hiddenFromB.receipt === 'DELIVERED', hiddenFromB);
  await call('PATCH', '/me/privacy', a.token, { readReceipts: true });

  // ── Report: only the reporter shows staff; staff see context, not the thread ──
  const reported = (await call('GET', `/conversations/${abId}/messages`, b.token)).data.items.find((m: any) => m.body === 'now we can talk');
  r = await call('POST', '/reports', b.token, { targetType: 'DIRECT_MESSAGE', targetId: reported.id, reason: 'HARASSMENT' });
  check('recipient reports a message', r.status === 201, r);
  const reportId = r.data.id as string;
  r = await call('POST', '/reports', a.token, { targetType: 'DIRECT_MESSAGE', targetId: reported.id, reason: 'SPAM' });
  check('cannot report your own message', r.status === 400 && r.code === 'OWN_CONTENT', r);
  r = await call('POST', '/reports', d.token, { targetType: 'DIRECT_MESSAGE', targetId: reported.id, reason: 'SPAM' });
  check('an outsider cannot report it', r.status === 404, r);
  const detail = await call('GET', `/admin/reports/${reportId}`, admin.token);
  const snap = detail.data?.report?.snapshot;
  check('staff see the message in context', detail.status === 200 && snap?.kind === 'DIRECT_MESSAGE' && snap.messages.some((m: any) => m.reported && m.body === 'now we can talk') && snap.messages.length === 3 && snap.messages.some((m: any) => m.editedFrom?.[0] === 'hello back'), detail);
  r = await call('POST', `/admin/reports/${reportId}/actions`, admin.token, { kind: 'REMOVE_CONTENT', note: 'Check removal' });
  check('staff remove the message', r.status === 200, r);
  const removed = await prisma.directMessage.findUniqueOrThrow({ where: { id: reported.id } });
  check('message is REMOVED and kept', removed.status === 'REMOVED' && removed.removedReason === 'Check removal');
  const nowSeen = (await call('GET', `/conversations/${abId}/messages`, b.token)).data.items.find((m: any) => m.id === reported.id);
  check('removed message loses its words for both', nowSeen.body === null && nowSeen.status === 'REMOVED', nowSeen);

  // ── Block: ends it both ways and answers 404 ──
  await call('PUT', `/hashers/${a.id}/block`, b.token);
  r = await call('GET', `/conversations/${abId}`, a.token);
  check('blocked side gets 404, not 403', r.status === 404, r);
  r = await call('POST', `/conversations/${abId}/messages`, a.token, { body: 'let me in' });
  check('blocked side cannot send', r.status === 404, r);
  r = await call('POST', `/conversations/${abId}/messages`, b.token, { body: 'i blocked you' });
  check('the blocker cannot send either', r.status === 404, r);
  inbox = (await call('GET', '/me/conversations', a.token)).data.items as any[];
  check('blocked conversation leaves both lists', !inbox.some((c) => c.id === abId));
  inbox = (await call('GET', '/me/conversations', b.token)).data.items as any[];
  check('…the blocker’s too', !inbox.some((c) => c.id === abId));
  r = await call('GET', `/hashers/${b.id}/can-message`, a.token);
  check('can-message reports not found while blocked', r.data.allowed === false && r.data.reason === 'NOT_FOUND', r);
  await call('DELETE', `/hashers/${a.id}/block`, b.token);
  r = await call('GET', `/conversations/${abId}`, a.token);
  check('unblocking brings it back', r.status === 200, r);

  // ── A silent decline: a → d ──
  r = await call('POST', '/conversations', a.token, { userId: d.id, body: 'hi d' });
  const adId = r.data.conversationId as string;
  check('second stranger is a request too', r.status === 201 && r.data.status === 'REQUESTED', r);
  r = await call('POST', `/conversations/${adId}/decline`, d.token);
  check('recipient declines', r.status === 200 && r.data.status === 'DECLINED', r);
  r = await call('GET', `/conversations/${adId}`, a.token);
  check('the asker is not told: still REQUESTED', r.status === 200 && r.data.status === 'REQUESTED', r);
  r = await call('POST', `/conversations/${adId}/messages`, a.token, { body: 'hello??' });
  check('declined asker cannot send', r.status === 403 && r.code === 'DM_UNAVAILABLE', r);
  requests = (await call('GET', '/me/conversations?box=requests', d.token)).data.items as any[];
  check('declined request leaves the decliner’s requests', !requests.some((c) => c.id === adId));
  r = await call('GET', `/hashers/${d.id}/can-message`, a.token);
  check('can-message says unavailable after a decline', r.data.allowed === false && r.data.reason === 'UNAVAILABLE', r);
  r = await call('POST', `/conversations/${adId}/messages`, d.token, { body: 'ok, hi' });
  check('the decliner can reopen by replying', r.status === 201 && r.data.status === 'ACTIVE', r);
  r = await call('POST', `/conversations/${adId}/messages`, a.token, { body: 'thanks' });
  check('then the asker can send', r.status === 201, r);

  // ── Somebody who shares a kennel: straight to the inbox ──
  r = await call('POST', '/conversations', a.token, { userId: k.id, body: 'kennel-mate' });
  check('a kennel-mate is not a request', r.status === 201 && r.data.status === 'ACTIVE', r);
  const akId = r.data.conversationId as string;

  // ── Mute: conversation stays, notification stops ──
  r = await call('PUT', `/conversations/${akId}/mute`, k.token, { muted: true });
  check('mute a conversation', r.status === 200 && r.data.muted === true, r);
  const count = async () => (await call('GET', '/me/notifications?limit=50', k.token)).data.items.filter((n: any) => n.contextId === akId).length;
  // Earlier messages may still be in the queue: wait until the count stops moving.
  const stable = async () => {
    let last = -1;
    let still = 0;
    for (let i = 0; i < 20 && still < 3; i++) {
      const n = await count();
      still = n === last ? still + 1 : 0;
      last = n;
      await wait(4000);
    }
    return last;
  };
  const before = await stable();
  await call('POST', `/conversations/${akId}/messages`, a.token, { body: 'are you there' });
  const afterN = await stable();
  check('muted conversation sends no new notification', afterN === before, { before, afterN });
  inbox = (await call('GET', '/me/conversations', k.token)).data.items as any[];
  check('…but still arrives and counts unread', inbox.some((c) => c.id === akId && c.muted === true && c.unreadCount === 2), inbox);

  // ── Archive: leaves my list until something new arrives ──
  r = await call('POST', `/conversations/${akId}/archive`, k.token);
  inbox = (await call('GET', '/me/conversations', k.token)).data.items as any[];
  check('archive hides it from me only', r.status === 200 && !inbox.some((c) => c.id === akId));
  inbox = (await call('GET', '/me/conversations', a.token)).data.items as any[];
  check('…the other side keeps theirs', inbox.some((c) => c.id === akId));
  await call('POST', `/conversations/${akId}/messages`, a.token, { body: 'ping' });
  inbox = (await call('GET', '/me/conversations', k.token)).data.items as any[];
  check('a new message brings it back', inbox.some((c) => c.id === akId));

  // ── Every message is pushed, though the list shows one notice (D73) ──
  const FAKE = 'ExponentPushToken[dmcheck-fake-0000000000]';
  await call('PUT', `/conversations/${akId}/mute`, k.token, { muted: false });
  r = await call('POST', '/me/devices', k.token, { pushToken: FAKE, platform: 'ANDROID' });
  check('a phone is registered for the check', r.status === 201 || r.status === 200, r);
  const pushes = () => prisma.notificationDelivery.count({ where: { channel: 'PUSH', notification: { recipientUserId: k.id, contextId: akId } } });
  // The queue drains in batches: wait until the count stops moving, then count.
  const settled = async () => {
    let last = -1;
    let still = 0;
    for (let i = 0; i < 40 && still < 3; i++) {
      const n = await pushes();
      still = n === last ? still + 1 : 0;
      last = n;
      await wait(4000);
    }
    return last;
  };
  const baseline = await settled();
  for (const word of ['one', 'two', 'three']) {
    // Expo retires a token it cannot find after the first failed send, so each
    // message gets a live device: what is being checked is that every message after
    // the first (which are folded into the unread notice) still tries to push.
    await call('POST', '/me/devices', k.token, { pushToken: FAKE, platform: 'ANDROID' });
    const was = await pushes();
    await call('POST', `/conversations/${akId}/messages`, a.token, { body: word });
    for (let i = 0; i < 20 && (await pushes()) === was; i++) await wait(3000);
  }
  const afterPush = await settled();
  check('each of three messages in a row sent its own push', afterPush - baseline === 3, { baseline, afterPush });
  const grouped = await prisma.notification.count({ where: { recipientUserId: k.id, contextId: akId, groupKey: { not: null }, readAt: null } });
  check('…while the list still holds them as one notice', grouped === 1, grouped);
  await prisma.pushDevice.deleteMany({ where: { pushToken: FAKE } });

  // ── Pictures, voice and stickers (D73) ──
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const put = async (url: string, bytes: Buffer, mime: string) =>
    (await fetch(url, { method: 'PUT', headers: { 'content-type': mime }, body: new Uint8Array(bytes) })).status;
  // Ask, PUT the bytes, confirm: what a client does.
  const uploadFile = async (token: string, convId: string, spec: Record<string, unknown>, bytes: Buffer, confirm: Record<string, unknown> = {}) => {
    const asked = await call('POST', `/conversations/${convId}/uploads`, token, { ...spec, sizeBytes: bytes.length });
    if (asked.status !== 201) return { asked };
    const status = await put(asked.data.upload.url, bytes, String(spec.mimeType).split(';')[0]);
    const confirmed = await call('POST', `/dm-uploads/${asked.data.attachment.id}/confirm`, token, confirm);
    return { asked, putStatus: status, confirmed, id: asked.data.attachment.id as string };
  };

  // Strangers get words only until the conversation is accepted.
  const xu = await login(x.email);
  r = await call('POST', '/conversations', a.token, { userId: xu.id, body: 'hello stranger' });
  const axId = r.data.conversationId as string;
  r = await call('POST', `/conversations/${axId}/uploads`, a.token, { kind: 'PHOTO', mimeType: 'image/png', sizeBytes: PNG.length });
  check('no pictures to a request that is not accepted', r.status === 403 && r.code === 'DM_MEDIA_NEEDS_ACCEPT', r);
  r = await call('POST', `/conversations/${axId}/messages`, a.token, { kind: 'STICKER', stickerId: '00000000-0000-4000-8000-000000000000' });
  check('…nor stickers', r.status === 403 && r.code === 'DM_MEDIA_NEEDS_ACCEPT', r);

  // Photos.
  const up = await uploadFile(a.token, akId, { kind: 'PHOTO', mimeType: 'image/png', width: 1, height: 1 }, PNG, { width: 1, height: 1 });
  check('photo upload is requested, stored and confirmed', up.asked.status === 201 && up.putStatus === 200 && up.confirmed?.status === 200, up);
  check('confirmed photo has a readable address', typeof up.confirmed?.data?.attachment?.url === 'string' && up.confirmed.data.attachment.kind === 'PHOTO', up.confirmed);
  r = await call('POST', `/conversations/${akId}/messages`, a.token, { kind: 'MEDIA', attachmentIds: [up.id], body: 'my caption', clientKey: 'media1' });
  const mediaMsg = r.data?.message;
  check('a picture message is sent with a caption', r.status === 201 && mediaMsg.kind === 'MEDIA' && mediaMsg.body === 'my caption' && mediaMsg.attachments.length === 1 && typeof mediaMsg.attachments[0].url === 'string', r);
  r = await call('POST', `/conversations/${akId}/messages`, a.token, { kind: 'MEDIA', attachmentIds: [up.id] });
  check('a file can be sent only once', r.status === 400 && r.code === 'ATTACHMENTS_INVALID', r);
  const forK = (await call('GET', `/conversations/${akId}/messages`, k.token)).data.items.find((m: any) => m.id === mediaMsg.id);
  check('the other side gets the picture and its caption', forK && forK.kind === 'MEDIA' && forK.attachments.length === 1 && forK.body === 'my caption', forK);
  r = await call('PATCH', `/messages/${mediaMsg.id}`, a.token, { body: 'better caption' });
  check('a caption can be edited in the window', r.status === 200 && r.data.message.body === 'better caption', r);
  const stolen = await uploadFile(a.token, akId, { kind: 'PHOTO', mimeType: 'image/png' }, PNG);
  r = await call('POST', `/conversations/${akId}/messages`, k.token, { kind: 'MEDIA', attachmentIds: [stolen.id] });
  check('somebody else’s upload cannot be sent', r.status === 400 && r.code === 'ATTACHMENTS_INVALID', r);
  r = await call('POST', `/conversations/${akId}/uploads`, d.token, { kind: 'PHOTO', mimeType: 'image/png', sizeBytes: 100 });
  check('an outsider cannot upload into the conversation', r.status === 404, r);
  r = await call('POST', `/conversations/${akId}/uploads`, a.token, { kind: 'PHOTO', mimeType: 'application/pdf', sizeBytes: 100 });
  check('a document is refused', r.status === 400 && r.code === 'UNSUPPORTED_MEDIA_TYPE', r);
  r = await call('POST', `/conversations/${akId}/uploads`, a.token, { kind: 'PHOTO', mimeType: 'image/png', sizeBytes: 11 * 1024 * 1024 });
  check('an oversize picture is refused', r.status === 400 && r.code === 'FILE_TOO_LARGE', r);
  const never = await call('POST', `/conversations/${akId}/uploads`, a.token, { kind: 'PHOTO', mimeType: 'image/png', sizeBytes: 100 });
  r = await call('POST', `/dm-uploads/${never.data.attachment.id}/confirm`, a.token, {});
  check('confirming an upload that never arrived is refused', r.status === 400 && r.code === 'UPLOAD_MISSING', r);

  // Voice notes.
  const voice = await uploadFile(a.token, akId, { kind: 'AUDIO', mimeType: 'audio/webm;codecs=opus', durationSec: 3.2 }, Buffer.from('not really opus but bytes'), { durationSec: 3.2 });
  check('a voice note is uploaded', voice.asked.status === 201 && voice.confirmed?.status === 200 && voice.confirmed.data.attachment.durationSec === 3.2, voice);
  r = await call('POST', `/conversations/${akId}/messages`, a.token, { kind: 'VOICE', attachmentIds: [voice.id] });
  check('a voice message is sent', r.status === 201 && r.data.message.kind === 'VOICE' && r.data.message.attachments[0].kind === 'AUDIO', r);
  r = await call('PATCH', `/messages/${r.data.message.id}`, a.token, { body: 'edit voice' });
  check('a voice message has no words to edit', r.status === 400 && r.code === 'DM_NOT_EDITABLE', r);
  const blank = await uploadFile(a.token, akId, { kind: 'AUDIO', mimeType: 'audio/mp4', durationSec: 0.1 }, Buffer.from('x'), { durationSec: 0.1 });
  check('an empty recording is refused', blank.confirmed?.status === 400 && blank.confirmed.code === 'AUDIO_EMPTY', blank.confirmed);
  r = await call('POST', `/conversations/${akId}/uploads`, a.token, { kind: 'AUDIO', mimeType: 'audio/mp4', sizeBytes: 100, durationSec: 400 });
  check('a recording over five minutes is refused', r.status === 400 && r.code === 'FILE_TOO_LONG', r);

  // Stickers.
  const mk = await call('POST', '/me/stickers', a.token, { mimeType: 'image/png', sizeBytes: PNG.length, width: 1, height: 1 });
  check('a sticker upload is requested', mk.status === 201, mk);
  await put(mk.data.upload.url, PNG, 'image/png');
  r = await call('POST', `/me/stickers/${mk.data.sticker.id}/confirm`, a.token);
  check('a sticker is confirmed', r.status === 200 && r.data.sticker.mine === true, r);
  const stickerId = mk.data.sticker.id as string;
  let tray = (await call('GET', '/me/stickers', a.token)).data;
  check('my sticker is in my tray', tray.mine.some((s: any) => s.id === stickerId && typeof s.url === 'string'), tray);
  r = await call('POST', '/me/stickers', a.token, { mimeType: 'image/gif', sizeBytes: 100 });
  check('a GIF is not a sticker', r.status === 400 && r.code === 'UNSUPPORTED_MEDIA_TYPE', r);
  r = await call('POST', `/conversations/${akId}/messages`, a.token, { kind: 'STICKER', stickerId });
  check('a sticker is sent', r.status === 201 && r.data.message.kind === 'STICKER' && typeof r.data.message.sticker.url === 'string', r);
  const stickerMsg = r.data.message.id as string;
  r = await call('PUT', `/me/stickers/${stickerId}/favorite`, d.token);
  check('a sticker you were never sent cannot be starred', r.status === 404, r);
  r = await call('PUT', `/me/stickers/${stickerId}/favorite`, k.token);
  check('a sticker you were sent can be starred', r.status === 200 && r.data.favorite === true, r);
  tray = (await call('GET', '/me/stickers', k.token)).data;
  check('…and is in favourites', tray.favorites.some((s: any) => s.id === stickerId && s.favorite === true && s.mine === false), tray);
  r = await call('POST', `/conversations/${akId}/messages`, k.token, { kind: 'STICKER', stickerId });
  check('…and can be sent back', r.status === 201, r);
  tray = (await call('GET', '/me/stickers', a.token)).data;
  check('recent shows what I sent', tray.recent.some((s: any) => s.id === stickerId), tray.recent);
  r = await call('DELETE', `/me/stickers/${stickerId}/favorite`, k.token);
  check('unstarring', r.status === 200 && r.data.favorite === false, r);
  const listed = (await call('GET', '/me/conversations', k.token)).data.items.find((c: any) => c.id === akId);
  check('the inbox previews a sticker as a label', listed.lastMessage.preview === 'Sticker' && listed.lastMessage.body === null, listed.lastMessage);
  r = await call('DELETE', `/me/stickers/${stickerId}`, a.token);
  check('a sticker is deleted from my tray', r.status === 200, r);
  r = await call('POST', `/conversations/${akId}/messages`, a.token, { kind: 'STICKER', stickerId });
  check('…and cannot be sent again by its maker', r.status === 404, r);
  const stillThere = (await call('GET', `/conversations/${akId}/messages`, k.token)).data.items.find((m: any) => m.id === stickerMsg);
  check('…but the message that carried it still shows it', stillThere.sticker && typeof stillThere.sticker.url === 'string', stillThere);

  // Reporting a picture: staff get a way to look at exactly that file.
  r = await call('POST', '/reports', k.token, { targetType: 'DIRECT_MESSAGE', targetId: mediaMsg.id, reason: 'HARASSMENT' });
  check('a picture can be reported', r.status === 201, r);
  const mediaReport = r.data.id as string;
  const mdetail = await call('GET', `/admin/reports/${mediaReport}`, admin.token);
  const msnap = mdetail.data?.report?.snapshot;
  const reportedFileId = msnap?.messages?.find((m: any) => m.reported)?.attachments?.[0]?.id as string;
  check('the snapshot names the file, not an address', Boolean(reportedFileId) && !JSON.stringify(msnap).includes('http'), msnap);
  check('an edited caption keeps the first words', msnap.messages.find((m: any) => m.reported).editedFrom[0] === 'my caption', msnap);
  r = await call('GET', `/admin/reports/${mediaReport}/files/${reportedFileId}`, admin.token);
  check('staff get a short-lived address for it', r.status === 200 && typeof r.data.url === 'string', r);
  r = await call('GET', `/admin/reports/${mediaReport}/files/${up.id.replace(/.$/, '0')}`, admin.token);
  check('…and only for a file the report captured', r.status === 404, r);
  r = await call('GET', `/admin/reports/${mediaReport}/files/${reportedFileId}`, k.token);
  check('a hasher cannot open that route', r.status === 403 || r.status === 404, r);
  r = await call('POST', `/admin/reports/${mediaReport}/actions`, admin.token, { kind: 'REMOVE_CONTENT', note: 'Check removal' });
  const gone = (await call('GET', `/conversations/${akId}/messages`, k.token)).data.items.find((m: any) => m.id === mediaMsg.id);
  check('removing it takes the picture away too', gone.status === 'REMOVED' && gone.attachments.length === 0 && gone.body === null, gone);

  // ── dmPolicy: NOBODY closes new conversations only ──
  r = await call('PATCH', '/me/privacy', e.token, { dmPolicy: 'NOBODY' });
  check('set dmPolicy NOBODY', r.status === 200 && r.data.dmPolicy === 'NOBODY', r);
  r = await call('GET', `/hashers/${e.id}/can-message`, a.token);
  check('can-message says closed', r.data.allowed === false && r.data.reason === 'CLOSED', r);
  r = await call('POST', '/conversations', a.token, { userId: e.id, body: 'hi e' });
  check('a closed door refuses a new conversation', r.status === 403 && r.code === 'DM_CLOSED', r);
  // e can still start one themselves, and the other side can then answer.
  r = await call('POST', '/conversations', e.token, { userId: a.id, body: 'hi a, from e' });
  check('a closed door can still knock', r.status === 201, r);
  const eaId = r.data.conversationId as string;
  await call('POST', `/conversations/${eaId}/accept`, a.token);
  r = await call('POST', `/conversations/${eaId}/messages`, a.token, { body: 'hi e' });
  check('an existing conversation stays open', r.status === 201, r);

  // ── Rate limit on new conversations is by the day, not hit here; list shape ──
  const page = (await call('GET', '/me/conversations?limit=2&page=1', a.token)).data;
  check('list pages', page.items.length <= 2 && page.total >= 3 && page.limit === 2, page);

  await cleanup();
  console.log(`dm-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
