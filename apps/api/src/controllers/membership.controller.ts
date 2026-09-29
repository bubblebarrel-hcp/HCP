import { Request, Response } from 'express';
import type { MembershipStatus } from '@prisma/client';
import * as membershipService from '../services/membership.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export async function mine(req: Request, res: Response) {
  return ok(res, await membershipService.listMine(actor(req)));
}

export async function viewer(req: Request, res: Response) {
  const current = req.user ? { id: req.user.id, role: req.user.role } : undefined;
  return ok(res, await membershipService.getViewer(current, req.params.slug));
}

export async function setHomeKennel(req: Request, res: Response) {
  return ok(res, await membershipService.setHomeKennel(actor(req), req.body.kennelId));
}

export async function request(req: Request, res: Response) {
  return ok(
    res,
    { membership: await membershipService.requestMembership(actor(req), req.params.slug, req.body) },
    201,
  );
}

export async function listMembers(req: Request, res: Response) {
  const { page, limit, q, status } = req.query as unknown as {
    page: number;
    limit: number;
    q?: string;
    status?: MembershipStatus;
  };
  return ok(res, await membershipService.listMembers(actor(req), req.params.slug, { page, limit, q, status }));
}

export async function timeline(req: Request, res: Response) {
  return ok(res, await membershipService.timeline(actor(req), req.params.id));
}

export async function approve(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.approve(actor(req), req.params.id, req.body) });
}

export async function reject(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.reject(actor(req), req.params.id, req.body) });
}

export async function suspend(req: Request, res: Response) {
  const { reason, until } = req.body as { reason: string; until?: Date | '' | null };
  return ok(res, {
    membership: await membershipService.suspend(actor(req), req.params.id, { reason, until: until || null }),
  });
}

export async function reinstate(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.reinstate(actor(req), req.params.id, req.body) });
}

export async function remove(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.remove(actor(req), req.params.id, req.body) });
}

export async function resign(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.resign(actor(req), req.params.id, req.body) });
}

export async function withdraw(req: Request, res: Response) {
  return ok(res, { membership: await membershipService.withdraw(actor(req), req.params.id, req.body) });
}
