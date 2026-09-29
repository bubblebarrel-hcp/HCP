import { Request, Response } from 'express';
import * as search from '../services/search.service';
import { ok } from '../utils/http';

export async function global(req: Request, res: Response) {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  const viewer = req.user ? { id: req.user.id, role: req.user.role } : undefined;
  return ok(res, await search.globalSearch(viewer, q, limit));
}
