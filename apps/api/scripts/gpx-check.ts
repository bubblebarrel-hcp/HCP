// FR-TRAIL-002 checks: GPX in and out. The parser against hostile and odd files,
// a file written then read back, and the API: only a trail's planners may import,
// only while it is being planned, and the export is exactly as secret as the trail.
// Run against a local API on the seeded database: `npx tsx scripts/gpx-check.ts`.
//
// It makes one throwaway trail on a planned run and deletes it at the end.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MAX_ROUTE_POINTS, buildGpx, classify, exportKind, parseGpx, routeLengthM, routeSegments, thin } from '../src/utils/gpx';

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
  const raw = await res.text();
  let json: { data?: any; error?: { code?: string } } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* a GPX body is not JSON */
  }
  return { status: res.status, data: json.data, code: json.error?.code, raw, headers: res.headers };
}

async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.code}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

function throws(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'ERR';
  }
}

const GPX = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

// A straight line of n points near Abuja, a few metres apart.
function track(n: number, step = 0.00005) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) pts.push(`<trkpt lat="${(9.07 + i * step).toFixed(6)}" lon="${(7.49 + i * step).toFixed(6)}"><ele>400</ele></trkpt>`);
  return `<trk><name>Lap</name><trkseg>${pts.join('')}</trkseg></trk>`;
}

function unit() {
  // ── Reading a normal file ──
  const good = parseGpx(
    GPX(
      `<metadata><name>Jabi Loop</name></metadata>
       <wpt lat="9.0658" lon="7.4913"><name>Park gate</name><type>Start</type></wpt>
       <wpt lat="9.0689" lon="7.4952"><name>Beer check at the pub</name></wpt>
       <wpt lat="9.0721" lon="7.4998"><name>Busy road crossing</name><desc>Marshal here</desc></wpt>
       <wpt lat="9.0703" lon="7.5041"><name>Regroup on the rocks</name></wpt>
       <wpt lat="9.0658" lon="7.4913"><name>On In</name></wpt>
       <wpt lat="9.0700" lon="7.5000"><name>x</name><type>Chalk</type></wpt>
       ${track(40)}`,
    ),
  );
  check('a track becomes the route', good.route.length >= 2 && good.routeSource === 'track', good.route.length);
  check('the file name is read', good.name === 'Jabi Loop', good.name);
  check('waypoints are classified', good.waypoints.map((w) => w.kind).join() === 'START,BEER_CHECK,HAZARD,REGROUP,ON_IN', good.waypoints.map((w) => w.kind));
  check('notes come from desc', good.waypoints[2].notes === 'Marshal here');
  check('chalk is not read back', good.skipped.chalk === 1, good.skipped);

  // ── The planned-route fallback and the longest track wins ──
  const rte = parseGpx(GPX('<rte><rtept lat="9.1" lon="7.1"/><rtept lat="9.2" lon="7.2"/><rtept lat="9.3" lon="7.3"/></rte>'));
  check('a planned route is used when there is no track', rte.routeSource === 'route' && rte.route.length === 3, rte);
  const two = parseGpx(GPX(`${track(5)}${track(50)}`));
  check('the longest track is the trail', two.route.length > 5, two.route.length);

  // ── Hostile input ──
  check('empty is refused', throws(() => parseGpx('')) === 'INVALID_GPX');
  check('not XML is refused', throws(() => parseGpx('hello, I am a file')) === 'INVALID_GPX');
  check('the wrong root is refused', throws(() => parseGpx('<kml><x/></kml>')) === 'INVALID_GPX');
  check(
    'a DOCTYPE is refused outright',
    throws(() => parseGpx('<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY a "aaaa">]><gpx><wpt lat="1" lon="1"><name>&a;</name></wpt></gpx>')) === 'INVALID_GPX',
  );
  const lol = '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>';
  check('an entity bomb is refused', throws(() => parseGpx(`${lol}<gpx><wpt lat="1" lon="1"><name>&lol2;</name></wpt></gpx>`)) === 'INVALID_GPX');
  const bad = parseGpx(GPX('<wpt lat="91" lon="0"><name>a</name></wpt><wpt lat="x" lon="0"><name>b</name></wpt><wpt lat="10" lon="181"/><wpt lat="5" lon="5"><name>ok</name></wpt>'));
  check('impossible coordinates are dropped and counted', bad.waypoints.length === 1 && bad.skipped.badPoints === 3, bad);
  const xss = parseGpx(GPX('<wpt lat="1" lon="1"><name>&lt;script&gt;alert(1)&lt;/script&gt;</name></wpt>'));
  check('markup in a name stays as text', xss.waypoints[0].name === '<script>alert(1)</script>', xss.waypoints[0].name);
  const many = Array.from({ length: 260 }, (_, i) => `<wpt lat="${1 + i / 1000}" lon="1"><name>w${i}</name></wpt>`).join('');
  const capped = parseGpx(GPX(many));
  check('waypoints are capped and the rest counted', capped.waypoints.length === 200 && capped.skipped.overCap === 60, capped.skipped);
  const huge = parseGpx(GPX(track(9000, 0.00002)));
  check('a long track is thinned under the cap', huge.route.length <= MAX_ROUTE_POINTS && huge.route.length > 100, huge.route.length);
  check('thinning keeps both ends', huge.route[0].lat === 9.07 && Math.abs(huge.route[huge.route.length - 1].lat - (9.07 + 8999 * 0.00002)) < 1e-4);
  check('standing still does not add points', thin([{ lat: 1, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1, lng: 1 }, { lat: 1.001, lng: 1 }]).length === 2);
  check('route length is sane', Math.abs(routeLengthM([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }]) - 1112) < 5);
  check('with no track the route is empty', parseGpx(GPX('<wpt lat="1" lon="1"><name>only</name></wpt>')).route.length === 0);

  // ── classify ──
  check('beer by name', classify('Beer check 1', null, null, null) === 'BEER_CHECK');
  check('"barrier" is not a bar', classify('Barrier gate', null, null, null) !== 'BEER_CHECK');
  check('unknown is a checkpoint', classify('Mango tree', null, null, null) === 'CHECKPOINT');
  check('our own type wins', classify('Beer garden', 'Hazard', null, null) === 'HAZARD');

  // ── Writing, then reading it back ──
  const out = buildGpx({
    name: 'Abuja #12: <Tricky> & "quoted"',
    description: 'a & b',
    route: [[{ lat: 9.07, lng: 7.49 }, { lat: 9.071, lng: 7.491 }, { lat: 9.072, lng: 7.492 }]],
    waypoints: [
      { lat: 9.07, lng: 7.49, name: 'Start', notes: null, ...exportKind('START') },
      { lat: 9.071, lng: 7.491, name: 'Pub & grill', notes: 'a <b> note', ...exportKind('BEER_CHECK') },
      { lat: 9.0715, lng: 7.4915, name: 'Chalk', notes: null, ...exportKind('CHALK') },
    ],
  });
  check('output is a GPX document', out.startsWith('<?xml') && out.includes('xmlns="http://www.topografix.com/GPX/1/1"'));
  check('markup in names is escaped on the way out', !out.includes('<Tricky>') && out.includes('&lt;Tricky&gt;'));
  const back = parseGpx(out);
  check('a written file reads back: route', back.route.length === 3 && back.routeSource === 'track', back.route.length);
  check('...kinds survive', back.waypoints.map((w) => w.kind).join() === 'START,BEER_CHECK', back.waypoints.map((w) => w.kind));
  check('...text survives escaping', back.waypoints[1].name === 'Pub & grill' && back.waypoints[1].notes === 'a <b> note', back.waypoints[1]);
  check('...name survives', back.name === 'Abuja #12: <Tricky> & "quoted"', back.name);
  check('routeSegments handles LineString, MultiLineString and features', routeSegments({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]] } }] }).length === 2);
}

async function api() {
  const run = await prisma.run.findFirst({
    where: {
      status: { in: ['SCHEDULED', 'PLANNING'] },
      visibility: 'PUBLIC',
      kennel: { visibility: { not: 'HIDDEN' } },
      hares: { some: {} },
    },
    select: { id: true, kennelId: true, hares: { select: { user: { select: { id: true, email: true } } } } },
  });
  if (!run) throw new Error('no public planned run with a hare in the seed');

  const hareEmail = run.hares[0].user.email;
  const hareIds = run.hares.map((h) => h.user.id);
  const outsider = await prisma.user.findFirst({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE', id: { notIn: hareIds }, memberships: { none: { kennelId: run.kennelId } } },
    select: { email: true },
  });
  const fellowMember = await prisma.user.findFirst({
    where: {
      email: { startsWith: 'member' },
      status: 'ACTIVE',
      id: { notIn: hareIds },
      memberships: { some: { kennelId: run.kennelId, status: 'ACTIVE' } },
    },
    select: { email: true },
  });
  if (!outsider || !fellowMember) throw new Error('need an outsider and a fellow member in the seed');

  const hare = await login(hareEmail);
  const member = await login(fellowMember.email);
  const stranger = await login(outsider.email);

  const name = `GPX check ${Date.now()}`;
  let trailId: string | null = null;
  try {
    const made = await call('POST', `/runs/${run.id}/trails`, hare.token, { name });
    check('hare creates a trail to import into', made.status === 201, made);
    trailId = made.data?.trail?.id ?? null;
    if (!trailId) throw new Error('no trail created');

    const file = GPX(
      `<wpt lat="9.0658" lon="7.4913"><name>Park gate</name><type>Start</type></wpt>
       <wpt lat="9.0689" lon="7.4952"><name>Pub stop</name><type>Beer check</type></wpt>
       <wpt lat="9.0721" lon="7.4998"><name>Busy road crossing</name></wpt>
       ${track(60, 0.0003)}`,
    );

    // ── Who may import ──
    const byMember = await call('POST', `/trails/${trailId}/import/gpx`, member.token, { gpx: file });
    check('a plain member cannot import', byMember.status === 403, byMember.status);
    const byStranger = await call('POST', `/trails/${trailId}/import/gpx`, stranger.token, { gpx: file });
    check('a stranger cannot import', byStranger.status === 403 || byStranger.status === 404, byStranger.status);
    const anon = await call('POST', `/trails/${trailId}/import/gpx`, undefined, { gpx: file });
    check('signed out cannot import', anon.status === 401, anon.status);

    // ── Bad files ──
    const junk = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: 'this is not a gpx file at all, no' });
    check('junk is a 400 INVALID_GPX', junk.status === 400 && junk.code === 'INVALID_GPX', junk);
    const nothing = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: GPX('<metadata><name>empty</name></metadata>') });
    check('a file with nothing in it is NOTHING_TO_IMPORT', nothing.status === 400 && nothing.code === 'NOTHING_TO_IMPORT', nothing);
    const bomb = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, {
      gpx: '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY a "aaaa">]><gpx><wpt lat="1" lon="1"><name>&a;</name></wpt></gpx>',
    });
    check('a DOCTYPE is refused through the API', bomb.status === 400, bomb.status);
    const notString = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: { not: 'a string' } });
    check('a non-string body is a 400', notString.status === 400, notString.status);
    const tooBig = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: 'x'.repeat(2_100_000) });
    check('an over-large body is refused, not a 500', tooBig.status === 400 || tooBig.status === 413, tooBig.status);

    // ── A good import ──
    const imp = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: file });
    check('hare imports a GPX file', imp.status === 200, imp);
    check('...the route came in', imp.data?.import?.route?.points >= 2, imp.data?.import);
    check('...one beer check and two places', imp.data?.import?.beerChecks === 1 && imp.data?.import?.waypoints === 2, imp.data?.import);
    const secret = imp.data?.trail?.secret;
    check('...the hare sees the route, start and finish', secret?.routeGeoJson?.type === 'LineString' && secret.startLatitude !== null && secret.finishLatitude !== null, secret && { start: secret.startLatitude });
    check('...as a real LineString of [lng, lat]', Math.abs(secret.routeGeoJson.coordinates[0][0] - 7.49) < 0.1);
    check('...with an estimated distance', imp.data?.trail?.estimatedDistanceM > 100, imp.data?.trail?.estimatedDistanceM);
    const rev = await prisma.trailRevision.findFirst({ where: { trailId }, orderBy: { createdAt: 'desc' } });
    check('...recorded as a revision', JSON.stringify(rev?.changes).includes('gpxImport'), rev?.changes);
    const events = await prisma.domainEvent.count({ where: { aggregateId: trailId, eventType: 'TrailRevised' } });
    check('...and as a TrailRevised event', events >= 1, events);

    // A second import adds places after the first, and `replace` puts them away first.
    const again = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: file });
    check('importing again adds after what is there', (again.data?.trail?.secret?.waypoints?.length ?? 0) === 4, again.data?.trail?.secret?.waypoints?.length);
    const replaced = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: file, replace: true });
    check('replace puts the old places away first', replaced.data?.trail?.secret?.waypoints?.length === 2 && replaced.data?.trail?.secret?.beerChecks?.length === 1, replaced.data?.trail?.secret);
    const soft = await prisma.waypoint.count({ where: { trailId, deletedAt: { not: null } } });
    check('...softly, the history stays', soft >= 4, soft);

    // ── Export: as secret as the trail ──
    const ownExport = await call('GET', `/trails/${trailId}/gpx`, hare.token);
    check('hare exports a draft trail', ownExport.status === 200 && ownExport.raw.includes('<trkpt'), ownExport.status);
    check('...as a GPX attachment', (ownExport.headers.get('content-type') ?? '').includes('application/gpx+xml') && (ownExport.headers.get('content-disposition') ?? '').includes('.gpx'));
    check('...never cached', (ownExport.headers.get('cache-control') ?? '').includes('no-store'));
    const readBack = parseGpx(ownExport.raw);
    // The imported places (start, crossing, pub) plus a Finish pin from the route's end, since no place marks it.
    check('...and it reads back to what was imported', readBack.route.length >= 2 && readBack.waypoints.length === 4 && readBack.waypoints.some((w) => w.kind === 'FINISH'), { r: readBack.route.length, w: readBack.waypoints.map((x) => x.kind) });
    const roundTrip = await call('GET', `/trails/${trailId}/gpx`, hare.token);
    const noTime = (xml: string) => xml.replace(/<time>[^<]*<\/time>/, '');
    check('...and exporting twice gives the same file', noTime(roundTrip.raw) === noTime(ownExport.raw));

    const memberExport = await call('GET', `/trails/${trailId}/gpx`, member.token);
    check('a fellow member cannot export before release', memberExport.status === 403 && !memberExport.raw.includes('<trkpt'), memberExport.status);
    const anonExport = await call('GET', `/trails/${trailId}/gpx`);
    check('signed out cannot export before release', anonExport.status === 403 && !anonExport.raw.includes('<trkpt'), anonExport.status);
    const bad = await call('GET', '/trails/not-a-uuid/gpx', hare.token);
    check('a bad id is a 404', bad.status === 404, bad.status);

    // Once released, anyone who can see the run can take the route.
    await prisma.trail.update({ where: { id: trailId }, data: { status: 'RELEASED', releasedAt: new Date() } });
    const after = await call('GET', `/trails/${trailId}/gpx`);
    check('after release a signed-out reader of a public run can export', after.status === 200 && after.raw.includes('<trkpt'), after.status);

    // ── Not once the trail is locked ──
    await prisma.trail.update({ where: { id: trailId }, data: { status: 'DRAFT', releasedAt: null } });
    await prisma.trail.update({ where: { id: trailId }, data: { status: 'LOCKED' } });
    const locked = await call('POST', `/trails/${trailId}/import/gpx`, hare.token, { gpx: file });
    check('a locked trail cannot be imported into', locked.status === 409 && locked.code === 'TRAIL_NOT_EDITABLE', locked);
  } finally {
    if (trailId) {
      await prisma.trailRevision.deleteMany({ where: { trailId } });
      await prisma.waypoint.deleteMany({ where: { trailId } });
      await prisma.beerCheck.deleteMany({ where: { trailId } });
      await prisma.digitalChalkSymbol.deleteMany({ where: { trailId } });
      await prisma.trailHare.deleteMany({ where: { trailId } });
      await prisma.trail.delete({ where: { id: trailId } });
    }
  }
}

async function main() {
  unit();
  await api();
  console.log(`gpx-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
