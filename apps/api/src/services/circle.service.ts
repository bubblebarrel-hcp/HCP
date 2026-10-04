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
