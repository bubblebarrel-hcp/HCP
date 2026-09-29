import { Request, Response } from 'express';
import * as analytics from '../services/analytics.service';
import * as kennels from '../services/kennel.service';
import { ok } from '../utils/http';

export async function hasherDna(req: Request, res: Response) {
  const viewer = req.user ? { id: req.user.id, role: req.user.role } : undefined;
  return ok(res, await analytics.getHasherDna(viewer, req.params.id));
}

export async function kennelGrowth(req: Request, res: Response) {
  const kennel = await kennels.getPublicBySlug(req.params.slug);
  return ok(res, await analytics.getKennelGrowth(kennel.id));
}
