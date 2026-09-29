import { Request, Response } from 'express';
import * as kennelService from '../services/kennel.service';
import { ApiError, ok } from '../utils/http';

export async function listPublic(req: Request, res: Response) {
  const { page, limit, q, country } = req.query as unknown as {
    page: number;
    limit: number;
    q?: string;
    country?: string;
  };
  return ok(res, await kennelService.listPublic({ page, limit, q, country }));
}

export async function getPublic(req: Request, res: Response) {
  return ok(res, { kennel: await kennelService.getPublicBySlug(req.params.slug) });
}

export async function mapPins(_req: Request, res: Response) {
  return ok(res, { items: await kennelService.listMapPins() });
}

export async function listAdmin(req: Request, res: Response) {
  const { page, limit, q, status } = req.query as unknown as Parameters<typeof kennelService.listAdmin>[0];
  return ok(res, await kennelService.listAdmin({ page, limit, q, status }));
}

export async function getAdmin(req: Request, res: Response) {
  return ok(res, { kennel: await kennelService.getAdmin(req.params.id) });
}

// FR-KENNEL-001: any signed-in hasher may start a kennel (D33). Distinct from
// `create`, which is the platform admin's route and accepts status and
// verification level.
export async function found(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, { kennel: await kennelService.found(req.user.id, req.body) }, 201);
}

export async function getSettings(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const actor = { id: req.user.id, role: req.user.role };
  return ok(res, await kennelService.getSettings(actor, req.params.slug));
}

// D34: a kennel admin edits their own kennel. Distinct from the admin `update`,
// which may also change standing and verification.
export async function updateSettings(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const actor = { id: req.user.id, role: req.user.role };
  return ok(res, { kennel: await kennelService.updateSettings(actor, req.params.slug, req.body) });
}

export async function abandon(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const actor = { id: req.user.id, role: req.user.role };
  return ok(res, await kennelService.abandon(actor, req.params.slug, req.body.reason));
}

export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, { kennel: await kennelService.create(req.user.id, req.body) }, 201);
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, { kennel: await kennelService.update(req.user.id, req.params.id, req.body) });
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await kennelService.remove(req.user.id, req.params.id));
}
