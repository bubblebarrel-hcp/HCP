import { Request, Response } from 'express';
import * as passports from '../services/passport.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export async function mine(req: Request, res: Response) {
  return ok(res, { passport: await passports.getMyPassport(actor(req)) });
}

export async function timeline(req: Request, res: Response) {
  return ok(res, { items: await passports.getTimeline(actor(req)) });
}

export async function shared(req: Request, res: Response) {
  return ok(res, { passport: await passports.getSharedPassport(req.params.shareToken) });
}

export async function rotateShare(req: Request, res: Response) {
  return ok(res, await passports.rotateShareToken(actor(req)));
}

export async function addMemory(req: Request, res: Response) {
  await passports.addMemory(actor(req), req.body);
  return ok(res, { passport: await passports.getMyPassport(actor(req)) }, 201);
}

export async function removeMemory(req: Request, res: Response) {
  await passports.removeMemory(actor(req), req.params.id);
  return ok(res, { passport: await passports.getMyPassport(actor(req)) });
}
