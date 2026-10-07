import bcrypt from 'bcryptjs';
import { AccountStatus, Gender, PlatformRole } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { serializeSessionUser, sessionUserSelect } from '../serializers/user';
import { encryptField } from '../utils/field-crypto';
import { allocateUsername } from './entity.service';
import { recordAudit, recordEvent } from './record.service';
import { issueVerification } from './verification.service';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Compared against when the email is unknown, so both login failure branches
// take the same time and the endpoint cannot enumerate accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

async function issueTokens(user: { id: string; platformRole: PlatformRole }) {
  const accessToken = signAccessToken(user.id, user.platformRole);
  const { token: refreshToken } = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

async function loadSessionUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: sessionUserSelect });
  if (!user) throw ApiError.unauthorized();
  return serializeSessionUser(user);
}

export interface RegisterInput {
  email: string;
  password: string;
  termsVersion?: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  hashHandle?: string | null;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine?: string | null;
  occupation?: string | null;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('That email is already registered', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const hashHandle = input.hashHandle?.trim() || null;

  // Identity, private biodata, Hash Passport (FR-PASSPORT-001) and the
  // IdentityCreated event commit together or not at all.
  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        hashHandle,
        // What they are @mentioned as (D59). Made from the handle when it can be,
        // and theirs to change afterwards.
        username: await allocateUsername(tx, hashHandle),
        termsAcceptedAt: new Date(),
        termsVersion: input.termsVersion ?? null,
        // The account exists but cannot be signed into until the address is
        // confirmed (D31). ACTIVE is about standing, not about verification:
        // emailVerifiedAt is what login checks.
        status: AccountStatus.ACTIVE,
        // FR-ID-005: the five most sensitive PersonProfile columns are
        // encrypted before they reach the database (utils/field-crypto.ts).
        person: {
          create: {
            firstName: input.firstName,
            middleName: input.middleName || null,
            lastName: input.lastName,
            dateOfBirth: encryptField(input.dateOfBirth.toISOString().slice(0, 10)),
            gender: input.gender,
            phone: encryptField(input.phone),
            nationality: input.nationality,
            country: input.country,
            stateProvince: input.stateProvince,
            city: input.city,
            addressLine: input.addressLine || null,
            occupation: input.occupation || null,
            languages: input.languages,
            emergencyContactName: encryptField(input.emergencyContactName),
            emergencyContactPhone: encryptField(input.emergencyContactPhone),
            emergencyContactRelationship: encryptField(input.emergencyContactRelationship),
          },
        },
        passport: { create: {} },
        ...(hashHandle ? { hashNames: { create: { name: hashHandle, isPrimary: true } } } : {}),
      },
    });

    const event = await recordEvent(tx, {
      eventType: 'IdentityCreated',
      aggregateType: 'Identity',
      aggregateId: user.id,
      actorId: user.id,
      payload: { hasHashHandle: Boolean(hashHandle) },
    });
    await recordAudit(tx, {
      actorId: user.id,
      action: 'identity.register',
      resourceType: 'Identity',
      resourceId: user.id,
      domainEventId: event.id,
    });

    return user.id;
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // D31: registering does not sign you in. No tokens are issued here, so an
  // unconfirmed address can never hold a session.
  await issueVerification({ id: user.id, email: user.email });

  return {
    user: await loadSessionUser(userId),
    verificationRequired: true,
    emailSentTo: user.email,
  };
}

export async function login(emailInput: string, passwordInput: string) {
  const user = await prisma.user.findUnique({ where: { email: emailInput } });

  // A wrong password and an unknown email return the same message.
  const matches = await bcrypt.compare(passwordInput, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // A deleted account has nobody left to sign in (D57).
  if (user.deletedAt) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  // A suspension is the platform's decision. A deactivation is the hasher's own,
  // and signing back in is how they undo it, below.
  if (user.status === AccountStatus.SUSPENDED) {
    throw ApiError.forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
  }

  // FR-AUTH-002, hard gate (D31). Checked after the password so this cannot be
  // used to find out which addresses are registered.
  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden(
      'Confirm your email address first. Check your inbox for the link we sent when you registered.',
      'EMAIL_NOT_VERIFIED',
    );
  }

  if (user.status === AccountStatus.DEACTIVATED) {
    // Welcome back: everything they had is still here (D57).
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { status: AccountStatus.ACTIVE, deactivatedAt: null } });
      const event = await recordEvent(tx, {
        eventType: 'AccountReactivated',
        aggregateType: 'Identity',
        aggregateId: user.id,
        actorId: user.id,
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: 'identity.account.reactivate',
        resourceType: 'Identity',
        resourceId: user.id,
        previousState: { status: AccountStatus.DEACTIVATED },
        newState: { status: AccountStatus.ACTIVE },
        policyRef: 'self',
        domainEventId: event.id,
      });
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await issueTokens(user);
  return { user: await loadSessionUser(user.id), ...tokens };
}

export async function refresh(presented: string) {
  try {
    verifyRefreshToken(presented);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presented) },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // A revoked token presented again is the signature of a stolen token being
    // replayed. Drop every session for that user.
    if (stored?.revokedAt) {
      logger.warn('Refresh token reuse detected — revoking all sessions', { userId: stored.userId });
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  }

  // Sessions predating the gate, or issued before confirmation, end here too.
  if (!stored.user.emailVerifiedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.forbidden('Confirm your email address first.', 'EMAIL_NOT_VERIFIED');
  }

  // A suspension taken out mid-session ends at the next refresh, at the latest.
  if (stored.user.status !== AccountStatus.ACTIVE) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.forbidden('This account is not active.', 'ACCOUNT_INACTIVE');
  }

  // Rotation is the point: the presented token is spent before a new pair is
  // issued, so it can never be used twice.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const tokens = await issueTokens(stored.user);
  return { user: await loadSessionUser(stored.userId), ...tokens };
}

// Idempotent: logging out twice is a 200, not an error.
export async function logout(presented?: string | null) {
  if (!presented) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  return loadSessionUser(userId);
}
