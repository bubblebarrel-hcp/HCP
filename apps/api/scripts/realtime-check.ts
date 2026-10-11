// D72 checks: the socket.io layer for direct messages. Tickets (needed, single
// use, wrong audience), who hears what (recipient, the sender's other devices,
// never a bystander, never a read receipt, never a decline), and that a block
// silences it. Run against a local API on the seeded heavy database:
// `npx tsx scripts/realtime-check.ts`. Cleans up the conversations it makes.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { io, type Socket } from 'socket.io-client';

const API = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const ORIGIN = new URL(API).origin;
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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type R = { status: number; data?: any; code?: string };
async function call(method: string, path: string, token?: string, body?: unknown): Promise<R> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}
async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

// A connected socket that records everything it is sent.
interface Tap {
  socket: Socket;
  events: { event: string; payload: any }[];
  of: (event: string) => any[];
}
async function connect(ticket: string | undefined, extra: Record<string, unknown> = {}): Promise<Tap & { error?: string }> {
  const socket = io(ORIGIN, { auth: ticket === undefined ? {} : { ticket }, reconnection: false, transports: ['websocket'], ...extra });
  const events: Tap['events'] = [];
  socket.onAny((event, payload) => events.push({ event, payload }));
  const tap: Tap & { error?: string } = { socket, events, of: (e) => events.filter((x) => x.event === e).map((x) => x.payload) };
  await new Promise<void>((resolve) => {
    socket.once('ready', () => resolve());
    socket.once('connect_error', (err) => {
      tap.error = err.message;
      resolve();
    });
    setTimeout(resolve, 4000);
  });
  return tap;
}
async function open(token: string) {
  const t = await call('POST', '/me/realtime-ticket', token);
  if (t.status !== 200) throw new Error(`ticket -> ${t.status}`);
  return connect(t.data.ticket);
}

async function main() {
  const members = await prisma.user.findMany({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE' },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
    take: 60,
  });
  const kennelsOf = async (id: string) =>
    new Set((await prisma.membership.findMany({ where: { userId: id, status: 'ACTIVE' }, select: { kennelId: true } })).map((m) => m.kennelId));
  let cast: { a: (typeof members)[0]; b: (typeof members)[0]; d: (typeof members)[0]; c: (typeof members)[0] } | null = null;
  for (const a of members) {
    const ak = await kennelsOf(a.id);
    const strangers: typeof members = [];
    for (const m of members) {
      if (m.id === a.id) continue;
      if (![...(await kennelsOf(m.id))].some((x) => ak.has(x))) strangers.push(m);
    }
    if (strangers.length >= 3) {
      cast = { a, b: strangers[0], d: strangers[1], c: strangers[2] };
      break;
    }
  }
  if (!cast) throw new Error('no suitable cast in the seed');
  const ids = [cast.a.id, cast.b.id, cast.d.id, cast.c.id];

  const cleanup = async () => {
    const convs = await prisma.directConversation.findMany({ where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] }, select: { id: true } });
    const convIds = convs.map((c) => c.id);
    await prisma.notification.deleteMany({ where: { contextType: 'DirectConversation', contextId: { in: convIds } } });
    await prisma.directMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.directConversation.deleteMany({ where: { id: { in: convIds } } });
    await prisma.userBlock.deleteMany({ where: { blockerId: { in: ids }, blockedId: { in: ids } } });
    await prisma.follow.deleteMany({ where: { followerId: { in: ids }, targetType: 'USER', targetId: { in: ids } } });
  };
  await cleanup();

  const a = await login(cast.a.email);
  const b = await login(cast.b.email);
  const d = await login(cast.d.email);
  const c = await login(cast.c.email);

  // ── Tickets ──
  check('a ticket needs a session', (await call('POST', '/me/realtime-ticket')).status === 401);
  let t = await connect(undefined);
  check('no ticket is refused', t.error === 'UNAUTHORIZED', t.error);
  t = await connect('not-a-ticket');
  check('a garbage ticket is refused', t.error === 'UNAUTHORIZED', t.error);
  t = await connect(a.token);
  check('an access token is not a ticket', t.error === 'UNAUTHORIZED', t.error);

  const ticket = (await call('POST', '/me/realtime-ticket', a.token)).data;
  check('ticket says it lasts 60 seconds', ticket.expiresIn === 60, ticket);
  const first = await connect(ticket.ticket);
  check('a ticket opens a connection and says ready', !first.error && first.of('ready').length === 1, first.error);
  const again = await connect(ticket.ticket);
  check('a ticket works once', again.error === 'UNAUTHORIZED', again.error);
  first.socket.close();

  const evil = await connect((await call('POST', '/me/realtime-ticket', a.token)).data.ticket, {
    transports: ['polling'],
    extraHeaders: { origin: 'http://evil.example' },
  });
  check('a foreign Origin is refused', Boolean(evil.error), evil.error);
  evil.socket.close();

  // ── Who hears what ──
  const sa = await open(a.token);
  const sa2 = await open(a.token); // a's second device
  const sb = await open(b.token);
  const sc = await open(c.token); // a bystander
  const sd = await open(d.token);
  check('five hashers connected', [sa, sa2, sb, sc, sd].every((s) => s.socket.connected));

  let r = await call('POST', '/conversations', a.token, { userId: b.id, body: 'live words' });
  const ab = r.data.conversationId as string;
  const msgId = r.data.message.id as string;
  await wait(700);
  const toB = sb.of('dm:message')[0];
  check('the recipient is pushed the message', toB?.message.body === 'live words' && toB.message.mine === false && toB.isRequest === true && toB.conversationId === ab, toB);
  check('…as a request', toB?.status === 'REQUESTED');
  const toA = sa.of('dm:message')[0];
  check('the sender’s device gets its own copy', toA?.message.mine === true && toA.isRequest === false, toA);
  check('the sender’s other device too', sa2.of('dm:message')[0]?.message.id === msgId);
  check('the recipient’s unread count is pushed', sb.of('dm:unread').some((u) => u.requests === 1 && u.unread === 0), sb.of('dm:unread'));
  check('a bystander hears nothing', sc.events.filter((e) => e.event !== 'ready').length === 0, sc.events);

  // Reading is private to the reader.
  sa.events.length = 0;
  await call('POST', `/conversations/${ab}/read`, b.token);
  await wait(500);
  check('the reader’s devices hear the read', sb.of('dm:read').length === 1);
  check('the other person gets no read receipt', sa.events.filter((e) => e.event !== 'dm:unread').length === 0, sa.events);

  // Accepting reaches both.
  await call('POST', `/conversations/${ab}/accept`, b.token);
  await wait(500);
  check('the asker hears the accept', sa.of('dm:conversation').some((x) => x.status === 'ACTIVE' && x.conversationId === ab), sa.events);

  // Unsend reaches both, without the words.
  await call('DELETE', `/messages/${msgId}`, a.token);
  await wait(500);
  const upB = sb.of('dm:message-updated')[0];
  check('an unsend is pushed to the other side without its words', upB?.message.status === 'DELETED' && upB.message.body === null, upB);
  check('and to the sender’s other device', sa2.of('dm:message-updated')[0]?.message.body === null);

  // A silent decline: a -> d.
  r = await call('POST', '/conversations', a.token, { userId: d.id, body: 'hello d' });
  const ad = r.data.conversationId as string;
  await wait(400);
  sa.events.length = 0;
  await call('POST', `/conversations/${ad}/decline`, d.token);
  await wait(500);
  check('the decliner’s device hears it', sd.of('dm:conversation').some((x) => x.status === 'DECLINED'));
  check('the asker is told nothing', sa.events.length === 0, sa.events);

  // Block silences it and tells both to look again.
  sa.events.length = 0;
  sb.events.length = 0;
  await call('PUT', `/hashers/${a.id}/block`, b.token);
  await wait(500);
  check('both are told to refresh on a block', sa.of('dm:refresh').length === 1 && sb.of('dm:refresh').length === 1);
  r = await call('POST', `/conversations/${ab}/messages`, a.token, { body: 'after block' });
  await wait(500);
  check('a blocked send is refused', r.status === 404, r);
  check('and nothing is pushed to the blocker', sb.of('dm:message').length === 0, sb.events);
  await call('DELETE', `/hashers/${a.id}/block`, b.token);

  // Receive-only: whatever a client emits is dropped, not echoed or acted on.
  sc.socket.emit('dm:message', { conversationId: ab, message: { body: 'forged' } });
  sc.socket.emit('join', `user:${b.id}`);
  await call('POST', `/conversations/${ab}/messages`, b.token, { body: 'real' });
  await wait(600);
  check('a client cannot talk through the socket or join another’s room', sc.events.filter((e) => e.event !== 'ready').length === 0, sc.events);

  for (const s of [sa, sa2, sb, sc, sd]) s.socket.close();
  await cleanup();
  console.log(`realtime-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
