import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/http';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { message: `No route for ${req.method} ${req.path}`, code: 'NOT_FOUND' },
  });
}

// Must be mounted last. Everything that throws anywhere in the stack lands here
// and leaves as the same envelope the frontends already know how to read.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { message: err.message, code: err.code },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return res.status(409).json({
        success: false,
        error: { message: `That ${target} is already taken`, code: 'DUPLICATE' },
      });
    }
    // Serializable transaction lost a race (e.g. a double-tapped membership request)
    if (err.code === 'P2034') {
      return res.status(409).json({
        success: false,
        error: { message: 'That clashed with another change. Please try again.', code: 'WRITE_CONFLICT' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { message: 'Not found', code: 'NOT_FOUND' },
      });
    }
  }

  logger.error('Unhandled error', {
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({
    success: false,
    error: {
      message: env.isProduction ? 'Something went wrong' : String(err instanceof Error ? err.message : err),
      code: 'INTERNAL',
    },
  });
}
