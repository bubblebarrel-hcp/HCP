// FR-NOT-005/007/008/011/013/016 checks: digests, grouping, and the reminder and
// escalation ladders. Run against the seeded database: `npx tsx scripts/digest-check.ts`.
//
// It runs the services in this process, not through the API, and it replaces the
// mail provider and the push endpoint with fakes before anything is loaded, so
// nothing is sent to anyone. The events it writes are marked published straight
// away so the running server's outbox does not pick them up, and everything it
// creates is removed at the end.

import 'dotenv/config';
import { randomUUID } from 'node:crypto';

// ── Fakes, in place before any service is imported ──
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_fake_for_check';
process.env.PUSH_ENABLED = 'true';

const sentEmails: { to: string; subject: string; paragraphs?: string[] }[] = [];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module');
const realLoad = Module._load;
Module._load = function (request: string, ...rest: unknown[]) {
  if (request === 'resend') {
    class FakeResend {
      emails = {
        send: async (args: { to: string; subject: string }) => {
          sentEmails.push({ to: args.to, subject: args.subject });
          return { data: { id: `fake-${sentEmails.length}` }, error: null };
        },
      };
    }
    return { Resend: FakeResend };
  }
  return realLoad.call(this, request, ...rest);
};
const pushed: unknown[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  if (String(input).includes('exp.host')) {
    pushed.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'fake-ticket' }] }), { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail ?? '');
  }
}

async function main() {
  const { DeliveryChannel, DeliveryStatus, DigestFrequency, NotificationCategory, NotificationPriority, PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const schedule = await import('../src/utils/digest-schedule');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const notifications = await import('../src/services/notification.service');
  const digests = await import('../src/services/digest.service');
  const escalation = await import('../src/services/escalation.service');

  const D = DigestFrequency;
  const iso = (s: string) => new Date(s);

  // ───────────── The schedule, exactly ─────────────
  const last = schedule.lastDigestTime;
  check('morning, after 8am local: today', +last(D.MORNING, 'Africa/Lagos', iso('2026-10-05T07:30:00Z')) === +iso('2026-10-05T07:00:00Z'));
  check('morning, before 8am local: yesterday', +last(D.MORNING, 'Africa/Lagos', iso('2026-10-05T06:30:00Z')) === +iso('2026-10-04T07:00:00Z'));
  check('evening in New York (EDT)', +last(D.EVENING, 'America/New_York', iso('2026-10-05T23:00:00Z')) === +iso('2026-10-05T22:00:00Z'));
  check('evening, before 6pm: yesterday', +last(D.EVENING, 'America/New_York', iso('2026-10-05T21:00:00Z')) === +iso('2026-10-04T22:00:00Z'));
  check('weekly is Monday morning', +last(D.WEEKLY, 'Africa/Lagos', iso('2026-10-07T12:00:00Z')) === +iso('2026-10-05T07:00:00Z'));
  check('weekly, Monday before 8am: the Monday before', +last(D.WEEKLY, 'Africa/Lagos', iso('2026-10-05T06:00:00Z')) === +iso('2026-09-28T07:00:00Z'));
  check('daylight saving: the morning after the clocks go back', +last(D.MORNING, 'America/New_York', iso('2026-11-01T12:30:00Z')) === +iso('2026-10-31T12:00:00Z'));
  check('daylight saving: and once it is 8am again', +last(D.MORNING, 'America/New_York', iso('2026-11-01T13:30:00Z')) === +iso('2026-11-01T13:00:00Z'));
  check('hourly is the top of the hour', +last(D.HOURLY, 'Africa/Lagos', iso('2026-10-05T14:35:00Z')) === +iso('2026-10-05T14:00:00Z'));
  check('immediate is now', +last(D.IMMEDIATE, 'UTC', iso('2026-10-05T14:35:00Z')) === +iso('2026-10-05T14:35:00Z'));
  check('an unknown zone falls back to UTC', +last(D.MORNING, 'Not/AZone', iso('2026-10-05T08:30:00Z')) === +iso('2026-10-05T08:00:00Z'));
  check('no zone falls back to UTC', +last(D.MORNING, null, iso('2026-10-05T07:59:00Z')) === +iso('2026-10-04T08:00:00Z'));
  check('held before the boundary is due', schedule.isDue(D.MORNING, 'Africa/Lagos', iso('2026-10-05T05:00:00Z'), iso('2026-10-05T07:30:00Z')));
  check('held after the boundary waits', !schedule.isDue(D.MORNING, 'Africa/Lagos', iso('2026-10-05T07:10:00Z'), iso('2026-10-05T07:30:00Z')));

  // ───────────── What may be held at all ─────────────
  const C = NotificationCategory;
  const P = NotificationPriority;
  check('normal applause may be held', notifications.mayHold(C.SOCIAL, P.LOW) && notifications.mayHold(C.RUN, P.NORMAL));
  check('high priority is never held', !notifications.mayHold(C.RUN, P.HIGH) && !notifications.mayHold(C.MEMBERSHIP, P.CRITICAL));
  check('safety, trail release and reminders are never held', !notifications.mayHold(C.SAFETY, P.LOW) && !notifications.mayHold(C.TRAIL_RELEASE, P.NORMAL) && !notifications.mayHold(C.REMINDER, P.NORMAL));

  // ───────────── People ─────────────
  const people = await prisma.user.findMany({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE' },
    orderBy: { email: 'asc' },
    take: 8,
    select: { id: true, email: true },
  });
  const [A, B, Cc, Dd] = people;
  const me = { id: A.id, role: 'USER' as const };
  const created = { notifications: new Set<string>(), events: new Set<string>() };

  const prefIds: string[] = [];
  const setPref = async (userId: string, category: any, channel: any, enabled: boolean) => {
    const row = await prisma.notificationPreference.create({ data: { userId, category, channel, enabled } });
    prefIds.push(row.id);
  };
  const device = await prisma.pushDevice.create({
    data: { userId: A.id, platform: 'IOS', pushToken: `ExponentPushToken[check-${randomUUID().slice(0, 8)}]` },
  });
  const oldZone = (await prisma.user.findUnique({ where: { id: A.id }, select: { timeZone: true } }))?.timeZone ?? null;

  await prisma.user.update({ where: { id: A.id }, data: { timeZone: 'Africa/Lagos' } });
  // Applause is in-app only by default; ask for it on email and push so there is something to hold.
  await setPref(A.id, C.SOCIAL, DeliveryChannel.EMAIL, true);
  await setPref(A.id, C.SOCIAL, DeliveryChannel.PUSH, true);

  const like = (actorId: string, subject: string, id = randomUUID()) =>
    ({
      id,
      eventType: 'ContentLiked',
      aggregateType: 'Reel',
      aggregateId: subject,
      actorId,
      actorType: 'USER',
      occurredAt: new Date(),
      payload: { authorId: A.id, subjectType: 'REEL', reaction: 'BEER' },
    }) as any;

  const freshEmails = () => sentEmails.splice(0, sentEmails.length);
  const transport = {
    email: async (input: any) => {
      sentEmails.push({ to: input.to, subject: input.subject, paragraphs: input.paragraphs });
      return { sent: true, providerMessageId: 'fake-digest' };
    },
    push: async (_userId: string, message: any) => {
      pushed.push({ digest: true, ...message });
      return { sent: 1, failed: 0, providerMessageId: 'fake-push' };
    },
  };

  try {
    // ───────────── A digest holds email and push, never the inbox ─────────────
    await notifications.setDigest(me, C.SOCIAL, D.MORNING);
    const prefs = await notifications.getPreferences(me);
    check('the preference reads back', prefs.categories.find((c) => c.category === C.SOCIAL)?.digest === 'MORNING');
    check('categories that cannot be digested say so', prefs.categories.find((c) => c.category === C.SAFETY)?.digestable === false);

    let refused: string | undefined;
    try {
      await notifications.setDigest(me, C.SAFETY, D.WEEKLY);
    } catch (e: any) {
      refused = e.code;
    }
    check('a never-digest category refuses a digest', refused === 'NOT_DIGESTABLE', refused);

    const reel1 = randomUUID();
    const e1 = like(B.id, reel1);
    await notifications.fanOut(e1);
    const first = await prisma.notification.findFirst({ where: { domainEventId: e1.id }, include: { deliveries: true } });
    if (first) created.notifications.add(first.id);
    check('the inbox copy is delivered at once', first?.deliveries.some((d) => d.channel === 'IN_APP' && d.status === 'SENT') === true, first?.deliveries);
    check('email is held, not sent', first?.deliveries.some((d) => d.channel === 'EMAIL' && d.status === DeliveryStatus.HELD) === true, first?.deliveries);
    check('push is held, not sent', first?.deliveries.some((d) => d.channel === 'PUSH' && d.status === DeliveryStatus.HELD) === true);
    check('nothing went out', freshEmails().length === 0 && pushed.length === 0);
    check('the policy is digest, and says why', first?.deliveryPolicy === 'digest' && /held for your every morning digest/.test(first?.evaluationReason ?? ''), first?.evaluationReason);

    // ───────────── Grouping ─────────────
    await notifications.fanOut(like(Cc.id, reel1));
    await notifications.fanOut(like(Dd.id, reel1));
    const group = await prisma.notification.findMany({ where: { recipientUserId: A.id, groupKey: { contains: reel1 } }, include: { deliveries: true } });
    check('three reactions to one reel are one notification', group.length === 1 && group[0].groupCount === 3, group.map((g) => g.groupCount));
    check('its title counts the others', /and 1 other reacted to your reel$/.test(group[0]?.title ?? ''), group[0]?.title);
    check('it did not queue a second email or push', group[0]?.deliveries.filter((d) => d.channel === 'EMAIL').length === 1 && group[0]?.deliveries.filter((d) => d.channel === 'PUSH').length === 1);
    check('and says it was a quiet update', /Grouped with 2 earlier notices/.test(group[0]?.evaluationReason ?? ''), group[0]?.evaluationReason);
    await notifications.fanOut(e1);
    check('replaying an event does not count it twice', (await prisma.notification.findUnique({ where: { id: first!.id } }))?.groupCount === 3);

    // A different reel is a different notice.
    const reel2 = randomUUID();
    const e2 = like(B.id, reel2);
    await notifications.fanOut(e2);
    const second = await prisma.notification.findFirst({ where: { domainEventId: e2.id } });
    if (second) created.notifications.add(second.id);
    check('another reel is its own notification', Boolean(second) && second!.id !== first!.id);

    // ───────────── Due and not due ─────────────
    const heldAt = (await prisma.notificationDelivery.findFirst({ where: { notificationId: first!.id, channel: 'EMAIL' } }))!.createdAt;
    const early = await digests.sendDueDigests(heldAt, transport, [A.id]);
    check('before the next morning nothing is sent', early.emails === 0 && early.pushes === 0, early);

    // Quiet hours hold the push, not the email, when the digest is due.
    await notifications.setQuietHours(me, { start: '00:00', end: '23:59' });
    const later = new Date(heldAt.getTime() + 25 * 3600_000);
    const quiet = await digests.sendDueDigests(later, transport, [A.id]);
    check('a due digest emails even in quiet hours', quiet.emails === 1, quiet);
    check('...but the push waits for them to wake', quiet.pushes === 0 && quiet.deferred >= 1, quiet);
    const stillHeld = await prisma.notificationDelivery.count({ where: { notificationId: first!.id, channel: 'PUSH', status: DeliveryStatus.HELD } });
    check('...and stays held', stillHeld === 1, stillHeld);
    check('one email covers every held notice', sentEmails.length === 1 && /digest: 2 updates/.test(sentEmails[0]?.subject ?? ''), sentEmails[0]?.subject);
    check('...laid out by category', (sentEmails[0]?.paragraphs ?? []).some((p) => /^Followers and applause \(2\)$/.test(p)), sentEmails[0]?.paragraphs);
    freshEmails();

    await notifications.setQuietHours(me, null);
    const awake = await digests.sendDueDigests(later, transport, [A.id]);
    check('out of quiet hours the push goes, as one message', awake.pushes === 1 && pushed.length === 1, awake);
    check('...summarising what was held', /2 updates on Shiggy Trails/.test((pushed[0] as any)?.title ?? ''), pushed[0]);
    const again = await digests.sendDueDigests(later, transport, [A.id]);
    check('running it again sends nothing', again.emails === 0 && again.pushes === 0, again);
    const done = await prisma.notification.findUnique({ where: { id: first!.id } });
    check('the explanation records the digest', /Sent by email in your every morning digest/.test(done?.evaluationReason ?? ''), done?.evaluationReason);
    pushed.length = 0;

    // ───────────── Read in the app first ─────────────
    const reel3 = randomUUID();
    const e3 = like(B.id, reel3);
    await notifications.fanOut(e3);
    const third = await prisma.notification.findFirst({ where: { domainEventId: e3.id } });
    if (third) created.notifications.add(third.id);
    await notifications.markRead(me, third!.id);
    const skip = await digests.sendDueDigests(new Date(Date.now() + 26 * 3600_000), transport, [A.id]);
    check('a notice read in the app is not sent again', skip.skippedRead >= 1 && skip.emails === 0, skip);
    const skipped = await prisma.notificationDelivery.findMany({ where: { notificationId: third!.id, status: DeliveryStatus.SKIPPED } });
    check('...it is marked skipped, not failed', skipped.length === 2, skipped.length);

    // ───────────── Choosing immediate releases what is held ─────────────
    const reel4 = randomUUID();
    const e4 = like(Cc.id, reel4);
    await notifications.fanOut(e4);
    const fourth = await prisma.notification.findFirst({ where: { domainEventId: e4.id } });
    if (fourth) created.notifications.add(fourth.id);
    await notifications.setDigest(me, C.SOCIAL, D.IMMEDIATE);
    const flushed = await digests.sendDueDigests(new Date(), transport, [A.id]);
    check('switching to immediate sends what was held', flushed.emails === 1 && flushed.pushes === 1, flushed);
    const reel5 = randomUUID();
    const e5 = like(Dd.id, reel5);
    await notifications.fanOut(e5);
    const fifth = await prisma.notification.findFirst({ where: { domainEventId: e5.id }, include: { deliveries: true } });
    if (fifth) created.notifications.add(fifth.id);
    check('and from then on it is sent at once', fifth?.deliveryPolicy === 'immediate' && fifth.deliveries.some((d) => d.channel === 'EMAIL' && d.status === 'SENT'), fifth?.deliveries);
    freshEmails();
    pushed.length = 0;

    // ───────────── A reminder is never held, whatever was chosen ─────────────
    const run = await prisma.run.findFirst({
      where: {
        status: { in: ['SCHEDULED', 'PLANNING', 'TRAIL_HIDDEN', 'TRAIL_RELEASED', 'CHECK_IN_OPEN'] },
        participations: { some: { rsvpStatus: 'GOING', userId: { not: null } } },
        startsAt: { gt: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, kennelId: true, runNumber: true, startsAt: true, createdAt: true, participations: { where: { rsvpStatus: 'GOING', userId: { not: null } }, select: { userId: true }, take: 1 } },
    });
    if (run) {
      const goer = run.participations[0].userId!;
      const digestRow = await prisma.notificationDigestPreference.create({ data: { userId: goer, category: C.REMINDER, frequency: D.WEEKLY } });
      const mailPref = await prisma.notificationPreference.create({ data: { userId: goer, category: C.REMINDER, channel: DeliveryChannel.EMAIL, enabled: true } });
      try {
        const before = freshEmails().length;
        const reminder = {
          id: randomUUID(),
          eventType: 'RunReminderIssued',
          aggregateType: 'Run',
          aggregateId: run.id,
          actorId: null,
          actorType: 'SYSTEM',
          occurredAt: new Date(),
          payload: { kennelId: run.kennelId, runNumber: run.runNumber, stage: 'day-before', startsAt: run.startsAt.toISOString() },
        } as any;
        await notifications.fanOut(reminder);
        const got = await prisma.notification.findFirst({ where: { domainEventId: reminder.id, recipientUserId: goer }, include: { deliveries: true } });
        if (got) created.notifications.add(got.id);
        check('a run reminder reaches the person who said they were coming', Boolean(got) && got!.category === 'REMINDER', got?.title);
        check('...and is immediate even though they chose a weekly digest', got?.deliveryPolicy === 'immediate' && !got.deliveries.some((d) => d.status === 'HELD'), got?.deliveries);
        check('...the email went out now', sentEmails.some((m) => /is (in about|tomorrow)/.test(m.subject)) && before === 0);
        // Everyone else who said GOING got one too, and nothing was queued for them.
        const all = await prisma.notification.findMany({ where: { domainEventId: reminder.id } });
        all.forEach((n) => created.notifications.add(n.id));
        check('...as did the rest of the people who said they were coming', all.length >= 1);
      } finally {
        await prisma.notificationDigestPreference.delete({ where: { id: digestRow.id } });
        await prisma.notificationPreference.delete({ where: { id: mailPref.id } });
      }

      // ───────────── The day-before ladder ─────────────
      const target = run.id;
      const at = new Date(run.startsAt.getTime() - 10 * 3600_000);
      const notYet = await escalation.remindUpcomingRuns(new Date(run.startsAt.getTime() - 48 * 3600_000), target);
      check('48 hours ahead is too early to remind', notYet.issued === 0, notYet);
      const r1 = await escalation.remindUpcomingRuns(at, target);
      check('inside the last day the run is reminded, once', r1.issued === 1 || (r1.checked === 0 && run.createdAt > new Date(at.getTime() - 2 * 3600_000)), r1);
      const r2 = await escalation.remindUpcomingRuns(at, target);
      check('...and not again', r2.issued === 0, r2);
      const evts = await prisma.domainEvent.findMany({ where: { aggregateId: run.id, eventType: 'RunReminderIssued' }, select: { id: true } });
      evts.forEach((e) => created.events.add(e.id));
      await prisma.domainEvent.updateMany({ where: { id: { in: evts.map((e) => e.id) } }, data: { publishedAt: new Date() } });
    }

    // ───────────── Escalation: a membership request nobody answered ─────────────
    const kennel = await prisma.kennel.findFirst({
      where: { status: 'ACTIVE', visibility: 'PUBLIC', roleAssignments: { some: { role: 'KENNEL_ADMIN', status: 'ACTIVE' } } },
      select: { id: true },
    });
    const applicant = await prisma.user.findFirst({
      where: { email: { startsWith: 'member' }, status: 'ACTIVE', memberships: { none: { kennelId: kennel!.id } } },
      select: { id: true },
    });
    const DAY = 86_400_000;
    const asked = await prisma.membership.create({
      data: { userId: applicant!.id, kennelId: kennel!.id, status: 'PENDING_REVIEW', createdAt: new Date(Date.now() - 4 * DAY) },
    });
    try {
      const wait = await escalation.escalateMembershipRequests(new Date(), asked.id);
      check('a request 4 days old gets one reminder', wait.issued === 1, wait);
      const again2 = await escalation.escalateMembershipRequests(new Date(), asked.id);
      check('...and only one', again2.issued === 0, again2);
      let ev = await prisma.domainEvent.findFirst({ where: { aggregateId: asked.id, eventType: 'MembershipRequestReminderIssued' } });
      check('...recorded as a system event, never a person or an AI', ev?.actorId === null && ev?.actorType === 'SYSTEM', ev);
      check('...at the waiting step', (ev?.payload as any)?.stage === 'waiting');
      await prisma.domainEvent.update({ where: { id: ev!.id }, data: { publishedAt: new Date() } });
      created.events.add(ev!.id);
      await notifications.fanOut(ev as any);
      const waitingNotes = await prisma.notification.findMany({ where: { domainEventId: ev!.id } });
      waitingNotes.forEach((n) => created.notifications.add(n.id));
      check('the first step goes to the reviewing officers, at normal priority', waitingNotes.length >= 1 && waitingNotes.every((n) => n.priority === 'NORMAL'), waitingNotes.map((n) => n.priority));

      // A week on: one escalation, wider, HIGH.
      const week = await escalation.escalateMembershipRequests(new Date(Date.now() + 4 * DAY), asked.id);
      check('at a week it escalates', week.issued === 1, week);
      const esc = await prisma.domainEvent.findFirst({ where: { aggregateId: asked.id, eventType: 'MembershipRequestReminderIssued', payload: { path: ['stage'], equals: 'escalated' } } });
      await prisma.domainEvent.update({ where: { id: esc!.id }, data: { publishedAt: new Date() } });
      created.events.add(esc!.id);
      await notifications.fanOut(esc as any);
      const escNotes = await prisma.notification.findMany({ where: { domainEventId: esc!.id } });
      escNotes.forEach((n) => created.notifications.add(n.id));
      check('...at HIGH priority', escNotes.length >= 1 && escNotes.every((n) => n.priority === 'HIGH'), escNotes.map((n) => n.priority));
      check('...but never CRITICAL, so quiet hours still hold', escNotes.every((n) => n.priority !== 'CRITICAL'));
      const after = await escalation.escalateMembershipRequests(new Date(Date.now() + 30 * DAY), asked.id);
      check('there is no step after the last, however late', after.issued === 0, after);
      const total = await prisma.domainEvent.count({ where: { aggregateId: asked.id, eventType: 'MembershipRequestReminderIssued' } });
      check('two messages in all, ever', total === 2, total);
      const back = await escalation.escalateMembershipRequests(new Date(Date.now() + 4 * DAY), asked.id);
      check('it never steps back down', back.issued === 0, back);
    } finally {
      await prisma.domainEvent.deleteMany({ where: { aggregateId: asked.id } });
      await prisma.membership.delete({ where: { id: asked.id } });
    }

    // ───────────── Escalation: a run with no trail report ─────────────
    const late = await prisma.run.findFirst({
      where: {
        status: { in: ['REPORTING', 'ARCHIVED'] },
        endedAt: { not: null },
        OR: [{ trailReport: { is: null } }, { trailReport: { status: { notIn: ['PUBLISHED', 'ARCHIVED'] } } }],
      },
      select: { id: true, endedAt: true },
    });
    if (late) {
      const base = late.endedAt!.getTime();
      const tooSoon = await escalation.escalateOverdueReports(new Date(base + 2 * DAY), late.id);
      check('a report two days late is not yet worth a message', tooSoon.issued === 0, tooSoon);
      const overdue = await escalation.escalateOverdueReports(new Date(base + 6 * DAY), late.id);
      check('five days late: one nudge', overdue.issued === 1, overdue);
      const dup = await escalation.escalateOverdueReports(new Date(base + 6 * DAY), late.id);
      check('...once', dup.issued === 0, dup);
      const wide = await escalation.escalateOverdueReports(new Date(base + 13 * DAY), late.id);
      check('twelve days late: one escalation', wide.issued === 1, wide);
      const none = await escalation.escalateOverdueReports(new Date(base + 40 * DAY), late.id);
      check('and then no more', none.issued === 0, none);
      const old = await escalation.escalateOverdueReports(new Date(base + 90 * DAY), late.id);
      check('a run long past is history, not a reminder', old.checked === 0, old);
      const reportEvents = await prisma.domainEvent.findMany({ where: { aggregateId: late.id, eventType: 'TrailReportReminderIssued' } });
      check('exactly two reminders over the whole life of a late report', reportEvents.length === 2, reportEvents.length);
      reportEvents.forEach((e) => created.events.add(e.id));
      await prisma.domainEvent.updateMany({ where: { id: { in: reportEvents.map((e) => e.id) } }, data: { publishedAt: new Date() } });
      for (const e of reportEvents) {
        await notifications.fanOut(e as any);
        const rows = await prisma.notification.findMany({ where: { domainEventId: e.id } });
        rows.forEach((n) => created.notifications.add(n.id));
        const stage = (e.payload as any).stage;
        check(`the ${stage} report step reaches somebody who can do something about it`, rows.length >= 1, rows.length);
        check(`...at ${stage === 'escalated' ? 'HIGH' : 'NORMAL'} priority`, rows.every((n) => n.priority === (stage === 'escalated' ? 'HIGH' : 'NORMAL')));
      }
    } else {
      console.log('  (skipped the report ladder: no unpublished report on an ended run in the seed)');
    }
  } finally {
    // ── Put everything back ──
    await notifications.setQuietHours(me, null).catch(() => undefined);
    await prisma.notificationDigestPreference.deleteMany({ where: { userId: A.id } });
    await prisma.notificationPreference.deleteMany({ where: { id: { in: prefIds } } });
    await prisma.pushDevice.delete({ where: { id: device.id } }).catch(() => undefined);
    await prisma.user.update({ where: { id: A.id }, data: { timeZone: oldZone } });
    await prisma.notification.deleteMany({ where: { OR: [{ id: { in: [...created.notifications] } }, { recipientUserId: A.id, groupKey: { not: null } }] } });
    await prisma.domainEvent.deleteMany({ where: { id: { in: [...created.events] } } });
  }

  console.log(`digest-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
