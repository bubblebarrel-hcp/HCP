import { Request, Response } from 'express';
import * as invitationService from '../services/invitation.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export async function list(req: Request, res: Response) {
  return ok(res, { items: await invitationService.listInvitations(actor(req), req.params.slug) });
}

export async function create(req: Request, res: Response) {
  return ok(res, await invitationService.createInvitation(actor(req), req.params.slug, req.body), 201);
}

export async function revoke(req: Request, res: Response) {
  return ok(res, await invitationService.revokeInvitation(actor(req), req.params.id));
}

export async function preview(req: Request, res: Response) {
  return ok(res, await invitationService.previewInvitation(req.params.token));
}

export async function accept(req: Request, res: Response) {
  return ok(res, await invitationService.acceptInvitation(actor(req), req.params.token));
}
