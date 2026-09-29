import { Request, Response } from 'express';
import * as capsules from '../services/capsule.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

function viewer(req: Request): Actor | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

export async function list(req: Request, res: Response) {
  const { kennelSlug, page, limit } = req.query as unknown as { kennelSlug?: string; page: number; limit: number };
  return ok(res, await capsules.listCapsules(viewer(req), { kennelSlug, page, limit }));
}

export async function forRun(req: Request, res: Response) {
  return ok(res, { capsule: await capsules.getForRun(viewer(req), req.params.runId) });
}

export async function detail(req: Request, res: Response) {
  return ok(res, { capsule: await capsules.getCapsule(viewer(req), req.params.id) });
}

export async function transition(req: Request, res: Response) {
  return ok(res, { capsule: await capsules.transition(actor(req), req.params.id, req.params.action, req.body) });
}

export async function addSupplement(req: Request, res: Response) {
  return ok(res, { capsule: await capsules.addSupplement(actor(req), req.params.id, req.body) }, 201);
}
