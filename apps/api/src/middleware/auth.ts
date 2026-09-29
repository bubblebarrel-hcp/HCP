import { NextFunction, Request, Response } from 'express';
import { PlatformRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: PlatformRole };
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next(ApiError.unauthorized());

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(ApiError.unauthorized('Session expired', 'TOKEN_EXPIRED'));
  }
}

// For public endpoints whose response varies by viewer (e.g. members-only runs).
// No token: anonymous. A token that is present but expired or invalid is
// rejected with 401, so the web proxy and the mobile client refresh it and
// retry, instead of a signed-in hasher silently seeing the anonymous view.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(ApiError.unauthorized('Session expired', 'TOKEN_EXPIRED'));
  }
}

// Platform role only. Kennel-scoped checks (kennel admin, hare, officer) belong
// in services, against the database.
export function requireRole(...roles: PlatformRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}
