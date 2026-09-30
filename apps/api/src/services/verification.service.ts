import { TrustLevel } from '@prisma/client';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import { hashToken, randomToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { claimGuestHistory } from './attendance.service';
import { isEmailConfigured, sendEmail } from './email.service';
import { recordAudit, recordEvent } from './record.service';

// FR-AUTH-002. An account is not usable until its address is confirmed (D31),
// so this is the one thing standing between registering and getting in.
//
// The token is random, stored only as a SHA-256 hash, and single-use: what
// arrives in the inbox is never what sits in the database.

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// A resend button people will press twice.
const RESEND_INTERVAL_MS = 60 * 1000;

function link(token: string) {
  return `/auth/verify?token=${token}`;
}

export async function issueVerification(user: { id: string; email: string }) {
  // One live token per person: asking again retires the previous link.
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = randomToken(32);
  await prisma.emailVerificationToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  // Outside production the link is logged as well as sent. Verification is a
  // hard gate, so a developer whose mail is not deliverable would otherwise be
  // locked out of their own machine.
  if (!env.isProduction) {
    logger.warn(`Verification link for ${user.email}: ${env.appBaseUrl}${link(token)}`);
  }

  const result = await sendEmail({
    to: user.email,
    subject: 'Confirm your email to join Shiggy Trails',
    body: 'Confirm your email to get started with Shiggy Trails. This link is valid for 24 hours; after that, request a fresh one from the sign-in page.',
    action: { label: 'Confirm my email', path: link(token) },
    template: 'signup-confirmation',
  });

  if (!result.sent && isEmailConfigured()) {
    logger.error('Verification email failed to send', { userId: user.id, error: result.error });
  }
  return result.sent;
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { email: true, emailVerifiedAt: true, trustLevel: true } },
    },
  });

  // A wrong, spent or expired link all say the same thing: ask for a new one.
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest(
      'That confirmation link is no longer valid. Ask for a fresh one from the sign-in page.',
      'INVALID_VERIFICATION_TOKEN',
    );
  }

  // Already confirmed: spend the token and say so, rather than fail.
  if (record.user.emailVerifiedAt) {
    await prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return { alreadyVerified: true };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: now,
        // Confirming an address only lifts the floor; it never demotes someone
        // a kennel or the platform has already vouched for.
        ...(record.user.trustLevel === TrustLevel.UNVERIFIED ? { trustLevel: TrustLevel.VERIFIED_EMAIL } : {}),
      },
    });
    await tx.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: now } });

    const event = await recordEvent(tx, {
      eventType: 'EmailVerified',
      aggregateType: 'Identity',
      aggregateId: record.userId,
      actorId: record.userId,
      payload: {},
    });
    await recordAudit(tx, {
      actorId: record.userId,
      action: 'identity.email.verify',
      resourceType: 'Identity',
      resourceId: record.userId,
      newState: { emailVerified: true },
      domainEventId: event.id,
    });

    // D2 follow-up: this is the first moment the address is provably theirs,
    // so it is the only safe moment to link a guest's run history to it —
    // never at registration, or claiming would just be a way to read a
    // stranger's history by typing their email in.
    await claimGuestHistory(tx, { id: record.userId, email: record.user.email });
  });

  return { alreadyVerified: false };
}

// Always answers the same way. Telling a stranger whether an address is
// registered is an account-enumeration gift.
export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return;

  const last = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_INTERVAL_MS) return;

  await issueVerification(user);
}
