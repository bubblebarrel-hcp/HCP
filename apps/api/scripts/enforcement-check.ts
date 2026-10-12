// D74 and D75 checks: automatic warnings and holds from reports, coordinated
// reporting, and appeals. What counts (distinct,
// credible reporters, weighted by reason), the rungs, what a hold does to a login,
// lifting, confirming, a second hold, a hold that ends by itself, and the ways it
// is made hard to turn against somebody (young accounts, a reporter who is always
// wrong, staff, a switch). Run against a local API on the seeded heavy database:
// `npx tsx scripts/enforcement-check.ts`. Cleans up what it makes.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { detect } from '../src/services/coordination.service';
import { evaluate, standing, sweep } from '../src/services/enforcement.service';

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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type R = { status: number; data?: any; code?: string; message?: string };
async function call(method: string, path: string, token?: string, body?: unknown): Promise<R> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string; message?: string } };
  return { status: res.status, data: json.data, code: json.error?.code, message: json.error?.message };
}
async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  return { r, token: r.data?.accessToken as string, id: r.data?.user?.id as string };
}

async function main() {
  const members = await prisma.user.findMany({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE' },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
    take: 14,
  });
  if (members.length < 12) throw new Error('needs the heavy seed');
  const [target, ...reporterRows] = members;
  const T = target.id;
  const T2 = members[12].id;
  const T3 = members[13].id;
  const admin = await login('admin@hcp.test');

  // Reporters sign in once.
  const reporters: { token: string; id: string; email: string }[] = [];
  for (const m of reporterRows.slice(0, 10)) {
    const l = await login(m.email);
    if (!l.token) throw new Error(`login ${m.email}`);
    reporters.push({ token: l.token, id: l.id, email: m.email });
  }

  // Coordination (D75) reads follows and join dates, so the cast starts from a known
  // place: no follows among them (as dm-check does), and their join dates put back.
  const cast = [T, T2, T3, ...reporters.map((r) => r.id)];
  const joined = new Map((await prisma.user.findMany({ where: { id: { in: cast } }, select: { id: true, createdAt: true } })).map((u) => [u.id, u.createdAt]));
  await prisma.follow.deleteMany({ where: { followerId: { in: cast }, targetType: 'USER', targetId: { in: cast } } });
  const original = new Map<string, number | null>();
  const setSetting = async (key: string, value: number) => {
    const r = await call('PATCH', `/admin/settings/${key}`, admin.token, { value });
    return r;
  };

  const reset = async () => {
    await prisma.enforcementAppeal.deleteMany({ where: { userId: T } });
    await prisma.coordinationFlag.deleteMany({ where: { targetUserId: { in: [T, T2, T3] } } });
    await prisma.autoEnforcement.deleteMany({ where: { userId: { in: [T, T2, admin.id] } } });
    await prisma.contentReport.deleteMany({ where: { targetUserId: { in: [T, T2, T3, admin.id] } } });
    await prisma.follow.deleteMany({ where: { followerId: { in: cast }, targetType: 'USER', targetId: { in: cast } } });
    for (const [id, createdAt] of joined) await prisma.user.update({ where: { id }, data: { createdAt } });
    await prisma.contentReport.deleteMany({ where: { reporterId: { in: reporters.map((r) => r.id) }, status: 'DISMISSED' } });
    await prisma.notification.deleteMany({ where: { recipientUserId: { in: [T, admin.id] }, contextType: 'Moderation' } });
    await prisma.user.updateMany({ where: { id: { in: [T, T2, ...reporters.map((r) => r.id)] } }, data: { status: 'ACTIVE' } });
  };
  const state = async () => ({
    user: (await prisma.user.findUniqueOrThrow({ where: { id: T }, select: { status: true } })).status,
    rows: await prisma.autoEnforcement.findMany({ where: { userId: T }, orderBy: { createdAt: 'asc' } }),
  });
  const report = (i: number, reason = 'HARASSMENT', targetId = T) =>
    call('POST', '/reports', reporters[i].token, { targetType: 'USER', targetId, reason, ...(reason === 'OTHER' ? { details: 'check' } : {}) });
  // Notices go through the event queue, which drains in batches: poll for one.
  const noticeTo = async (email: string, match: RegExp, ms = 45_000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const who = await login(email);
      const items = ((await call('GET', '/me/notifications?limit=30', who.token)).data?.items ?? []) as any[];
      const found = items.find((n) => n.contextType === 'Moderation' && match.test(n.title));
      if (found) return found;
      await wait(2000);
    }
    return null;
  };
  // For a hasher who is held and so cannot sign in to read their own notices.
  const noticeInDb = async (userId: string, match: RegExp, ms = 45_000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const rows = await prisma.notification.findMany({ where: { recipientUserId: userId, contextType: 'Moderation' }, select: { title: true, body: true } });
      const found = rows.find((n) => match.test(n.title));
      if (found) return found;
      await wait(2000);
    }
    return null;
  };
  // Reports are evaluated after they are written, in the background.
  const settle = () => wait(500);

  for (const key of ['moderation.auto.enabled', 'moderation.auto.warnScore']) {
    const list = await call('GET', '/admin/settings', admin.token);
    original.set(key, list.data.items.find((s: any) => s.key === key)?.overridden ? list.data.items.find((s: any) => s.key === key).value : null);
  }
  await reset();

  // ── Settings: bounded, and the defaults are what the design says ──
  const list = (await call('GET', '/admin/settings', admin.token)).data.items as any[];
  const val = (k: string) => list.find((s) => s.key === k)?.value;
  check('defaults: on, 30 days, 3 / 5 / 8, 72 hours, 7 days', val('moderation.auto.enabled') === 1 && val('moderation.auto.windowDays') === 30 && val('moderation.auto.warnScore') === 3 && val('moderation.auto.holdScore') === 5 && val('moderation.auto.reviewScore') === 8 && val('moderation.auto.holdHours') === 72 && val('moderation.auto.minReporterAgeDays') === 7, list.filter((s) => s.key.startsWith('moderation')));
  let r = await setSetting('moderation.auto.warnScore', 1);
  check('a warn score of 1 is refused', r.status === 400 && r.code === 'INVALID_SETTING', r);
  r = await setSetting('moderation.auto.enabled', 2);
  check('the switch is 0 or 1', r.status === 400, r);

  // ── Under the line: two reporters do nothing ──
  await report(0);
  await report(1);
  await settle();
  let s = await state();
  check('two reporters do not warn', s.rows.length === 0 && s.user === 'ACTIVE', s);
  r = await report(0);
  check('the same reporter cannot report the same thing twice', r.status === 409, r);

  // ── Three different hashers: a warning, nothing taken away ──
  await report(2);
  await settle();
  s = await state();
  check('three different reporters warn', s.rows.length === 1 && s.rows[0].level === 'WARN' && s.rows[0].reporterCount === 3 && s.rows[0].score === 3, s.rows);
  check('a warning takes nothing away', s.user === 'ACTIVE');
  check('…and can still sign in', (await login(target.email)).r.status === 200);
  const warn = await noticeTo(target.email, /reminder/i);
  check('the hasher is told, without who or what', Boolean(warn) && !JSON.stringify(warn).match(/member\d\d|harass/i), warn);
  await report(3);
  await settle();
  check('a fourth reporter does not warn twice', (await state()).rows.length === 1);

  // ── Weights: spam counts half ──
  await reset();
  for (const i of [0, 1, 2, 3, 4, 5]) await report(i, 'SPAM');
  await settle();
  const six = await standing(T);
  check('six spam reports are worth three', six.score === 3 && six.reporterCount === 6, six);
  s = await state();
  check('…which warns and no more', s.rows.length === 1 && s.rows[0].level === 'WARN' && s.user === 'ACTIVE', s.rows);

  await reset();
  await report(0, 'SELF_HARM');
  await report(1, 'SELF_HARM');
  await report(2, 'SELF_HARM');
  await settle();
  check('self-harm reports count for nothing here', (await standing(T)).score === 0 && (await state()).rows.length === 0);

  // ── The hold ──
  await reset();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  s = await state();
  const hold = s.rows.find((x) => x.level === 'HOLD');
  check('five reporters hold the account', Boolean(hold) && s.user === 'SUSPENDED', s);
  const hours = hold?.endsAt ? (hold.endsAt.getTime() - Date.now()) / 3_600_000 : 0;
  check('…for about 72 hours', hours > 71 && hours <= 72.1, hours);
  check('the hold keeps the reports that counted', Array.isArray(hold?.reportIds) && (hold!.reportIds as string[]).length === 5);
  const refresh = await prisma.refreshToken.count({ where: { userId: T, revokedAt: null } });
  check('every session ends', refresh === 0, refresh);
  const open = await prisma.contentReport.findMany({ where: { targetUserId: T, status: 'OPEN' }, select: { priority: true } });
  check('the reports go to the top of the queue', open.length === 5 && open.every((o) => o.priority === 2), open);
  const locked = await login(target.email);
  check('sign-in says why, and when it ends', locked.r.status === 403 && /on hold/.test(locked.r.message ?? '') && /restored on/.test(locked.r.message ?? ''), locked.r);
  check('and the code tells a client to offer the appeal', locked.r.code === 'ACCOUNT_ON_HOLD', locked.r.code);

  // ── Staff lift it ──
  let enf = await call('GET', '/admin/enforcements', admin.token);
  const listed = (enf.data.items as any[]).find((x) => x.id === hold!.id);
  check('staff see it, with the reasons and who', Boolean(listed) && listed.state === 'ON_HOLD' && listed.reporterCount === 5 && listed.reasons.HARASSMENT === 5 && listed.user.id === T, listed);
  check('a hasher cannot open the list', (await call('GET', '/admin/enforcements', reporters[0].token)).status === 403);
  const detail = await call('GET', `/admin/reports/${open.length ? (await prisma.contentReport.findFirstOrThrow({ where: { targetUserId: T } })).id : ''}`, admin.token);
  check('a report’s page shows the automatic hold', detail.data?.report?.enforcement?.level === 'HOLD', detail.data?.report?.enforcement);
  r = await call('POST', `/admin/enforcements/${hold!.id}/lift`, admin.token, { note: 'False alarm' });
  check('staff lift the hold', r.status === 200 && r.data.enforcement.liftedAt, r);
  s = await state();
  check('the account is active again', s.user === 'ACTIVE');
  check('…and can sign in', (await login(target.email)).r.status === 200);
  check('the hasher heard that the account was on hold', Boolean(await noticeTo(target.email, /on hold/)));
  check('the hasher hears that it is lifted', Boolean(await noticeTo(target.email, /active again/)));

  // ── Old reports cannot suspend them twice; a second hold is a review ──
  check('after a lift the count starts again', (await standing(T)).score === 0, await standing(T));
  await prisma.contentReport.deleteMany({ where: { targetUserId: T } });
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  s = await state();
  check('a second hold in three months is a hold for review', s.rows.filter((x) => x.level === 'REVIEW_HOLD').length === 1 && s.user === 'SUSPENDED', s.rows.map((x) => x.level));
  const review = s.rows.find((x) => x.level === 'REVIEW_HOLD')!;
  check('a hold for review has no end time', review.endsAt === null);
  check('…and the sign-in says it is under review', /until a moderator/.test((await login(target.email)).r.message ?? ''));
  r = await call('POST', `/admin/enforcements/${review.id}/confirm`, admin.token, { note: 'Reviewed: stays' });
  check('staff confirm it', r.status === 200 && r.data.enforcement.confirmedAt, r);
  check('a confirmed hold is theirs: sign-in no longer promises a restore', !/restored|on hold/.test((await login(target.email)).r.message ?? ''));

  // ── A hold ends by itself ──
  await reset();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const timed = (await state()).rows.find((x) => x.level === 'HOLD')!;
  check('(setup) a timed hold exists', Boolean(timed) && (await state()).user === 'SUSPENDED');
  await sweep();
  check('the sweeper leaves a hold that has not ended', (await state()).user === 'SUSPENDED');
  await prisma.autoEnforcement.update({ where: { id: timed.id }, data: { endsAt: new Date(Date.now() - 1000) } });
  await sweep();
  s = await state();
  const ended = s.rows.find((x) => x.level === 'HOLD')!;
  check('the sweeper restores a hold that has ended', s.user === 'ACTIVE' && ended.liftedAt !== null && ended.liftedById === null, s.rows);
  // …but never one staff have confirmed.
  await reset();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const kept = (await state()).rows.find((x) => x.level === 'HOLD')!;
  await call('POST', `/admin/enforcements/${kept.id}/confirm`, admin.token, {});
  await prisma.autoEnforcement.update({ where: { id: kept.id }, data: { endsAt: new Date(Date.now() - 1000) } });
  await sweep();
  check('the sweeper never lifts one staff confirmed', (await state()).user === 'SUSPENDED');
  // A person suspending by hand takes over from a timed hold.
  await reset();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const takeover = (await state()).rows.find((x) => x.level === 'HOLD')!;
  r = await call('PATCH', `/admin/users/${T}/status`, admin.token, { status: 'SUSPENDED', reason: 'Staff decision' });
  const after = await prisma.autoEnforcement.findUniqueOrThrow({ where: { id: takeover.id } });
  check('a staff suspension takes over the automatic hold', r.status === 200 && after.confirmedAt !== null && after.endsAt === null, after);
  r = await call('PATCH', `/admin/users/${T}/status`, admin.token, { status: 'ACTIVE', reason: 'Reinstated' });
  const closed = await prisma.autoEnforcement.findUniqueOrThrow({ where: { id: takeover.id } });
  check('a reinstatement closes it and starts the count again', closed.liftedAt !== null && (await standing(T)).score === 0);

  // ── Hard to turn against somebody ──
  // A reporter whose account is days old does not count.
  await reset();
  await prisma.user.update({ where: { id: reporters[0].id }, data: { createdAt: new Date() } });
  await report(0);
  await report(1);
  await report(2);
  await settle();
  const young = await standing(T);
  check('a new account’s report does not count', young.reporterCount === 2 && (await state()).rows.length === 0, young);
  const real = await prisma.user.findUniqueOrThrow({ where: { email: reporters[0].email }, select: { createdAt: true } });
  await prisma.user.update({ where: { id: reporters[0].id }, data: { createdAt: new Date('2025-01-01') } });
  void real;

  // A reporter who is always wrong stops counting.
  await reset();
  const decoy = reporters[0].id;
  for (let i = 0; i < 3; i++) {
    await prisma.contentReport.create({
      data: { reporterId: decoy, targetType: 'USER', targetId: reporters[9].id, targetUserId: reporters[9].id, reason: 'SPAM', snapshot: {}, status: 'DISMISSED' },
    });
  }
  await report(0);
  await report(1);
  await report(2);
  await settle();
  const wrong = await standing(T);
  check('a reporter staff keep dismissing stops counting', wrong.reporterCount === 2 && (await state()).rows.length === 0, wrong);
  await report(3);
  await settle();
  check('…and the others still can', (await state()).rows.some((x) => x.level === 'WARN'));

  // A dismissed report never counts; an upheld one counts double.
  await reset();
  await report(1);
  await report(2);
  const dismissed = await report(3);
  await prisma.contentReport.update({ where: { id: dismissed.data.id }, data: { status: 'DISMISSED' } });
  check('a dismissed report does not count', (await standing(T)).reporterCount === 2);
  const upheld = (await prisma.contentReport.findMany({ where: { targetUserId: T, status: 'OPEN' }, take: 1 }))[0];
  await prisma.contentReport.update({ where: { id: upheld.id }, data: { status: 'ACTIONED' } });
  check('a report staff upheld counts double', (await standing(T)).score === 3, await standing(T));

  // Staff are never acted on.
  await reset();
  for (const i of [0, 1, 2, 3, 4, 5]) await report(i, 'HARASSMENT', admin.id);
  await settle();
  await evaluate(admin.id);
  check('platform staff are never held', (await prisma.autoEnforcement.count({ where: { userId: admin.id } })) === 0 && (await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { status: true } })).status === 'ACTIVE');

  // The switch.
  await reset();
  await setSetting('moderation.auto.enabled', 0);
  for (const i of [0, 1, 2, 3, 4, 5]) await report(i);
  await settle();
  check('with the switch off nothing happens, however many report', (await state()).rows.length === 0 && (await state()).user === 'ACTIVE');
  await setSetting('moderation.auto.enabled', 1);
  await evaluate(T);
  check('turned back on, the next look acts', (await state()).rows.length > 0);

  // ── Reporters who look like one (D75) ──
  const bursts = async () => {
    // The first five joined within the hour of each other, and report within seconds.
    const at = new Date('2026-03-01T10:00:00Z');
    for (const [i, r] of reporters.slice(0, 5).entries()) await prisma.user.update({ where: { id: r.id }, data: { createdAt: new Date(at.getTime() + i * 600_000) } });
  };

  await reset();
  check('independent strangers are not grouped', (await Promise.all([0, 1, 2, 3, 4].map((i) => report(i)))).every((x) => x.status === 201) && (await standing(T)).clusters.length === 0, await standing(T));
  await settle();
  await reset();

  await bursts();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const burst = await standing(T);
  check('five accounts made together, reporting together, count as one', burst.rawReporterCount === 5 && burst.reporterCount === 1 && burst.score === 1 && burst.clusters.length === 1, burst);
  check('…and the platform says why they were linked', burst.clusters[0]?.signals.includes('JOINED') && burst.clusters[0]?.signals.includes('TOGETHER'), burst.clusters);
  s = await state();
  check('so nothing happens to the hasher', s.rows.length === 0 && s.user === 'ACTIVE', s.rows);
  let flags = await call('GET', '/admin/coordination', admin.token);
  const flag = (flags.data.items as any[]).find((x) => x.target.id === T);
  check('staff are asked which it was', Boolean(flag) && flag.outcome === 'PENDING' && flag.rawScore === 5 && flag.effectiveScore === 1 && flag.groups[0].reporters.length === 5, flag);
  check('the flag says in words why they were linked', flag.groups[0].signals.some((x: string) => /joined within two days/.test(x)), flag.groups[0].signals);
  check('a hasher cannot open the list', (await call('GET', '/admin/coordination', reporters[0].token)).status === 403);
  check('staff were told', Boolean(await noticeTo('admin@hcp.test', /may be coordinated/)));
  await report(5);
  await settle();
  check('a later look updates the flag, it does not stack another', (await prisma.coordinationFlag.count({ where: { targetUserId: T } })) === 1);
  r = await call('POST', `/admin/coordination/${flag.id}/review`, admin.token, { outcome: 'CLEARED', note: 'Genuinely separate' });
  check('staff say they were independent', r.status === 200 && r.data.flag.outcome === 'CLEARED', r);
  s = await state();
  check('so they count separately and the hold follows', s.rows.some((x) => x.level === 'HOLD') && s.user === 'SUSPENDED', s.rows.map((x) => x.level));
  r = await call('POST', `/admin/coordination/${flag.id}/review`, admin.token, { outcome: 'CONFIRMED' });
  check('it can only be decided once', r.status === 409, r);

  // Confirmed: they stop counting, for anybody.
  await reset();
  await bursts();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const second = (await call('GET', '/admin/coordination', admin.token)).data.items.find((x: any) => x.target.id === T);
  r = await call('POST', `/admin/coordination/${second.id}/review`, admin.token, { outcome: 'CONFIRMED', note: 'A campaign' });
  check('staff say it was a campaign', r.status === 200 && r.data.flag.outcome === 'CONFIRMED', r);
  check('those reporters stop counting against this hasher', (await standing(T)).rawReporterCount === 0 && (await state()).rows.length === 0);
  for (const i of [0, 1, 2, 3, 4]) await call('POST', '/reports', reporters[i].token, { targetType: 'USER', targetId: T2, reason: 'HARASSMENT' });
  await settle();
  const other = await standing(T2);
  check('…and against everybody else, for six months', other.rawReporterCount === 0 && (await prisma.autoEnforcement.count({ where: { userId: T2 } })) === 0, other);

  // One signal alone is ordinary; two are not.
  await reset();
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const quick = await standing(T);
  check('reporting within minutes of each other is not enough on its own', quick.clusters.length === 0 && quick.reporterCount === 5, quick);
  await reset();
  await prisma.follow.createMany({
    data: [
      { followerId: reporters[0].id, targetType: 'USER', targetId: reporters[1].id },
      { followerId: reporters[1].id, targetType: 'USER', targetId: reporters[0].id },
    ],
  });
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const friends = await standing(T);
  check('two who follow each other and report together count as one', friends.rawReporterCount === 5 && friends.reporterCount === 4 && friends.clusters.length === 1 && friends.clusters[0].signals.includes('MUTUAL'), friends);
  s = await state();
  check('…which is a warning, where five would have been a hold', s.rows.length === 1 && s.rows[0].level === 'WARN' && s.user === 'ACTIVE', s.rows.map((x) => x.level));
  check('…and staff are asked', (await prisma.coordinationFlag.count({ where: { targetUserId: T, outcome: 'PENDING' } })) === 1);

  // A ring: the same two have reported the same other people before.
  await reset();
  for (const who of [0, 1]) {
    for (const t of [T2, T3]) {
      await prisma.contentReport.create({ data: { reporterId: reporters[who].id, targetType: 'USER', targetId: t, targetUserId: t, reason: 'SPAM', snapshot: {}, status: 'DISMISSED' } });
    }
  }
  await prisma.contentReport.updateMany({ where: { reporterId: { in: [reporters[0].id, reporters[1].id] }, status: 'DISMISSED' }, data: { status: 'OPEN' } });
  for (const i of [0, 1, 2, 3, 4]) await report(i);
  await settle();
  const ring = await standing(T);
  check('two who keep reporting the same people count as one', ring.clusters.length === 1 && ring.clusters[0].signals.includes('RING') && ring.reporterCount === 4, ring);
  await prisma.contentReport.deleteMany({ where: { targetUserId: { in: [T2, T3] } } });

  // An account with no life on the platform counts for half.
  const ghost = randomUUID();
  const seen = await detect(T, [{ id: ghost, createdAt: new Date('2025-01-01'), reportedAt: new Date() }]);
  check('an account that has never done anything but report counts for half', seen.thin.includes(ghost) && seen.clusters.length === 0, seen);

  // ── Appeals (D75) ──
  const makeHold = async () => {
    await reset();
    for (const i of [0, 1, 2, 3, 4]) await report(i);
    await settle();
    return (await state()).rows.find((x) => x.level === 'HOLD')!;
  };
  const creds = { email: target.email, password: PASSWORD };
  let held = await makeHold();
  check('(setup) a hold exists', Boolean(held) && (await state()).user === 'SUSPENDED');
  r = await call('POST', '/auth/hold', undefined, { email: target.email, password: 'wrong' });
  check('a wrong password reveals nothing', r.status === 401 && r.code === 'INVALID_CREDENTIALS', r);
  r = await call('POST', '/auth/hold', undefined, creds);
  check('a held hasher can see their hold', r.status === 200 && r.data.held === true && r.data.canAppeal === true && r.data.level === 'HOLD' && r.data.appeal === null, r);
  r = await call('POST', '/auth/appeal', undefined, { ...creds, message: 'short' });
  check('a one-word appeal is turned back', r.status === 400 && r.code === 'APPEAL_TOO_SHORT', r);
  r = await call('POST', '/auth/appeal', undefined, { ...creds, message: 'I was in a dispute with a group of people and they all reported me at once.' });
  check('the held hasher appeals', r.status === 201 && r.data.status === 'OPEN', r);
  const appealId = r.data.id as string;
  r = await call('POST', '/auth/appeal', undefined, { ...creds, message: 'Please look again, this is a second go at it.' });
  check('one appeal per hold', r.status === 409 && r.code === 'ALREADY_APPEALED', r);
  r = await call('POST', '/auth/appeal', undefined, { email: target.email, password: 'wrong', message: 'I would like to appeal this please.' });
  check('an appeal needs the password', r.status === 401, r);
  const signin = await login(target.email);
  check('sign-in says the appeal is with a moderator', signin.r.code === 'ACCOUNT_ON_HOLD' && /appeal has reached a moderator/.test(signin.r.message ?? ''), signin.r);
  r = await call('POST', '/auth/hold', undefined, creds);
  check('…and the state says so', r.data.canAppeal === false && r.data.appeal.status === 'OPEN', r.data);
  const queued = await call('GET', '/admin/enforcements?filter=appeals', admin.token);
  const mine = (queued.data.items as any[]).find((x) => x.appeal?.id === appealId);
  check('staff see the appeal and what it says', Boolean(mine) && /dispute/.test(mine.appeal.message) && mine.appeal.status === 'OPEN', queued.data.items);
  check('staff were told there is one', Boolean(await noticeTo('admin@hcp.test', /has appealed/)));
  check('the counts say one is waiting', (await call('GET', '/admin/enforcements/counts', admin.token)).data.appeals >= 1);
  check('a hasher cannot decide', (await call('POST', `/admin/appeals/${appealId}/decide`, reporters[0].token, { outcome: 'GRANT' })).status === 403);

  r = await call('POST', `/admin/appeals/${appealId}/decide`, admin.token, { outcome: 'DENY' });
  check('turning one down needs words the hasher will read', r.status === 400 && r.code === 'REASON_REQUIRED', r);
  r = await call('POST', `/admin/appeals/${appealId}/decide`, admin.token, { outcome: 'DENY', note: 'The reports were from several unconnected members.' });
  check('staff turn it down', r.status === 200 && r.data.appeal.status === 'DENIED', r);
  const denied = await prisma.autoEnforcement.findUniqueOrThrow({ where: { id: held.id } });
  check('the hold is now a staff decision', denied.confirmedAt !== null && denied.endsAt === null && (await state()).user === 'SUSPENDED');
  const afterNo = await login(target.email);
  check('sign-in carries what staff said', /reviewed your appeal/.test(afterNo.r.message ?? '') && /several unconnected members/.test(afterNo.r.message ?? ''), afterNo.r);
  const told = await noticeInDb(T, /reviewed your appeal/);
  check('the hasher is told, in the words staff wrote', Boolean(told) && /several unconnected members/.test(told!.body), told);
  r = await call('POST', '/auth/hold', undefined, creds);
  check('the state shows the answer and no second appeal', r.data.appeal.status === 'DENIED' && /unconnected/.test(r.data.appeal.decisionNote) && r.data.canAppeal === false, r.data);
  await prisma.autoEnforcement.update({ where: { id: held.id }, data: { endsAt: new Date(Date.now() - 1000) } });
  await sweep();
  check('the sweeper never lifts a hold whose appeal was turned down', (await state()).user === 'SUSPENDED');

  // Granted.
  held = await makeHold();
  await call('POST', '/auth/appeal', undefined, { ...creds, message: 'I think there has been a mistake about me, and here is why.' });
  const granted = await prisma.enforcementAppeal.findFirstOrThrow({ where: { enforcementId: held.id } });
  r = await call('POST', `/admin/appeals/${granted.id}/decide`, admin.token, { outcome: 'GRANT', note: 'Reasonable.' });
  check('staff grant it', r.status === 200 && r.data.appeal.status === 'GRANTED', r);
  check('the account is restored and can sign in', (await state()).user === 'ACTIVE' && (await login(target.email)).r.status === 200);
  check('the hasher hears their appeal was successful', Boolean(await noticeTo(target.email, /active again/)));
  r = await call('POST', '/auth/appeal', undefined, { ...creds, message: 'Appealing something that is no longer there at all.' });
  check('nothing to appeal once it is lifted', r.status === 400 && r.code === 'NO_HOLD', r);

  // Lifted by the ordinary Lift while an appeal is open.
  held = await makeHold();
  await call('POST', '/auth/appeal', undefined, { ...creds, message: 'Please have a look at this, it was a misunderstanding.' });
  await call('POST', `/admin/enforcements/${held.id}/lift`, admin.token, { note: 'Lifted from the list' });
  const viaLift = await prisma.enforcementAppeal.findFirstOrThrow({ where: { enforcementId: held.id } });
  check('lifting a held account answers its appeal', viaLift.status === 'GRANTED' && viaLift.decidedById !== null, viaLift);

  // A hold that ends by itself makes the appeal moot.
  held = await makeHold();
  await call('POST', '/auth/appeal', undefined, { ...creds, message: 'I would like someone to look at this before it ends.' });
  await prisma.autoEnforcement.update({ where: { id: held.id }, data: { endsAt: new Date(Date.now() - 1000) } });
  await sweep();
  const moot = await prisma.enforcementAppeal.findFirstOrThrow({ where: { enforcementId: held.id } });
  check('a hold that ends first makes the appeal moot', moot.status === 'MOOT' && (await state()).user === 'ACTIVE', moot);

  // ── Put everything back ──
  // Reports are evaluated in the background: let the last one finish before the
  // last clean-up, or it can write a row just after.
  await wait(2000);
  await reset();
  await prisma.follow.deleteMany({ where: { followerId: { in: cast }, targetType: 'USER', targetId: { in: cast } } });
  for (const key of original.keys()) {
    if (original.get(key) === null) await prisma.platformSetting.deleteMany({ where: { key } });
  }
  await prisma.platformSetting.deleteMany({ where: { key: 'moderation.auto.enabled' } });
  console.log(`enforcement-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
