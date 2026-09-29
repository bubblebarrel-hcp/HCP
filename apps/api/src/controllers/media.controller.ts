import { Request, Response } from 'express';
import type { MediaTargetType } from '@prisma/client';
import * as media from '../services/media.service';
import type { Actor } from '../services/permission.service';
import { writeLocalObject } from '../services/storage.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export async function requestUpload(req: Request, res: Response) {
  return ok(res, await media.requestUpload(actor(req), req.body), 201);
}

export async function confirmUpload(req: Request, res: Response) {
  return ok(res, { media: await media.confirmUpload(actor(req), req.params.id, req.body) });
}

export async function list(req: Request, res: Response) {
  const { targetType, targetId, page, limit } = req.query as unknown as {
    targetType: MediaTargetType;
    targetId: string;
    page: number;
    limit: number;
  };
  const viewer = req.user ? { id: req.user.id, role: req.user.role } : undefined;
  return ok(res, await media.listForTarget(viewer, { type: targetType, id: targetId }, { page, limit }));
}

export async function detail(req: Request, res: Response) {
  return ok(res, { media: await media.getMedia(actor(req), req.params.id) });
}

export async function moderate(req: Request, res: Response) {
  return ok(res, { media: await media.moderate(actor(req), req.params.id, req.body.approve, req.body.reason) });
}

// Local storage driver only: accepts the bytes when R2 is not configured, so
// development works before the bucket exists.
export async function putLocalObject(req: Request, res: Response) {
  const storageKey = (req.params as unknown as { 0?: string })[0] ?? req.params.key;
  if (!storageKey) throw ApiError.badRequest('Missing storage key', 'BAD_REQUEST');
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw ApiError.badRequest('Empty upload', 'EMPTY_UPLOAD');
  }
  await writeLocalObject(storageKey, req.body);
  return ok(res, { stored: true, storageKey });
}
