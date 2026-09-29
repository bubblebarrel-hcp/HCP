import { Request, Response } from 'express';
import * as hares from '../services/hare.service';
import { ApiError, ok } from '../utils/http';

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

const viewer = (req: Request) => (req.user ? { id: req.user.id, role: req.user.role } : undefined);

export async function needingHares(req: Request, res: Response) {
  const { page, limit, kennelSlug } = req.query as unknown as { page: number; limit: number; kennelSlug?: string };
  return ok(res, await hares.listRunsNeedingHares(viewer(req), { page, limit, kennelSlug }));
}

export async function listForRun(req: Request, res: Response) {
  return ok(res, await hares.listForRun(actor(req), req.params.runId));
}

export async function offer(req: Request, res: Response) {
  return ok(res, { offer: await hares.offer(actor(req), req.params.runId, req.body) }, 201);
}

export async function withdraw(req: Request, res: Response) {
  return ok(res, { offer: await hares.withdraw(actor(req), req.params.id, req.body?.reason ?? null) });
}

export async function accept(req: Request, res: Response) {
  return ok(res, { offer: await hares.accept(actor(req), req.params.id) });
}

export async function decline(req: Request, res: Response) {
  return ok(res, { offer: await hares.decline(actor(req), req.params.id, req.body.reason) });
}
