/* Run tracking (D79): the maths, then the API.
   Maths: distance, moving time, pace, splits, pauses, GPS jumps, climb, trimming.
   API: recording once, owner vs stranger vs signed-out, the audience scale,
   a secret trail hiding a hare's track, 404 for what you may not see, delete.
   Run: npx ts-node --transpile-only scripts/activity-check.ts   (API on 5010) */
import prisma from '../src/config/prisma';
import { computeStats, haversineM, trimTrackEnds, type TrackPoint } from '../src/utils/activity-math';

const B = process.env.API ?? 'http://localhost:5010/api/v1';
let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

// A straight run north from (lat0, 3.0), one fix a second at `speed` m/s.
const M_PER_DEG_LAT = 111_194.9;
function line(opts: { metres: number; speed?: number; t0?: number; lat0?: number; ele?: (i: number) => number | null }) {
  const { metres, speed = 3, t0 = Date.now() - 3600_000, lat0 = 9.05, ele = () => null } = opts;
  const pts: TrackPoint[] = [];
  const n = Math.round(metres / speed);
  for (let i = 0; i <= n; i++) pts.push({ lat: lat0 + (i * speed) / M_PER_DEG_LAT, lng: 7.49, ele: ele(i), t: t0 + i * 1000, acc: 5 });
  return pts;
}

function maths() {
  console.log('— maths —');
  const s = computeStats(line({ metres: 2500 }));
  check('2.5 km at 3 m/s is about 2500 m', near(s.distanceM, 2500, 15), s.distanceM);
  check('moving time is about 833 s', near(s.movingTimeS, 833, 3), s.movingTimeS);
  check('pace is about 333 s/km', s.avgPaceSPerKm !== null && near(s.avgPaceSPerKm, 333, 3), s.avgPaceSPerKm);
  check('two full splits and a partial', s.splits.length === 3 && s.splits[0].distanceM === 1000 && s.splits[2].distanceM > 450 && s.splits[2].distanceM < 520, s.splits);
  check('each full split is about 333 s', s.splits.slice(0, 2).every((x) => near(x.timeS, 333, 3)), s.splits);

  // A minute standing still, with the fix wandering a couple of metres.
  const a = line({ metres: 600 });
  const last = a[a.length - 1];
  const stand: TrackPoint[] = [];
  for (let i = 1; i <= 60; i++) stand.push({ lat: last.lat + (i % 2) * 0.00001, lng: last.lng, ele: null, t: last.t + i * 1000, acc: 5 });
  const b = line({ metres: 600, t0: last.t + 61_000, lat0: last.lat + 0.00001 });
  const paused = computeStats([...a, ...stand, ...b]);
  const plain = computeStats([...a, ...b.map((p) => ({ ...p, t: p.t - 61_000 }))]);
  check('a pause adds no moving time', near(paused.movingTimeS, plain.movingTimeS, 3), [paused.movingTimeS, plain.movingTimeS]);
  check('a pause adds no distance', near(paused.distanceM, plain.distanceM, 5), [paused.distanceM, plain.distanceM]);
  check('but elapsed time counts it', paused.elapsedTimeS - plain.elapsedTimeS >= 55, [paused.elapsedTimeS, plain.elapsedTimeS]);

  // A fix 5 km away for one second, and a fix reported at 200 m accuracy.
  const jumpy = line({ metres: 1000 });
  jumpy.splice(100, 0, { lat: jumpy[100].lat + 0.05, lng: 7.49, ele: null, t: jumpy[99].t + 500, acc: 5 });
  jumpy.splice(200, 0, { lat: jumpy[200].lat + 0.003, lng: 7.49, ele: null, t: jumpy[199].t + 500, acc: 200 });
  const clean = computeStats(jumpy);
  check('a GPS jump and a 200 m fix are dropped', near(clean.distanceM, 1000, 12), clean.distanceM);

  // 10 m of real climb with ±1 m of noise on top.
  const hill = computeStats(line({ metres: 1200, ele: (i) => i * (10 / 400) + (i % 2 ? 1 : -1) }));
  check('climb ignores noise (about 10 m up, none down)', near(hill.elevationGainM, 10, 3) && hill.elevationLossM <= 1, [hill.elevationGainM, hill.elevationLossM]);

  check('a single fix is an empty result', computeStats(line({ metres: 0 })).track.length === 0);

  // Stop at 600 m, walk 2 km to somewhere else, resume: the walk is not running.
  const seg0 = line({ metres: 600 }).map((p) => ({ ...p, seg: 0 }));
  const lastSeg = seg0[seg0.length - 1];
  const seg1 = line({ metres: 600, lat0: lastSeg.lat + 2000 / M_PER_DEG_LAT, t0: lastSeg.t + 1_800_000 }).map((p) => ({ ...p, seg: 1 }));
  const resumed = computeStats([...seg0, ...seg1]);
  check('nothing is counted across a pause (about 1200 m)', near(resumed.distanceM, 1200, 15), resumed.distanceM);
  check('nor any moving time (about 400 s)', near(resumed.movingTimeS, 400, 4), resumed.movingTimeS);
  const unmarked = computeStats([...seg0, ...seg1].map(({ seg: _s, ...p }) => p));
  check('without the marker the walk would have counted', unmarked.distanceM > 2500, unmarked.distanceM);

  const t = trimTrackEnds(s.track);
  const startGap = haversineM(s.track[0][0], s.track[0][1], t[0][0], t[0][1]);
  const endGap = haversineM(s.track[s.track.length - 1][0], s.track[s.track.length - 1][1], t[t.length - 1][0], t[t.length - 1][1]);
  check('trimming cuts 200 m at the start', startGap >= 200 && startGap < 206, startGap);
  check('trimming cuts 200 m at the end', endGap >= 200 && endGap < 206, endGap);
  check('a track under 400 m is trimmed away', trimTrackEnds(computeStats(line({ metres: 350 })).track).length === 0);
}

async function api() {
  console.log('— api —');
  const login = async (email: string) => (await call('POST', '/auth/login', undefined, { email, password: 'OnOn2026!' })).data;
  const me = await login('hasher@hcp.test');
  const other = await login('member02@hcp.test');
  const token = me.accessToken as string;
  const stranger = other.accessToken as string;
  const meId = me.user.id as string;

  const tag = `act-check-${Date.now()}`;
  const body = (extra: Record<string, unknown> = {}) => ({ clientId: `${tag}-${Math.random().toString(36).slice(2, 8)}`, kind: 'SOLO', points: line({ metres: 1500 }), ...extra });

  // Signed-out and malformed.
  check('signed out cannot record', (await call('POST', '/me/activities', undefined, body())).status === 401);
  check('a one-point recording is refused', (await call('POST', '/me/activities', token, body({ points: line({ metres: 1500 }).slice(0, 1) }))).status === 400);
  const tooShort = await call('POST', '/me/activities', token, body({ points: line({ metres: 20 }) }));
  check('a 20 m recording is too short', tooShort.status === 400 && tooShort.code === 'ACTIVITY_TOO_SHORT', tooShort);
  const future = await call('POST', '/me/activities', token, body({ points: line({ metres: 1500, t0: Date.now() + 3600_000 }) }));
  check('a recording from the future is refused', future.status === 400 && future.code === 'ACTIVITY_CLOCK', future);
  const soloWithRun = await call('POST', '/me/activities', token, body({ runId: '5df9012f-7c83-46a3-841e-5bf880fa662b' }));
  check('a solo run tied to a run is refused', soloWithRun.status === 400, soloWithRun);
  const noPart = await call('POST', '/me/activities', token, body({ kind: 'HASH_RUN', runId: '5df9012f-7c83-46a3-841e-5bf880fa662b' }));
  check('a hash run you are not on is 404', noPart.status === 404, noPart);

  // Record, once.
  const payload = body({ title: 'Morning jog' });
  const first = await call('POST', '/me/activities', token, payload);
  const act = first.data?.activity;
  check('a solo recording is created (201)', first.status === 201 && Boolean(act?.id), first);
  check('the server worked out the numbers', near(act.distanceM, 1500, 10) && near(act.movingTimeS, 500, 3) && act.splits.length === 2, act);
  check('the default audience is FOLLOWERS', act.audience === 'FOLLOWERS');
  const again = await call('POST', '/me/activities', token, payload);
  check('the same upload twice lands once (200)', again.status === 200 && again.data.activity.id === act.id, again);
  check('the owner reads the whole track', (await call('GET', `/activities/${act.id}`, token)).data.activity.track.length === act.track.length);

  // Audience.
  check('a stranger gets 404 on FOLLOWERS', (await call('GET', `/activities/${act.id}`, stranger)).status === 404);
  check('signed out gets 404 on FOLLOWERS', (await call('GET', `/activities/${act.id}`)).status === 404);
  check('a stranger cannot change it (404)', (await call('PATCH', `/activities/${act.id}`, stranger, { audience: 'PUBLIC' })).status === 404);
  check('a stranger cannot delete it (404)', (await call('DELETE', `/activities/${act.id}`, stranger)).status === 404);

  const pub = await call('PATCH', `/activities/${act.id}`, token, { audience: 'PUBLIC' });
  check('the owner can open it to everyone', pub.status === 200 && pub.data.activity.audience === 'PUBLIC', pub);
  const seen = await call('GET', `/activities/${act.id}`, stranger);
  const seenAnon = await call('GET', `/activities/${act.id}`);
  check('a stranger now reads it', seen.status === 200 && seenAnon.status === 200);
  const fullStart = act.track[0];
  const seenStart = seen.data.activity.track[0];
  check('but the start is 200 m in, not at the door', haversineM(fullStart[0], fullStart[1], seenStart[0], seenStart[1]) >= 200, seenStart);
  check('the owner flag is false for a stranger', seen.data.activity.isOwner === false);
  const listed = await call('GET', `/hashers/${meId}/activities`, stranger);
  check('it is on the hasher’s list for a stranger', listed.data.items.some((i: any) => i.id === act.id) && !('track' in listed.data.items[0]), listed.data);

  await call('PATCH', `/activities/${act.id}`, token, { audience: 'ONLY_ME' });
  check('ONLY_ME is 404 for a stranger', (await call('GET', `/activities/${act.id}`, stranger)).status === 404);
  check('ONLY_ME is not on the stranger’s list', !(await call('GET', `/hashers/${meId}/activities`, stranger)).data.items.some((i: any) => i.id === act.id));
  check('ONLY_ME is still the owner’s', (await call('GET', `/activities/${act.id}`, token)).status === 200);

  const mine = await call('GET', '/me/activities?limit=5', token);
  check('my list has it, without the track', mine.data.items.some((i: any) => i.id === act.id) && !('track' in mine.data.items[0]), mine.data);

  // A secret trail hides a hare's track from everyone else.
  const trail = await prisma.trail.findFirst({
    where: { releasedAt: null, status: { in: ['HIDDEN', 'LOCKED', 'PLANNING', 'DRAFT', 'REVIEW'] } },
    select: { id: true, runId: true },
  });
  const created: string[] = [];
  if (!trail) {
    console.log('SKIP  no unreleased trail in the database for the secrecy check');
  } else {
    const had = await prisma.runHare.findUnique({ where: { runId_userId: { runId: trail.runId, userId: meId } } });
    if (!had) await prisma.runHare.create({ data: { runId: trail.runId, userId: meId } });
    const layer = await call('POST', '/me/activities', token, body({ kind: 'TRAIL_LAYING', runId: trail.runId, audience: 'PUBLIC' }));
    check('a hare can record laying the trail', layer.status === 201 && layer.data.activity.trailId, layer);
    const id = layer.data?.activity?.id as string;
    check('a PUBLIC hare track is still 404 before release', (await call('GET', `/activities/${id}`, stranger)).status === 404);
    check('and absent from the hare’s list', !(await call('GET', `/hashers/${meId}/activities`, stranger)).data.items.some((i: any) => i.id === id));
    check('the hare still reads it', (await call('GET', `/activities/${id}`, token)).status === 200);
    await prisma.trail.update({ where: { id: trail.id }, data: { releasedAt: new Date() } });
    check('once the trail is released it can be seen', (await call('GET', `/activities/${id}`, stranger)).status === 200);
    await prisma.trail.update({ where: { id: trail.id }, data: { releasedAt: null } });
    if (!had) await prisma.runHare.delete({ where: { runId_userId: { runId: trail.runId, userId: meId } } });
    const notHare = await call('POST', '/me/activities', stranger, body({ kind: 'TRAIL_LAYING', runId: trail.runId }));
    check('someone who is not a hare cannot record laying it', notHare.status === 404, notHare);
    created.push(id);
  }

  // Passport distance uses a recorded hash run over the hare's estimate.
  const run = await prisma.run.findFirst({ select: { id: true } });
  if (run) {
    const hadPart = await prisma.participation.findFirst({ where: { runId: run.id, userId: meId } });
    const part = hadPart ?? (await prisma.participation.create({ data: { runId: run.id, userId: meId, checkedInAt: new Date(), checkInMethod: 'MANUAL' } }));
    const hr = await call('POST', '/me/activities', token, body({ kind: 'HASH_RUN', runId: run.id }));
    check('a hash run you are on records (201)', hr.status === 201, hr);
    const ev = await prisma.domainEvent.findFirst({ where: { eventType: 'RunActivityRecorded', aggregateId: hr.data?.activity?.id } });
    check('it wrote a RunActivityRecorded event with no coordinates', Boolean(ev) && !JSON.stringify(ev!.payload).match(/lat|lng|track/), ev?.payload);
    created.push(hr.data?.activity?.id);
    if (!hadPart) await prisma.participation.delete({ where: { id: part.id } });
  }

  // Delete.
  const del = await call('DELETE', `/activities/${act.id}`, token);
  check('the owner deletes it', del.status === 200, del);
  check('it is then 404 even for the owner', (await call('GET', `/activities/${act.id}`, token)).status === 404);
  const row = await prisma.runActivity.findUnique({ where: { id: act.id } });
  check('the row stays (history is append-only)', Boolean(row?.deletedAt));

  // Tidy: these recordings were made by this script.
  await prisma.runActivity.deleteMany({ where: { userId: meId, clientId: { startsWith: tag } } });
  void created;
}

(async () => {
  maths();
  await api();
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
})();
