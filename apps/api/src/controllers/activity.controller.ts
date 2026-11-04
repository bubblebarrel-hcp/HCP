import { Request, Response } from 'express';
import * as activities from '../services/activity.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

function maybeActor(req: Request): Actor | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

export async function record(req: Request, res: Response) {
  const { activity, created } = await activities.recordActivity(actor(req), req.body);
  // A retried upload that already landed answers 200 with the same recording.
  return ok(res, { activity }, created ? 201 : 200);
}

export async function mine(req: Request, res: Response) {
  return ok(res, await activities.listMine(actor(req), req.query as never));
}

export async function forHasher(req: Request, res: Response) {
  return ok(res, await activities.listForHasher(maybeActor(req), req.params.userId, req.query as never));
}

export async function get(req: Request, res: Response) {
  return ok(res, { activity: await activities.getActivity(maybeActor(req), req.params.id) });
}

export async function update(req: Request, res: Response) {
  return ok(res, { activity: await activities.updateActivity(actor(req), req.params.id, req.body) });
}

export async function remove(req: Request, res: Response) {
  await activities.removeActivity(actor(req), req.params.id);
  return ok(res, { removed: true });
}
