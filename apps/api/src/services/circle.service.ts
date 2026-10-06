import { MembershipStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import type { Actor } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { CIRCLE_STATES, operateSource, operatorAccess, publicName, userPublicSelect } from './run.service';

// Annex 08E-04: Shiggy Trails documents the Circle, it does not run it. Hares and officers
// with run.manage record songs, announcements, notes and awards while the run
// is in the Circle or Reporting phase.

async function circleAccess(actor: Actor, runId: string) {
  const a = await operatorAccess(actor, runId);
  if (!CIRCLE_STATES.includes(a.run.status)) {
    throw ApiError.conflict('The Circle record opens when the run ends and closes at archive.', 'CIRCLE_NOT_OPEN');
  }
  return a;
}

export async function updateCircle(
  actor: Actor,
  runId: string,
  input: { songs?: string[]; announcements?: string | null; notes?: string | null },
) {
  await circleAccess(actor, runId);
  const data = {
    ...(input.songs !== undefined ? { songs: input.songs.map((s) => s.trim()).filter(Boolean) } : {}),
    ...(input.announcements !== undefined ? { announcements: input.announcements?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  };

  await prisma.$transaction(async (tx) => {
    await tx.circle.upsert({ where: { runId }, create: { runId, ...data }, update: data });
    await recordEvent(tx, {
      eventType: 'CircleRecordUpdated',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { fields: Object.keys(data) },
    });
  });
}

// FR-CIRCLE-006/008: awards and down-downs, never ranked.
export async function addAward(
  actor: Actor,
  runId: string,
  input: { title: string; reason?: string | null; isDownDown: boolean; participationId?: string; recipientName?: string },
) {
  const a = await circleAccess(actor, runId);

  if (input.isDownDown) {
    const kennel = await prisma.kennel.findUnique({ where: { id: a.run.kennelId }, select: { downDownsEnabled: true } });
    if (kennel && !kennel.downDownsEnabled) {
      throw ApiError.badRequest('This kennel has switched off down-downs (FR-CIRCLE-006).', 'DOWN_DOWNS_DISABLED');
    }
  }

  let recipient: { recipientUserId?: string | null; recipientGuestId?: string | null; recipientName?: string | null } = {
    recipientName: input.recipientName?.trim() || null,
  };
  if (input.participationId) {
    const p = await prisma.participation.findFirst({
      where: { id: input.participationId, runId },
      select: { userId: true, guestId: true },
    });
    if (!p) throw ApiError.badRequest('Awards go to someone who took part in this run.', 'RECIPIENT_NOT_PARTICIPANT');
    recipient = { recipientUserId: p.userId, recipientGuestId: p.guestId, recipientName: null };
  }

  await prisma.$transaction(async (tx) => {
    const circle = await tx.circle.upsert({ where: { runId }, create: { runId }, update: {} });
    const award = await tx.award.create({
      data: {
        circleId: circle.id,
        title: input.title.trim(),
        reason: input.reason?.trim() || null,
        isDownDown: input.isDownDown,
        awardedById: actor.id,
        ...recipient,
      },
    });
    await recordEvent(tx, {
      eventType: 'AwardRecorded',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: {
        awardId: award.id,
        title: award.title,
        isDownDown: award.isDownDown,
        recipientUserId: award.recipientUserId,
        recipientGuestId: award.recipientGuestId,
      },
    });
  });
}

// Corrections before archive only; the removal is audited.
export async function removeAward(actor: Actor, runId: string, awardId: string) {
  const a = await circleAccess(actor, runId);
  if (!isUuid(awardId)) throw ApiError.notFound('Award not found');
  const award = await prisma.award.findFirst({
    where: { id: awardId, circle: { runId } },
    include: { recipientUser: { select: userPublicSelect }, recipientGuest: { select: { firstName: true } } },
  });
  if (!award) throw ApiError.notFound('Award not found');

  const recipient = award.recipientUser
    ? publicName(award.recipientUser)
    : award.recipientGuest
      ? `${award.recipientGuest.firstName} (guest)`
      : award.recipientName;

  await prisma.$transaction(async (tx) => {
    await tx.award.delete({ where: { id: award.id } });
    const event = await recordEvent(tx, {
      eventType: 'AwardRemoved',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { awardId: award.id, title: award.title },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'circle.award_remove',
      resourceType: 'Award',
      resourceId: award.id,
      kennelId: a.run.kennelId,
      previousState: { title: award.title, reason: award.reason, isDownDown: award.isDownDown, recipient },
      policyRef: operateSource(a),
      domainEventId: event.id,
    });
  });
}

// FR-CIRCLE-002: who was at the Circle, kept apart from who ran the trail. A
// hare can start from the trail's check-ins (the usual case: most of the pack
// stays) and then correct it, because some leave early and some arrive for the
// Circle alone. Adding someone twice is not an error.
export async function recordAttendance(
  actor: Actor,
  runId: string,
  input: { participationIds?: string[]; userIds?: string[]; fromTrail?: boolean },
) {
  const a = await circleAccess(actor, runId);

  const targets = new Map<string, { userId: string | null; guestId: string | null }>();
  const add = (userId: string | null, guestId: string | null) => {
    if (userId || guestId) targets.set(`${userId ?? ''}|${guestId ?? ''}`, { userId, guestId });
  };

  if (input.fromTrail) {
    const present = await prisma.participation.findMany({
      where: { runId, checkedInAt: { not: null } },
      select: { userId: true, guestId: true },
    });
    present.forEach((p) => add(p.userId, p.guestId));
  }

  if (input.participationIds?.length) {
    const rows = await prisma.participation.findMany({
      where: { runId, id: { in: input.participationIds } },
      select: { userId: true, guestId: true },
    });
    if (rows.length !== new Set(input.participationIds).size) {
      throw ApiError.badRequest('Some of those people are not on this run.', 'NOT_ON_RUN');
    }
    rows.forEach((p) => add(p.userId, p.guestId));
  }

  if (input.userIds?.length) {
    // Someone who came for the Circle alone has no Participation, so a member of
    // the hosting kennel is enough.
    const wanted = [...new Set(input.userIds)];
    const known = await prisma.user.findMany({
      where: {
        id: { in: wanted },
        OR: [
          { participations: { some: { runId } } },
          { memberships: { some: { kennelId: a.run.kennelId, status: MembershipStatus.ACTIVE } } },
        ],
      },
      select: { id: true },
    });
    if (known.length !== wanted.length) {
      throw ApiError.badRequest('Some of those people are neither on this run nor members of this kennel.', 'NOT_ON_RUN');
    }
    known.forEach((u) => add(u.id, null));
  }

  if (targets.size === 0) throw ApiError.badRequest('Choose who was at the Circle.', 'NOBODY_CHOSEN');

  await prisma.$transaction(async (tx) => {
    const circle = await tx.circle.upsert({ where: { runId }, create: { runId }, update: {} });
    let added = 0;
    for (const t of targets.values()) {
      const exists = await tx.circleAttendee.findFirst({
        where: { circleId: circle.id, ...(t.userId ? { userId: t.userId } : { guestId: t.guestId }) },
        select: { id: true },
      });
      if (exists) continue;
      await tx.circleAttendee.create({
        data: { circleId: circle.id, userId: t.userId, guestId: t.guestId, recordedById: actor.id },
      });
      added += 1;
    }
    if (added === 0) return;
    await recordEvent(tx, {
      eventType: 'CircleAttendanceRecorded',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { added, total: await tx.circleAttendee.count({ where: { circleId: circle.id } }) },
    });
  });
}

// A correction: they left before the Circle, or were put down by mistake.
export async function removeAttendee(actor: Actor, runId: string, attendeeId: string) {
  const a = await circleAccess(actor, runId);
  if (!isUuid(attendeeId)) throw ApiError.notFound('Attendee not found');
  const row = await prisma.circleAttendee.findFirst({
    where: { id: attendeeId, circle: { runId } },
    select: { id: true, userId: true, guestId: true },
  });
  if (!row) throw ApiError.notFound('Attendee not found');

  await prisma.$transaction(async (tx) => {
    await tx.circleAttendee.delete({ where: { id: row.id } });
    const event = await recordEvent(tx, {
      eventType: 'CircleAttendanceRemoved',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { attendeeId: row.id, userId: row.userId, guestId: row.guestId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'circle.attendance_remove',
      resourceType: 'CircleAttendee',
      resourceId: row.id,
      kennelId: a.run.kennelId,
      previousState: { userId: row.userId, guestId: row.guestId },
      policyRef: operateSource(a),
      domainEventId: event.id,
    });
  });
}
