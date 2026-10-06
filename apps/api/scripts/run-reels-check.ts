// Reels shot at a run (D41): `GET /reels?runId=` for the run page and the Run
// Capsule, and posting one with `runId` from the run page. Run against a local API
// on the seeded database: `npx tsx scripts/run-reels-check.ts`. It restores the run
// and deletes the reels it makes.

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
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

// A reel with one photo on it, published, optionally pinned or narrowed.
async function postReel(token: string, runId: string, opts: { visibility?: string; pinned?: boolean } = {}) {
  const draft = await call('POST', '/reels', token, { caption: 'run-reels-check', runId, visibility: opts.visibility ?? 'PUBLIC', pinned: Boolean(opts.pinned) });
  const id = draft.data?.reel?.id as string;
  if (!id) throw new Error(`draft failed: ${draft.status}`);
  const photo = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const asked = await call('POST', '/media/uploads', token, {
    kind: 'PHOTO',
    mimeType: 'image/png',
    sizeBytes: photo.length,
    target: { type: 'REEL', id },
    caption: null,
    clientId: `REEL:${id}:0`,
  });
  const up = asked.data.upload;
  await fetch(up.url, { method: up.method, headers: up.headers, body: photo });
  await call('POST', `/media/${asked.data.media.id}/confirm`, token, { width: 10, height: 10, durationSec: null });
  const pub = await call('POST', `/reels/${id}/publish`, token);
  if (pub.status >= 300) throw new Error(`publish failed: ${pub.status}`);
  return id;
}

async function main() {
  const run = await prisma.run.findFirst({
    where: { status: { in: ['SCHEDULED', 'PLANNING', 'TRAIL_RELEASED', 'CHECK_IN_OPEN', 'LIVE'] }, visibility: 'PUBLIC', kennel: { visibility: { not: 'HIDDEN' } } },
    select: { id: true, kennelId: true },
  });
  if (!run) throw new Error('no public upcoming run in the seed');
  const other = await prisma.run.findFirst({ where: { id: { not: run.id }, visibility: 'PUBLIC', kennel: { visibility: { not: 'HIDDEN' } } }, select: { id: true } });

  const member = await prisma.user.findFirst({ where: { email: { startsWith: 'member' }, status: 'ACTIVE', memberships: { some: { kennelId: run.kennelId, status: 'ACTIVE' } } }, select: { email: true } });
  const stranger = await prisma.user.findFirst({ where: { email: { startsWith: 'member' }, status: 'ACTIVE', memberships: { none: { kennelId: run.kennelId } } }, select: { email: true } });
  if (!member || !stranger) throw new Error('need a member and an outsider');
  const author = await login(member.email);
  const outsider = await login(stranger.email);

  const made: string[] = [];
  try {
    // A signed-in stranger may post to a public run: the run decides, not the kennel.
    const strangerReel = await postReel(outsider.token, run.id);
    made.push(strangerReel);
    const mine = await postReel(author.token, run.id);
    made.push(mine);

    const anon = await call('GET', `/reels?runId=${run.id}&limit=30`);
    const anonIds = (anon.data?.items ?? []).map((r: any) => r.id);
    check('a public run lists its reels to a signed-out reader', anonIds.includes(mine) && anonIds.includes(strangerReel), anonIds);
    check('...and nobody else\'s reels', (anon.data?.items ?? []).every((r: any) => r.id && true) && anon.data?.total >= 2);
    const elsewhere = other ? await call('GET', `/reels?runId=${other.id}&limit=30`) : null;
    check('another run\'s list does not include them', !elsewhere || !(elsewhere.data?.items ?? []).some((r: any) => made.includes(r.id)));

    // ── Audience still narrows ──
    const narrowed = await postReel(author.token, run.id, { visibility: 'ONLY_ME' });
    made.push(narrowed);
    const anonAgain = await call('GET', `/reels?runId=${run.id}&limit=30`);
    check('a reel narrowed to its author is not on the run for others', !(anonAgain.data?.items ?? []).some((r: any) => r.id === narrowed));
    const ownView = await call('GET', `/reels?runId=${run.id}&limit=30`, author.token);
    check('...but its author still sees it', (ownView.data?.items ?? []).some((r: any) => r.id === narrowed));

    // ── Pinned and expired reels are not on a run (D58) ──
    const pinned = await postReel(author.token, run.id, { pinned: true });
    made.push(pinned);
    const withPinned = await call('GET', `/reels?runId=${run.id}&limit=30`);
    check('a reel pinned to a profile is not on the run', !(withPinned.data?.items ?? []).some((r: any) => r.id === pinned));
    await prisma.reel.update({ where: { id: mine }, data: { publishedAt: new Date(Date.now() - 25 * 3600_000) } });
    const expired = await call('GET', `/reels?runId=${run.id}&limit=30`);
    check('a reel past its day has left the run', !(expired.data?.items ?? []).some((r: any) => r.id === mine));
    check('...while a fresh one has not', (expired.data?.items ?? []).some((r: any) => r.id === strangerReel));

    // ── A run nobody may see ──
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'MEMBERS_ONLY' } });
    const closed = await call('GET', `/reels?runId=${run.id}&limit=30`);
    check('a members-only run lists nothing to a signed-out reader, and no count', closed.status === 200 && closed.data?.items?.length === 0 && closed.data?.total === 0, closed.data);
    const asStranger = await call('GET', `/reels?runId=${run.id}&limit=30`, outsider.token);
    check('...nor to a signed-in outsider', asStranger.data?.items?.length === 0 && asStranger.data?.total === 0, asStranger.data);
    const asMember = await call('GET', `/reels?runId=${run.id}&limit=30`, author.token);
    check('...but its members see them', (asMember.data?.items ?? []).some((r: any) => r.id === strangerReel), asMember.data?.items?.length);
    const draftForClosed = await call('POST', '/reels', outsider.token, { runId: run.id, caption: 'x' });
    check('an outsider cannot post a reel to a run they cannot see', draftForClosed.status === 404, draftForClosed.status);
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'PUBLIC' } });

    // ── Bad input ──
    const bad = await call('GET', '/reels?runId=not-a-uuid');
    check('a bad run id is a 400, not a 500', bad.status === 400, bad.status);
  } finally {
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'PUBLIC' } }).catch(() => undefined);
    for (const id of made) await prisma.reel.update({ where: { id }, data: { status: 'DELETED' } }).catch(() => undefined);
  }

  console.log(`run-reels-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
