import { Request, Response } from 'express';
import * as delegations from '../services/delegation.service';
import * as officers from '../services/officer.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

// ─── Positions and appointments ───

export async function listPositions(req: Request, res: Response) {
  return ok(res, await officers.listPositions(actor(req), req.params.slug));
}

export async function timeline(req: Request, res: Response) {
  return ok(res, await officers.leadershipTimeline(actor(req), req.params.slug));
}

export async function createPosition(req: Request, res: Response) {
  return ok(res, await officers.createPosition(actor(req), req.params.slug, req.body), 201);
}

export async function updatePosition(req: Request, res: Response) {
  return ok(res, await officers.updatePosition(actor(req), req.params.id, req.body));
}

export async function archivePosition(req: Request, res: Response) {
  return ok(res, await officers.archivePosition(actor(req), req.params.id, req.body.reason));
}

export async function appoint(req: Request, res: Response) {
  return ok(res, await officers.appoint(actor(req), req.params.id, req.body), 201);
}

export async function endAppointment(req: Request, res: Response) {
  return ok(res, await officers.endAppointment(actor(req), req.params.id, req.params.action, req.body.reason));
}

// ─── Delegations ───

export async function listDelegations(req: Request, res: Response) {
  return ok(res, await delegations.listDelegations(actor(req), req.params.slug));
}

export async function grantDelegation(req: Request, res: Response) {
  return ok(res, await delegations.grant(actor(req), req.params.slug, req.body), 201);
}

export async function revokeDelegation(req: Request, res: Response) {
  return ok(res, await delegations.revoke(actor(req), req.params.id, req.body?.reason ?? null));
}

// ─── Kennel-scoped roles ───

export async function grantRole(req: Request, res: Response) {
  return ok(res, await officers.grantRole(actor(req), req.params.slug, req.body), 201);
}

export async function revokeRole(req: Request, res: Response) {
  return ok(res, await officers.revokeRole(actor(req), req.params.id, req.body.reason));
}

export async function renameRole(req: Request, res: Response) {
  return ok(res, await officers.renameRole(actor(req), req.params.id, req.body.title ?? null));
}
