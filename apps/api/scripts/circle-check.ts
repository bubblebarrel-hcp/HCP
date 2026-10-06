// FR-CIRCLE-002 and FR-CIRCLE-014 checks: Circle attendance kept apart from trail
// attendance, and the kennel's Circle audience (PUBLIC / MEMBERS / ATTENDEES /
// OFFICERS), which can narrow a run and never widen it. Run against a local API
// on the seeded heavy database: `npx tsx scripts/circle-check.ts`.
//
// It changes the kennel's circleVisibility and adds Circle attendees to a run
// that is in Reporting, and puts both back as it found them.

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
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.code}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

type Who = { token?: string; label: string };

async function main() {
  const run = await prisma.run.findFirst({
    where: {
      status: { in: ['CIRCLE', 'REPORTING'] },
      visibility: 'PUBLIC',
      kennel: { visibility: { not: 'HIDDEN' } },
      circle: { isNot: null },
    },
    select: {
      id: true,
      kennelId: true,
      kennel: { select: { circleVisibility: true } },
      hares: { select: { user: { select: { email: true } } } },
      capsule: { select: { id: true } },
    },
  });
  if (!run) throw new Error('no public run in Circle or Reporting with a Circle record');
  const originalVisibility = run.kennel.circleVisibility;

  const hareEmail = run.hares[0].user.email;
  const hareIds = (await prisma.runHare.findMany({ where: { runId: run.id }, select: { userId: true } })).map((h) => h.userId);
  const member = await prisma.user.findFirst({
    where: {
      email: { startsWith: 'member' },
      status: 'ACTIVE',
      id: { notIn: hareIds },
      memberships: { some: { kennelId: run.kennelId, status: 'ACTIVE' } },
    },
    select: { id: true, email: true },
  });
  const memberTwo = await prisma.user.findFirst({
    where: {
      email: { startsWith: 'member' },
      status: 'ACTIVE',
      id: { notIn: [...hareIds, member!.id] },
      memberships: { some: { kennelId: run.kennelId, status: 'ACTIVE' } },
    },
    select: { id: true, email: true },
  });
  const outsider = await prisma.user.findFirst({
    where: {
      email: { startsWith: 'member' },
      status: 'ACTIVE',
      memberships: { none: { kennelId: run.kennelId } },
      participations: { none: { runId: run.id } },
    },
    select: { email: true },
  });
  if (!member || !memberTwo || !outsider) throw new Error('need two kennel members and an outsider in the seed');

  const operator = await login(hareEmail);
  const memberA = await login(member.email);
  const memberB = await login(memberTwo.email);
  const stranger = await login(outsider.email);

  const original = await prisma.circleAttendee.findMany({ where: { circle: { runId: run.id } } });
  await prisma.circleAttendee.deleteMany({ where: { circle: { runId: run.id } } });

  try {
    // ── Recording ──
    const noBody = await call('POST', `/runs/${run.id}/circle/attendance`, operator.token, {});
    check('empty attendance body is refused', noBody.status === 400, noBody);

    const byMember = await call('POST', `/runs/${run.id}/circle/attendance`, memberA.token, { userIds: [memberA.id] });
    check('a plain member cannot record attendance', byMember.status === 403, byMember);

    const anon = await call('POST', `/runs/${run.id}/circle/attendance`, undefined, { fromTrail: true });
    check('signed out cannot record attendance', anon.status === 401, anon);

    const bogus = await call('POST', `/runs/${run.id}/circle/attendance`, operator.token, {
      userIds: [stranger.id],
    });
    check('someone neither on the run nor in the kennel is refused', bogus.status === 400 && bogus.code === 'NOT_ON_RUN', bogus);

    const first = await call('POST', `/runs/${run.id}/circle/attendance`, operator.token, { userIds: [memberA.id] });
    check('operator records a member who was at the Circle', first.status === 201, first);
    const again = await call('POST', `/runs/${run.id}/circle/attendance`, operator.token, { userIds: [memberA.id] });
    check('recording the same person twice is harmless', again.status === 201, again);
    const rows = await prisma.circleAttendee.count({ where: { circle: { runId: run.id } } });
    check('...and does not duplicate the row', rows === 1, rows);

    // Circle attendance is its own record: the trail's check-ins are untouched.
    const trailBefore = await prisma.participation.count({ where: { runId: run.id, checkedInAt: { not: null } } });
    const fromTrail = await call('POST', `/runs/${run.id}/circle/attendance`, operator.token, { fromTrail: true });
    check('operator can start from the trail check-ins', fromTrail.status === 201, fromTrail);
    const trailAfter = await prisma.participation.count({ where: { runId: run.id, checkedInAt: { not: null } } });
    check('recording the Circle leaves trail attendance alone', trailBefore === trailAfter, { trailBefore, trailAfter });

    const detail = await call('GET', `/runs/${run.id}`, operator.token);
    const attendees = (detail.data?.run?.circle?.attendees ?? []) as { id: string; userId: string | null; name: string }[];
    check('run detail lists Circle attendees', attendees.some((a) => a.userId === memberA.id), attendees);
    check('...as names only, nothing private', attendees.every((a) => !('email' in a) && typeof a.name === 'string'));

    // ── Who may read the Circle (FR-CIRCLE-014) ──
    const readers: Record<string, Who> = {
      anon: { label: 'signed out' },
      stranger: { token: stranger.token, label: 'signed in, not in the kennel' },
      attendee: { token: memberA.token, label: 'member recorded at the Circle' },
      member: { token: memberB.token, label: 'member not recorded' },
      operator: { token: operator.token, label: 'hare' },
    };
    // Make sure memberB really is not an attendee, whatever the trail check-ins were.
    await prisma.circleAttendee.deleteMany({ where: { circle: { runId: run.id }, userId: memberB.id } });

    const expected: Record<string, Record<string, boolean>> = {
      PUBLIC: { anon: true, stranger: true, attendee: true, member: true, operator: true },
      MEMBERS: { anon: false, stranger: false, attendee: true, member: true, operator: true },
      ATTENDEES: { anon: false, stranger: false, attendee: true, member: false, operator: true },
      OFFICERS: { anon: false, stranger: false, attendee: false, member: false, operator: true },
    };

    for (const level of ['PUBLIC', 'MEMBERS', 'ATTENDEES', 'OFFICERS'] as const) {
      await prisma.kennel.update({ where: { id: run.kennelId }, data: { circleVisibility: level } });
      for (const [key, who] of Object.entries(readers)) {
        const r = await call('GET', `/runs/${run.id}`, who.token);
        const sees = r.data?.run?.circle != null;
        check(`${level}: ${who.label} ${expected[level][key] ? 'reads' : 'does not read'} the Circle`, sees === expected[level][key], {
          status: r.status,
          circle: r.data?.run?.circle ? 'present' : r.data?.run?.circle,
        });
        check(`${level}: ${who.label} is told the same in viewer.canSeeCircle`, r.data?.run?.viewer?.canSeeCircle === expected[level][key]);
      }

      if (run.capsule) {
        for (const key of ['anon', 'member', 'operator']) {
          const who = readers[key];
          const c = await call('GET', `/runs/${run.id}/capsule`, who.token);
          if (c.status !== 200) continue;
          const sees = expected[level][key];
          const awardEntries = ((c.data?.capsule?.timeline ?? []) as { kind: string }[]).filter((e) => e.kind === 'AWARD').length;
          check(`${level}: capsule circle for ${who.label}`, (c.data?.capsule?.circle != null) === sees, c.data?.capsule?.circle);
          check(`${level}: capsule award entries for ${who.label}`, sees ? true : awardEntries === 0, awardEntries);
          check(`${level}: capsule award count for ${who.label}`, sees ? true : c.data?.capsule?.stats?.awards === 0, c.data?.capsule?.stats);
        }
      }
    }

    // A restricted Circle cannot be widened past the run: a members-only run stays
    // out of reach of a signed-out reader even with a PUBLIC Circle.
    await prisma.kennel.update({ where: { id: run.kennelId }, data: { circleVisibility: 'PUBLIC' } });
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'MEMBERS_ONLY' } });
    const closed = await call('GET', `/runs/${run.id}`);
    check('PUBLIC Circle on a members-only run is still invisible signed out', closed.status === 404, closed.status);
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'PUBLIC' } });

    // ── Correcting ──
    const target = (await prisma.circleAttendee.findFirst({ where: { circle: { runId: run.id }, userId: memberA.id } }))!;
    const byOther = await call('DELETE', `/runs/${run.id}/circle/attendance/${target.id}`, memberB.token);
    check('a plain member cannot remove an attendee', byOther.status === 403, byOther);
    const removed = await call('DELETE', `/runs/${run.id}/circle/attendance/${target.id}`, operator.token);
    check('operator removes an attendee', removed.status === 200, removed);
    const missing = await call('DELETE', `/runs/${run.id}/circle/attendance/${target.id}`, operator.token);
    check('removing twice is a 404', missing.status === 404, missing);
    const events = await prisma.domainEvent.count({
      where: { aggregateId: run.id, eventType: { in: ['CircleAttendanceRecorded', 'CircleAttendanceRemoved'] } },
    });
    check('attendance changes write domain events', events >= 2, events);

    const settings = await call('PATCH', `/kennels/${(await prisma.kennel.findUnique({ where: { id: run.kennelId }, select: { slug: true } }))!.slug}/settings`, memberA.token, {
      circleVisibility: 'OFFICERS',
    });
    check('a plain member cannot change the Circle audience', settings.status === 403, settings);
  } finally {
    await prisma.run.update({ where: { id: run.id }, data: { visibility: 'PUBLIC' } });
    await prisma.kennel.update({ where: { id: run.kennelId }, data: { circleVisibility: originalVisibility } });
    await prisma.circleAttendee.deleteMany({ where: { circle: { runId: run.id } } });
    if (original.length) await prisma.circleAttendee.createMany({ data: original });
  }

  console.log(`circle-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
