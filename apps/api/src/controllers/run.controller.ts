import { Request, Response } from 'express';
import * as attendance from '../services/attendance.service';
import * as circle from '../services/circle.service';
import type { Actor } from '../services/permission.service';
import * as runs from '../services/run.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

function viewer(req: Request): Actor | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

type ListQuery = { page: number; limit: number; scope: 'upcoming' | 'past' | 'drafts' };

// Every write answers with the refreshed run as this viewer sees it, so clients
// never guess the next state.
async function respondWithRun(req: Request, res: Response, runId: string, status = 200, extra: object = {}) {
  return ok(res, { run: await runs.getRunDetail(viewer(req), runId), ...extra }, status);
}

export async function list(req: Request, res: Response) {
  const { page, limit, scope } = req.query as unknown as ListQuery;
  return ok(res, await runs.listRuns(viewer(req), { page, limit, scope }));
}

export async function kennelRuns(req: Request, res: Response) {
  const { page, limit, scope } = req.query as unknown as ListQuery;
  return ok(res, await runs.listKennelRuns(viewer(req), req.params.slug, { page, limit, scope }));
}

export async function planning(req: Request, res: Response) {
  return ok(res, await runs.planningContext(actor(req), req.params.slug));
}

export async function create(req: Request, res: Response) {
  const { id } = await runs.createRun(actor(req), req.params.slug, req.body);
  return respondWithRun(req, res, id, 201);
}

export async function detail(req: Request, res: Response) {
  return respondWithRun(req, res, req.params.id);
}

export async function update(req: Request, res: Response) {
  await runs.updateRun(actor(req), req.params.id, req.body);
  return respondWithRun(req, res, req.params.id);
}

export async function act(req: Request, res: Response) {
  await runs.transition(actor(req), req.params.id, req.params.action, req.body);
  return respondWithRun(req, res, req.params.id);
}

export async function rsvp(req: Request, res: Response) {
  await attendance.setRsvp(actor(req), req.params.id, req.body.status);
  return respondWithRun(req, res, req.params.id);
}

export async function withdraw(req: Request, res: Response) {
  await attendance.withdrawRsvp(actor(req), req.params.id);
  return respondWithRun(req, res, req.params.id);
}

export async function checkIn(req: Request, res: Response) {
  await attendance.checkInSelf(actor(req), req.params.id);
  return respondWithRun(req, res, req.params.id);
}

export async function registerGuest(req: Request, res: Response) {
  const registration = await attendance.registerGuest(viewer(req), req.params.id, req.body);
  return respondWithRun(req, res, req.params.id, 201, { registration });
}

export async function checkInParticipant(req: Request, res: Response) {
  await attendance.checkInParticipant(actor(req), req.params.id, req.params.participationId);
  return respondWithRun(req, res, req.params.id);
}

export async function revertCheckIn(req: Request, res: Response) {
  await attendance.revertCheckIn(actor(req), req.params.id, req.params.participationId, req.body?.reason);
  return respondWithRun(req, res, req.params.id);
}

export async function updateCircle(req: Request, res: Response) {
  await circle.updateCircle(actor(req), req.params.id, req.body);
  return respondWithRun(req, res, req.params.id);
}

export async function addAward(req: Request, res: Response) {
  await circle.addAward(actor(req), req.params.id, req.body);
  return respondWithRun(req, res, req.params.id, 201);
}

export async function removeAward(req: Request, res: Response) {
  await circle.removeAward(actor(req), req.params.id, req.params.awardId);
  return respondWithRun(req, res, req.params.id);
}
