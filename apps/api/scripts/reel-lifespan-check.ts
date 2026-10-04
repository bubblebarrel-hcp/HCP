// D58 checks: a reel lives 24 hours, its author can delete it, and a pinned reel
// stays on its author's profile and nowhere else. Run against a local API on the
// seeded heavy database: `npx tsx scripts/reel-lifespan-check.ts`.
//
// It builds its own reels (borrowing the video of one that is already seeded) so
// nothing seeded is changed, and removes them when it finishes. The domain events
// and audit rows its acts wrote stay, as history does.

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Audience, MediaTargetType, PrismaClient, ReelStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const PASSWORD = 'OnOn2026!';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const HOUR = 60 * 60 * 1000;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail ?? '');
  }
}

async function call(method: string, path: string, token?: string, body?: unknown) {
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
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

const ids = (res: { data?: any }) => ((res.data?.items ?? []) as { id: string }[]).map((r) => r.id);

async function main() {
  // An author with an open profile, and the video of a reel they already have.
  const source = await prisma.reel.findFirst({
    where: {
      status: ReelStatus.PUBLISHED,
      mediaId: { not: null },
      author: { profileVisibility: Audience.PUBLIC, status: 'ACTIVE' },
    },
    select: { authorId: true, mediaId: true, author: { select: { email: true } } },
  });
  if (!source?.mediaId) throw new Error('no seeded reel with a video to borrow');
  const other = await prisma.user.findFirst({
    where: { id: { not: source.authorId }, status: 'ACTIVE', email: { endsWith: '@hcp.test' } },
    select: { email: true },
  });
  const author = await login(source.author.email);
  const stranger = await login(other!.email);

  // Four reels, all public, all by the same hasher: one inside its day, one
  // pinned and old, one old and unpinned (expired), one to be deleted.
  const made = new Map<string, string>();
  const make = async (name: string, hoursOld: number, pinned: boolean) => {
    const id = randomUUID();
    const at = new Date(Date.now() - hoursOld * HOUR);
    await prisma.reel.create({
      data: {
        id,
        authorId: author.id,
        caption: `lifespan check: ${name}`,
        status: ReelStatus.PUBLISHED,
        visibility: Audience.PUBLIC,
        mediaId: source.mediaId,
        publishedAt: at,
        createdAt: at,
        pinnedAt: pinned ? at : null,
      },
    });
    await prisma.mediaLink.create({
      data: { mediaId: source.mediaId!, targetType: MediaTargetType.REEL, targetId: id },
    });
    made.set(name, id);
    return id;
  };

  try {
    const live = await make('live', 2, false);
    const pinned = await make('pinned', 72, true);
    const expired = await make('expired', 30, false);
    const doomed = await make('doomed', 1, false);

    // ── The clock ──
    console.log('Lifespan');
    const rail = ids(await call('GET', '/reels?limit=30'));
    check('a reel inside its day is on the rail', rail.includes(live) && rail.includes(doomed));
    check('a reel past its day is on no list', !rail.includes(expired));
    check('a pinned reel is not on the rail', !rail.includes(pinned));

    const profile = ids(await call('GET', `/reels?limit=30&authorId=${author.id}`));
    check('a profile lists reels inside their day', profile.includes(live));
    check('a profile lists its pinned reels', profile.includes(pinned));
    check('a profile does not list an expired reel', !profile.includes(expired));
    check('a profile puts pinned reels first', profile[0] === pinned, profile.slice(0, 3));

    const detailLive = await call('GET', `/reels/${live}`);
    const hoursLeft = (new Date(detailLive.data.reel.expiresAt).getTime() - Date.now()) / HOUR;
    check('a live reel opens and says when it expires', detailLive.status === 200 && hoursLeft > 21 && hoursLeft < 23, hoursLeft);
    check('a live reel is not marked pinned', detailLive.data.reel.pinned === false);
    const detailPinned = await call('GET', `/reels/${pinned}`);
    check('a pinned reel opens, never expires', detailPinned.status === 200 && detailPinned.data.reel.pinned === true && detailPinned.data.reel.expiresAt === null);
    check('an expired reel is 404 to anyone', (await call('GET', `/reels/${expired}`)).status === 404);
    check('and 404 to its own author', (await call('GET', `/reels/${expired}`, author.token)).status === 404);
    check('an expired reel cannot be liked', (await call('POST', `/engagement/reels/${expired}/like`, stranger.token)).status === 404);
    check('a pinned reel can be liked', (await call('POST', `/engagement/reels/${pinned}/like`, stranger.token)).status === 200);
    await call('DELETE', `/engagement/reels/${pinned}/like`, stranger.token);
    check('an expired reel cannot be pinned back to life', (await call('POST', `/reels/${expired}/pin`, author.token)).status === 404);

    // ── Pinning ──
    console.log('Pinning');
    check('only the author can pin', (await call('POST', `/reels/${live}/pin`, stranger.token)).status === 404);
    check('signed out cannot pin', (await call('POST', `/reels/${live}/pin`)).status === 401);
    const pin = await call('POST', `/reels/${live}/pin`, author.token);
    check('the author pins a live reel', pin.status === 200 && pin.data.reel.pinned === true && pin.data.reel.expiresAt === null, pin.code);
    check('pinning again changes nothing', (await call('POST', `/reels/${live}/pin`, author.token)).status === 200);
    check('a pinned reel leaves the rail', !ids(await call('GET', '/reels?limit=30')).includes(live));
    check('and stays on the profile', ids(await call('GET', `/reels?limit=30&authorId=${author.id}`)).includes(live));
    const unpin = await call('DELETE', `/reels/${live}/pin`, author.token);
    check('unpinning hands it back to the clock', unpin.status === 200 && unpin.data.reel.pinned === false && unpin.data.reel.expiresAt !== null);
    check('an unpinned reel inside its day is back on the rail', ids(await call('GET', '/reels?limit=30')).includes(live));
    // An old pinned reel has no day left to go back to.
    await call('DELETE', `/reels/${pinned}/pin`, author.token);
    check('unpinning an old reel ends it', (await call('GET', `/reels/${pinned}`)).status === 404);
    check('and it is on no list', !ids(await call('GET', `/reels?limit=30&authorId=${author.id}`)).includes(pinned));

    // ── Deleting ──
    console.log('Deleting');
    check('somebody else cannot delete it, and cannot tell it exists', (await call('DELETE', `/reels/${doomed}`, stranger.token)).status === 404);
    check('signed out cannot delete it', (await call('DELETE', `/reels/${doomed}`)).status === 401);
    check('it is still there afterwards', (await call('GET', `/reels/${doomed}`)).status === 200);
    const gone = await call('DELETE', `/reels/${doomed}`, author.token);
    check('the author deletes their own reel', gone.status === 200 && gone.data.deleted === true, gone.code);
    check('it is 404 to anyone', (await call('GET', `/reels/${doomed}`)).status === 404);
    check('and to its author', (await call('GET', `/reels/${doomed}`, author.token)).status === 404);
    check('it leaves the rail', !ids(await call('GET', '/reels?limit=30')).includes(doomed));
    check('it leaves the profile', !ids(await call('GET', `/reels?limit=30&authorId=${author.id}`)).includes(doomed));
    check('it cannot be liked', (await call('POST', `/engagement/reels/${doomed}/like`, stranger.token)).status === 404);
    check('it cannot be edited', (await call('PATCH', `/reels/${doomed}`, author.token, { caption: 'back' })).status === 404);
    check('deleting twice is quiet', (await call('DELETE', `/reels/${doomed}`, author.token)).status === 200);
    check('a deleted reel cannot be pinned', (await call('POST', `/reels/${doomed}/pin`, author.token)).status === 404);

    // History stays: the row, an event, and an audit line.
    const row = await prisma.reel.findUnique({ where: { id: doomed } });
    check('the row stays, marked deleted', row?.status === ReelStatus.DELETED && row.deletedAt !== null && row.pinnedAt === null);
    const events = await prisma.domainEvent.findMany({ where: { aggregateId: doomed }, select: { eventType: true, actorId: true } });
    check('a ReelDeleted event names the author', events.some((e) => e.eventType === 'ReelDeleted' && e.actorId === author.id), events);
    const audit = await prisma.auditLog.findFirst({ where: { resourceId: doomed, action: 'reel.delete' } });
    check('and an audit line says why it was allowed', audit?.policyRef === 'self', audit?.policyRef);
    const pinEvents = await prisma.domainEvent.findMany({ where: { aggregateId: live }, select: { eventType: true } });
    check('pinning and unpinning each wrote an event', pinEvents.some((e) => e.eventType === 'ReelPinned') && pinEvents.some((e) => e.eventType === 'ReelUnpinned'), pinEvents);

    // ── Profile only ──
    console.log('Profile only');
    const draft = await call('POST', '/reels', author.token, { caption: 'lifespan check: profile only', pinned: true });
    check('a reel can be created already pinned', draft.status === 201 && draft.data.reel.pinned === true, draft.code);
    if (draft.data?.reel?.id) made.set('draft', draft.data.reel.id);
    const bad = await call('POST', '/reels', author.token, { pinned: 'sometimes' });
    check('pinned must be true or false', bad.status === 400, bad.status);
  } finally {
    for (const id of made.values()) {
      await prisma.mediaLink.deleteMany({ where: { targetType: MediaTargetType.REEL, targetId: id } });
      await prisma.reel.delete({ where: { id } }).catch(() => undefined);
    }
  }
}

main()
  .catch((err) => {
    failed++;
    console.log('  ERROR', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
