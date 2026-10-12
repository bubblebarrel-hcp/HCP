import { AppealStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { verifyCredentials } from './auth.service';
import { confirm, holdFor, lift } from './enforcement.service';
import { recordAudit, recordEvent } from './record.service';

// A held hasher's answer back (D75).
//
// They cannot sign in, so there is no session to ask with: they prove who they are
// with their email and password, as they would to sign in, and that is the whole
// of it. The route sits under /auth, which is already rate limited. It tells
// somebody nothing about an account they cannot already open: a wrong password is
// the same answer as at the login.
//
// One appeal per hold. Granting it lifts the hold (the same lift staff can do from
// the list); denying it keeps the hold and tells them why, in words a person wrote.
// Nobody is asked to say who reported them, and is never told.

const MIN = 10;
const MAX = 1000;

/** What a held hasher can see about their own hold and appeal. */
export async function stateFor(email: string, password: string) {
  const user = await verifyCredentials(email, password);
  const hold = await holdFor(user.id);
  return {
    held: Boolean(hold),
    level: hold?.level ?? null,
    endsAt: hold?.endsAt ?? null,
    // A person has looked at the reports and the hold stands.
    reviewed: Boolean(hold?.confirmedAt),
    canAppeal: Boolean(hold) && !hold?.appeal,
    appeal: hold?.appeal
      ? {
          status: hold.appeal.status,
          message: hold.appeal.message,
          decisionNote: hold.appeal.decisionNote,
          createdAt: hold.appeal.createdAt,
          decidedAt: hold.appeal.decidedAt,
        }
      : null,
  };
}

export async function file(email: string, password: string, rawMessage: string) {
  const user = await verifyCredentials(email, password);
  const message = rawMessage.replace(/\s+/g, ' ').trim();
  if (message.length < MIN) throw ApiError.badRequest(`Tell us a little more (at least ${MIN} characters).`, 'APPEAL_TOO_SHORT');
  if (message.length > MAX) throw ApiError.badRequest(`Keep it under ${MAX} characters.`, 'APPEAL_TOO_LONG');

  const hold = await prisma.autoEnforcement.findFirst({
    where: { userId: user.id, level: { in: ['HOLD', 'REVIEW_HOLD'] }, liftedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, level: true, appeal: { select: { id: true } } },
  });
  if (!hold) throw ApiError.badRequest('There is nothing on this account to appeal.', 'NO_HOLD');
  if (hold.appeal) throw ApiError.conflict('You have already appealed this. A moderator has it.', 'ALREADY_APPEALED');

  const appeal = await prisma.$transaction(async (tx) => {
    const created = await tx.enforcementAppeal.create({ data: { enforcementId: hold.id, userId: user.id, message } });
    const event = await recordEvent(tx, {
      eventType: 'EnforcementAppealFiled',
      aggregateType: 'Identity',
      aggregateId: user.id,
      actorId: user.id,
      // Ids and a level: what they wrote is for the staff who open it.
      payload: { appealId: created.id, enforcementId: hold.id, level: hold.level },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'user.auto.appeal',
      resourceType: 'Identity',
      resourceId: user.id,
      newState: { appealId: created.id, enforcementId: hold.id },
      policyRef: 'D75',
      domainEventId: event.id,
    });
    return created;
  });
  return { id: appeal.id, status: appeal.status };
}

/**
 * Staff answer it. Granting lifts the hold and tells the hasher; denying keeps the
 * hold (it becomes theirs, so no timer lifts it) and needs words the hasher will
 * read.
 */
export async function decide(appealId: string, by: { id: string }, outcome: 'GRANT' | 'DENY', note?: string | null) {
  if (!isUuid(appealId)) throw ApiError.notFound('Not found');
  const appeal = await prisma.enforcementAppeal.findUnique({ where: { id: appealId } });
  if (!appeal) throw ApiError.notFound('Not found');
  if (appeal.status !== AppealStatus.OPEN) throw ApiError.conflict('That appeal has already been decided.', 'ALREADY_DECIDED');

  if (outcome === 'GRANT') await lift(appeal.enforcementId, by, note);
  else await confirm(appeal.enforcementId, by, note);

  return prisma.enforcementAppeal.findUniqueOrThrow({ where: { id: appealId } });
}
