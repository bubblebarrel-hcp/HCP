import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import { hashToken, randomToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { isEmailConfigured, sendEmail } from './email.service';
import { recordAudit, recordEvent } from './record.service';

// Same machinery as email verification (D31): a random token, stored only as
// a SHA-256 hash, single-use, and this endpoint never reveals whether the
// address is registered.

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const REQUEST_INTERVAL_MS = 60 * 1000;

function link(token: string) {
  return `/auth/reset-password?token=${token}`;
}

// Always resolves; never tells the caller whether the address exists.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return;

  const last = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < REQUEST_INTERVAL_MS) return;

  // One live token per person: asking again retires the previous link.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  if (!env.isProduction) {
    logger.warn(`Password reset link for ${user.email}: ${env.appBaseUrl}${link(token)}`);
  }

  const result = await sendEmail({
    to: user.email,
    subject: 'Reset your HCP password',
    body: 'Someone asked to reset the password on this account. This link is good for 1 hour. If it was not you, ignore this email and nothing will change.',
    action: { label: 'Reset my password', path: link(token) },
  });

  if (!result.sent && isEmailConfigured()) {
    logger.error('Password reset email failed to send', { userId: user.id, error: result.error });
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest(
      'That reset link is no longer valid. Ask for a fresh one from the sign-in page.',
      'INVALID_RESET_TOKEN',
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } });

    // A reset is the signature of a compromised or forgotten password either
    // way: every existing session ends so a stolen refresh token stops working.
    await tx.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    const event = await recordEvent(tx, {
      eventType: 'PasswordReset',
      aggregateType: 'Identity',
      aggregateId: record.userId,
      actorId: record.userId,
      payload: {},
    });
    await recordAudit(tx, {
      actorId: record.userId,
      action: 'identity.password.reset',
      resourceType: 'Identity',
      resourceId: record.userId,
      newState: { passwordReset: true },
      domainEventId: event.id,
    });
  });
}
