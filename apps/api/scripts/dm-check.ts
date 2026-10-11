// D71 checks: direct messages. Requests versus inbox, the one-message limit, a
// silent decline, block, mute, dmPolicy, unsend, encryption at rest, the words
// staying out of notifications, and a report reaching staff with context.
// Run against a local API on the seeded heavy database: `npx tsx scripts/dm-check.ts`.
//
// Direct messages are append-only, so the conversations this makes are removed
// by hand at the start and the end (it is a local test database). Nothing else
// is left behind.

import 'dotenv/config';
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
  const ids = [cast.a.id, cast.b.id, cast.d.id, cast.e.id, cast.k.id];

  const cleanup = async () => {
    const convs = await prisma.directConversation.findMany({
      where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] },
      select: { id: true },
    });
    const convIds = convs.map((c) => c.id);
    const msgs = await prisma.directMessage.findMany({ where: { conversationId: { in: convIds } }, select: { id: true } });
    const reports = await prisma.contentReport.findMany({
      where: { targetType: 'DIRECT_MESSAGE', targetId: { in: msgs.map((m) => m.id) } },
      select: { id: true },
    });
    await prisma.contentReport.deleteMany({ where: { id: { in: reports.map((r) => r.id) } } });
    await prisma.notification.deleteMany({ where: { contextType: 'DirectConversation', contextId: { in: convIds } } });
    await prisma.directMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { dmPolicy: 'EVERYONE' } });
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

  // ── Unsend ──
  r = await call('DELETE', `/messages/${bReplyId}`, a.token);
  check('cannot unsend somebody else’s message', r.status === 404, r);
  r = await call('DELETE', `/messages/${bReplyId}`, b.token);
  check('sender unsends', r.status === 200 && r.data.status === 'DELETED', r);
  const seen = (await call('GET', `/conversations/${abId}/messages`, a.token)).data.items as any[];
  check('unsent message keeps its place, loses its words', seen[0].id === bReplyId && seen[0].body === null && seen[0].status === 'DELETED', seen[0]);
  check('the row stays', (await prisma.directMessage.count({ where: { id: bReplyId } })) === 1);

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
  check('staff see the message in context', detail.status === 200 && snap?.kind === 'DIRECT_MESSAGE' && snap.messages.some((m: any) => m.reported && m.body === 'now we can talk') && snap.messages.length === 2, detail);
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
  const before = (await call('GET', '/me/notifications?limit=50', k.token)).data.items.filter((n: any) => n.contextId === akId).length;
  await call('POST', `/conversations/${akId}/messages`, a.token, { body: 'are you there' });
  await wait(7000);
  const afterN = (await call('GET', '/me/notifications?limit=50', k.token)).data.items.filter((n: any) => n.contextId === akId).length;
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
