import { Request, Response } from 'express';
import * as entities from '../services/entity.service';
import { ApiError, ok } from '../utils/http';

// D59. Thin, like every other controller here.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

export async function trending(req: Request, res: Response) {
  const { limit } = req.query as unknown as { limit: number };
  return ok(res, { items: await entities.trending(limit) });
}

export async function suggest(req: Request, res: Response) {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  return ok(res, { items: await entities.suggestMentions(actor(req), q, limit) });
}

export async function byUsername(req: Request, res: Response) {
  return ok(res, await entities.findByUsername(req.params.username));
}

export async function setUsername(req: Request, res: Response) {
  return ok(res, await entities.setUsername(actor(req).id, req.body.username));
}
