import { AccountStatus, CheckInMethod, KennelVisibility, Prisma, RsvpStatus, RunVisibility } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import type { Actor } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import {
  CHECK_IN_STATES,
  CORRECTION_STATES,
  RSVP_OPEN,
  type RunAccess,
  canOperate,
  operateSource,
  operatorAccess,
  rsvpWindowCheck,
  statusWords,
  viewableAccess,
  visitorCheck,
} from './run.service';

// RSVPs, guests and check-in (D23). Attendance changes are audited; RSVPs are
// recorded as events only.

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

async function assertAccountActive(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, homeKennelId: true } });
  if (!user || user.status !== AccountStatus.ACTIVE) {
    throw ApiError.forbidden('Your account must be active to take part in runs.', 'ACCOUNT_NOT_ACTIVE');
  }
  return user;
}

function assertCheck(check: { ok: true } | { ok: false; code: string; message: string }) {
  if (check.ok) return;
  if (check.code === 'MEMBERS_ONLY' || check.code === 'MEMBERSHIP_SUSPENDED') {
    throw ApiError.forbidden(check.message, check.code);
  }
  throw ApiError.conflict(check.message, check.code);
}

// D1: no waitlist. Capacity counts GOING hashers and guests.
async function assertCapacity(tx: Prisma.TransactionClient, a: RunAccess, exclude: Prisma.ParticipationWhereInput = {}) {
  if (!a.run.capacity) return;
  const going = await tx.participation.count({ where: { runId: a.run.id, rsvpStatus: RsvpStatus.GOING, NOT: exclude } });
  if (going >= a.run.capacity) throw ApiError.conflict('This run is full.', 'RUN_FULL');
}

// ─── RSVP (FR-RUNPLAN-007) ───

export async function setRsvp(actor: Actor, runId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') {
  const a = await viewableAccess(actor, runId);
  assertCheck(rsvpWindowCheck(a));
  assertCheck(visitorCheck(a));
  if (a.participation?.checkedInAt) throw ApiError.conflict('You are already checked in.', 'ALREADY_CHECKED_IN');
  const user = await assertAccountActive(actor.id);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.participation.findUnique({ where: { runId_userId: { runId, userId: actor.id } } });
    if (existing?.checkedInAt) throw ApiError.conflict('You are already checked in.', 'ALREADY_CHECKED_IN');
    if (status === RsvpStatus.GOING && existing?.rsvpStatus !== RsvpStatus.GOING) {
      await assertCapacity(tx, a, { userId: actor.id });
    }

    const participation = existing
      ? await tx.participation.update({ where: { id: existing.id }, data: { rsvpStatus: status } })
      : await tx.participation.create({
          data: {
            runId,
            userId: actor.id,
            rsvpStatus: status,
            // BR-RUN-009: visitor status and home kennel are snapshotted now.
            isVisitor: !a.isMember,
            homeKennelId: user.homeKennelId,
          },
        });

    await recordEvent(tx, {
      eventType: 'RunRsvpChanged',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: {
        participationId: participation.id,
        userId: actor.id,
        fromStatus: existing?.rsvpStatus ?? null,
        toStatus: status,
        isVisitor: participation.isVisitor,
      },
    });
  }, serializable);
}

export async function withdrawRsvp(actor: Actor, runId: string) {
  const a = await viewableAccess(actor, runId);
  assertCheck(rsvpWindowCheck(a));
  if (!a.participation || a.participation.rsvpStatus === RsvpStatus.CANCELLED) {
    throw ApiError.conflict("You haven't RSVP'd to this run.", 'NO_RSVP');
  }
  if (a.participation.checkedInAt) throw ApiError.conflict('You are already checked in.', 'ALREADY_CHECKED_IN');

  await prisma.$transaction(async (tx) => {
    await tx.participation.update({ where: { id: a.participation!.id }, data: { rsvpStatus: RsvpStatus.CANCELLED } });
    await recordEvent(tx, {
      eventType: 'RunRsvpChanged',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: {
        participationId: a.participation!.id,
        userId: actor.id,
        fromStatus: a.participation!.rsvpStatus,
        toStatus: RsvpStatus.CANCELLED,
      },
    });
  });
}

// ─── Guests (D2, D23) ───

export interface GuestInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  consent: true;
  checkIn: boolean;
}

export async function registerGuest(actor: Actor | undefined, runId: string, input: GuestInput) {
  const a = await viewableAccess(actor, runId);
  const officer = canOperate(a);

  if (officer) {
    if (![...RSVP_OPEN, ...CORRECTION_STATES].includes(a.run.status)) {
      throw ApiError.conflict(`Guests can't be added while the run is ${statusWords[a.run.status]}.`, 'RSVP_CLOSED');
    }
  } else {
    if (actor) {
      throw ApiError.badRequest('You are logged in: RSVP as yourself instead.', 'SIGNED_IN_USE_RSVP');
    }
    if (a.run.visibility !== RunVisibility.PUBLIC || a.run.kennel.visibility === KennelVisibility.HIDDEN || !a.run.allowGuests) {
      throw ApiError.forbidden('This run is not open to guests.', 'GUESTS_NOT_ALLOWED');
    }
    assertCheck(rsvpWindowCheck(a));
  }

  const checkIn = officer && input.checkIn;
  if (input.checkIn && !checkIn) throw ApiError.forbidden('Only hares and officers check guests in.', 'RUN_ROLE_REQUIRED');
  if (checkIn && !CORRECTION_STATES.includes(a.run.status)) {
    throw ApiError.conflict('Check-in is not open for this run.', 'CHECK_IN_CLOSED');
  }

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Walk-ins checked in at the venue are never turned away for capacity.
    if (!checkIn) await assertCapacity(tx, a);

    let guest = await tx.guestProfile.findFirst({
      where: {
        claimedByUserId: null,
        email: { equals: email, mode: 'insensitive' },
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
    });
    if (!guest) {
      guest = await tx.guestProfile.create({
        data: { firstName, lastName, email, phone: input.phone?.trim() || null, consentAt: now },
      });
      await recordEvent(tx, {
        eventType: 'GuestRegistered',
        aggregateType: 'GuestProfile',
        aggregateId: guest.id,
        actorId: actor?.id ?? null,
        payload: { runId },
      });
    }

    const existing = await tx.participation.findUnique({ where: { runId_guestId: { runId, guestId: guest.id } } });
    if (existing) throw ApiError.conflict('This guest is already registered for the run.', 'ALREADY_REGISTERED');

    const priorCheckIns = checkIn
      ? await tx.participation.count({ where: { guestId: guest.id, checkedInAt: { not: null } } })
      : 0;

    const participation = await tx.participation.create({
      data: {
        runId,
        guestId: guest.id,
        rsvpStatus: RsvpStatus.GOING,
        isVisitor: true,
        ...(checkIn
          ? { checkInMethod: CheckInMethod.OFFICER, checkedInAt: now, checkedInById: actor!.id, isVirginRun: priorCheckIns === 0 }
          : {}),
      },
    });

    await recordEvent(tx, {
      eventType: 'RunRsvpChanged',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor?.id ?? null,
      payload: { participationId: participation.id, guestId: guest.id, fromStatus: null, toStatus: RsvpStatus.GOING },
    });
    if (checkIn) {
      const event = await recordEvent(tx, {
        eventType: 'ParticipantCheckedIn',
        aggregateType: 'Run',
        aggregateId: runId,
        actorId: actor!.id,
        payload: { participationId: participation.id, guestId: guest.id, method: CheckInMethod.OFFICER },
      });
      await recordAudit(tx, {
        actorId: actor!.id,
        action: 'attendance.check_in',
        resourceType: 'Participation',
        resourceId: participation.id,
        kennelId: a.run.kennelId,
        newState: { checkedIn: true, method: CheckInMethod.OFFICER, guest: true },
        policyRef: operateSource(a),
        domainEventId: event.id,
      });
    }

    return { participationId: participation.id, displayName: `${guest.firstName} (guest)` };
  }, serializable);
}

// ─── Check-in (FR-RUN-008, FR-RUNDAY-001) ───

export async function checkInSelf(actor: Actor, runId: string) {
  const a = await viewableAccess(actor, runId);
  if (!CHECK_IN_STATES.includes(a.run.status)) {
    throw ApiError.conflict('Check-in is not open for this run.', 'CHECK_IN_CLOSED');
  }
  assertCheck(visitorCheck(a));
  if (a.participation?.checkedInAt) return;
  const user = await assertAccountActive(actor.id);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const priorCheckIns = await tx.participation.count({
      where: { userId: actor.id, checkedInAt: { not: null }, NOT: { runId } },
    });
    const checkInData = {
      rsvpStatus: RsvpStatus.GOING,
      checkInMethod: CheckInMethod.MANUAL,
      checkedInAt: now,
      checkedInById: actor.id,
      isVirginRun: priorCheckIns === 0,
    };
    const participation = a.participation
      ? await tx.participation.update({ where: { id: a.participation.id }, data: checkInData })
      : await tx.participation.create({
          data: { runId, userId: actor.id, isVisitor: !a.isMember, homeKennelId: user.homeKennelId, ...checkInData },
        });

    const event = await recordEvent(tx, {
      eventType: 'ParticipantCheckedIn',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: {
        participationId: participation.id,
        userId: actor.id,
        method: CheckInMethod.MANUAL,
        isVisitor: participation.isVisitor,
        isVirginRun: participation.isVirginRun,
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'attendance.check_in',
      resourceType: 'Participation',
      resourceId: participation.id,
      kennelId: a.run.kennelId,
      newState: { checkedIn: true, method: CheckInMethod.MANUAL },
      policyRef: 'self',
      domainEventId: event.id,
    });
  });
}

async function participationInRun(runId: string, participationId: string) {
  if (!isUuid(participationId)) throw ApiError.notFound('Participant not found');
  const participation = await prisma.participation.findFirst({ where: { id: participationId, runId } });
  if (!participation) throw ApiError.notFound('Participant not found');
  return participation;
}

export async function checkInParticipant(actor: Actor, runId: string, participationId: string) {
  const a = await operatorAccess(actor, runId);
  if (!CORRECTION_STATES.includes(a.run.status)) {
    throw ApiError.conflict('Check-in is not open for this run.', 'CHECK_IN_CLOSED');
  }
  const p = await participationInRun(runId, participationId);
  if (p.checkedInAt) return;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const priorCheckIns = await tx.participation.count({
      where: {
        ...(p.userId ? { userId: p.userId } : { guestId: p.guestId }),
        checkedInAt: { not: null },
        NOT: { runId },
      },
    });
    await tx.participation.update({
      where: { id: p.id },
      data: {
        rsvpStatus: RsvpStatus.GOING,
        checkInMethod: CheckInMethod.OFFICER,
        checkedInAt: now,
        checkedInById: actor.id,
        isVirginRun: priorCheckIns === 0,
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'ParticipantCheckedIn',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { participationId: p.id, userId: p.userId, guestId: p.guestId, method: CheckInMethod.OFFICER },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'attendance.check_in',
      resourceType: 'Participation',
      resourceId: p.id,
      kennelId: a.run.kennelId,
      previousState: { checkedIn: false },
      newState: { checkedIn: true, method: CheckInMethod.OFFICER },
      policyRef: operateSource(a),
      domainEventId: event.id,
    });
  });
}

export async function revertCheckIn(actor: Actor, runId: string, participationId: string, reason?: string | null) {
  const a = await operatorAccess(actor, runId);
  if (!CORRECTION_STATES.includes(a.run.status)) {
    throw ApiError.conflict(`Attendance can't be changed while the run is ${statusWords[a.run.status]}.`, 'ATTENDANCE_LOCKED');
  }
  const p = await participationInRun(runId, participationId);
  const checkedInAt = p.checkedInAt;
  if (!checkedInAt) throw ApiError.conflict('This participant is not checked in.', 'NOT_CHECKED_IN');
  const note = reason?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.participation.update({
      where: { id: p.id },
      data: { checkInMethod: null, checkedInAt: null, checkedInById: null, isVirginRun: false },
    });
    const event = await recordEvent(tx, {
      eventType: 'ParticipantCheckInReverted',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { participationId: p.id, userId: p.userId, guestId: p.guestId, ...(note ? { reason: note } : {}) },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'attendance.check_in_revert',
      resourceType: 'Participation',
      resourceId: p.id,
      kennelId: a.run.kennelId,
      previousState: { checkedIn: true, method: p.checkInMethod, checkedInAt: checkedInAt.toISOString() },
      newState: { checkedIn: false },
      reason: note,
      policyRef: operateSource(a),
      domainEventId: event.id,
    });
  });
}

// D2 follow-up (D23's guest identity). Called from verification.service.ts at
// the one moment we can be sure someone owns an email address: after they
// have proven it, never at registration itself, or claiming would be a way
// to read a stranger's run history by registering with their address.
//
// A GuestProfile match alone links the guest record; each of its
// Participation rows only moves to the new account if that run has no row of
// the hasher's own already — the `[runId, userId]` unique constraint would
// reject a collision anyway, and a run they attended once as a guest and
// once as a member later is not a case this silently picks a winner for.
export async function claimGuestHistory(tx: Prisma.TransactionClient, user: { id: string; email: string }) {
  const guests = await tx.guestProfile.findMany({
    where: { claimedByUserId: null, email: { equals: user.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (guests.length === 0) return { guestsClaimed: 0, participationsMoved: 0 };

  const now = new Date();
  let participationsMoved = 0;

  for (const guest of guests) {
    await tx.guestProfile.update({ where: { id: guest.id }, data: { claimedByUserId: user.id, claimedAt: now } });

    const participations = await tx.participation.findMany({
      where: { guestId: guest.id },
      select: { id: true, runId: true },
    });
    for (const p of participations) {
      const existing = await tx.participation.findUnique({
        where: { runId_userId: { runId: p.runId, userId: user.id } },
      });
      if (existing) continue;
      await tx.participation.update({ where: { id: p.id }, data: { userId: user.id } });
      participationsMoved++;
    }

    const event = await recordEvent(tx, {
      eventType: 'GuestProfileClaimed',
      aggregateType: 'GuestProfile',
      aggregateId: guest.id,
      actorId: user.id,
      payload: { userId: user.id },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'guest.claim',
      resourceType: 'GuestProfile',
      resourceId: guest.id,
      newState: { claimedByUserId: user.id },
      policyRef: 'self',
      domainEventId: event.id,
    });
  }

  return { guestsClaimed: guests.length, participationsMoved };
}
