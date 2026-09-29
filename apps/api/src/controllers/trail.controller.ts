import { Request, Response } from 'express';
import type { Actor } from '../services/permission.service';
import * as trails from '../services/trail.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

function viewer(req: Request): Actor | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

// Writes answer with the refreshed trail as this viewer sees it, so a client
// never has to guess what is now visible.
async function respondWithTrail(req: Request, res: Response, trailId: string, status = 200) {
  return ok(res, { trail: await trails.getTrail(viewer(req), trailId) }, status);
}

export async function listForRun(req: Request, res: Response) {
  return ok(res, await trails.listForRun(viewer(req), req.params.runId));
}

export async function create(req: Request, res: Response) {
  const { id } = await trails.createTrail(actor(req), req.params.runId, req.body);
  return respondWithTrail(req, res, id, 201);
}

export async function detail(req: Request, res: Response) {
  return respondWithTrail(req, res, req.params.id);
}

export async function update(req: Request, res: Response) {
  await trails.updateTrail(actor(req), req.params.id, req.body);
  return respondWithTrail(req, res, req.params.id);
}

export async function act(req: Request, res: Response) {
  await trails.transition(actor(req), req.params.id, req.params.action, req.body);
  return respondWithTrail(req, res, req.params.id);
}

export async function revisions(req: Request, res: Response) {
  return ok(res, await trails.listRevisions(actor(req), req.params.id));
}

export async function addWaypoint(req: Request, res: Response) {
  await trails.addWaypoint(actor(req), req.params.id, req.body);
  return respondWithTrail(req, res, req.params.id, 201);
}

export async function updateWaypoint(req: Request, res: Response) {
  await trails.updateWaypoint(actor(req), req.params.id, req.params.waypointId, req.body);
  return respondWithTrail(req, res, req.params.id);
}

export async function removeWaypoint(req: Request, res: Response) {
  await trails.removeWaypoint(actor(req), req.params.id, req.params.waypointId);
  return respondWithTrail(req, res, req.params.id);
}

export async function addBeerCheck(req: Request, res: Response) {
  await trails.addBeerCheck(actor(req), req.params.id, req.body);
  return respondWithTrail(req, res, req.params.id, 201);
}

export async function updateBeerCheck(req: Request, res: Response) {
  await trails.updateBeerCheck(actor(req), req.params.id, req.params.beerCheckId, req.body);
  return respondWithTrail(req, res, req.params.id);
}

export async function removeBeerCheck(req: Request, res: Response) {
  await trails.removeBeerCheck(actor(req), req.params.id, req.params.beerCheckId);
  return respondWithTrail(req, res, req.params.id);
}

export async function placeChalk(req: Request, res: Response) {
  await trails.placeChalk(actor(req), req.params.id, req.body);
  return respondWithTrail(req, res, req.params.id, 201);
}

export async function removeChalk(req: Request, res: Response) {
  await trails.removeChalk(actor(req), req.params.id, req.params.chalkId);
  return respondWithTrail(req, res, req.params.id);
}
