import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PlatformRole } from '@prisma/client';
import { env } from '../config/env';

// The access token carries only the platform role. Kennel-scoped authority
// (kennel admin, hare, officer) is contextual and always checked against the
// database, never trusted from a token claim.
export interface AccessPayload {
  sub: string;
  role: PlatformRole;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(userId: string, role: PlatformRole): string {
  const payload: AccessPayload = { sub: userId, role };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  } as SignOptions);
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const payload: RefreshPayload = { sub: userId, jti };
  const token = jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as SignOptions);
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;
}

// Only the hash of a refresh token is ever stored, so a leaked database row
// cannot be replayed as a session.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
