import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import * as audit from '../services/admin-audit.service';
import * as oversight from '../services/admin-oversight.service';
import { sendDueDigests } from '../services/digest.service';
import { runAllReminders } from '../services/escalation.service';
import { nudgeUnharedRuns } from '../services/reminder.service';
import { ApiError, ok } from '../utils/http';

export async function stats(_req: Request, res: Response) {
  return ok(res, await adminService.stats());
}

// D33/D10: what is waiting to be let into the directory.
export async function pendingKennels(_req: Request, res: Response) {
  return ok(res, await adminService.pendingKennels({ limit: 50 }));
}

// D45: the reminder sweep runs on a timer; this runs it now.
export async function sweepHareReminders(_req: Request, res: Response) {
  return ok(res, await nudgeUnharedRuns());
}

// FR-NOT-007: the digest sweep runs on a timer; this runs it now.
export async function sweepDigests(_req: Request, res: Response) {
  return ok(res, await sendDueDigests());
}

// FR-NOT-011/013: the reminder and escalation sweep runs on a timer; this runs it now.
export async function sweepEscalations(_req: Request, res: Response) {
  return ok(res, await runAllReminders());
}

export async function listUsers(req: Request, res: Response) {
  const { page, limit, q } = req.query as unknown as { page: number; limit: number; q?: string };
  return ok(res, await adminService.listUsers({ page, limit, q }));
}

export async function updateUserRole(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, { user: await adminService.updateRole(req.user.id, req.params.id, req.body.platformRole) });
}

export async function updateUserStatus(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, {
    user: await adminService.updateStatus(req.user.id, req.params.id, req.body.status, req.body.reason),
  });
}

// Validators coerce the query (page/limit numbers, dates), so the cast is the
// post-validation shape.
const query = <T>(req: Request) => req.query as unknown as T;
const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

export async function listAudit(req: Request, res: Response) {
  return ok(res, await audit.listAudit(query(req)));
}
export async function listEvents(req: Request, res: Response) {
  return ok(res, await audit.listEvents(query(req)));
}
export async function eventsHealth(_req: Request, res: Response) {
  return ok(res, await audit.eventsHealth());
}
export async function listSettings(_req: Request, res: Response) {
  return ok(res, await audit.listSettings());
}
export async function updateSetting(req: Request, res: Response) {
  return ok(res, { setting: await audit.updateSetting(actor(req).id, req.params.key, req.body.value, req.body.reason) });
}

export async function listMemberships(req: Request, res: Response) {
  return ok(res, await oversight.listMemberships(query(req)));
}
export async function verificationReadiness(_req: Request, res: Response) {
  return ok(res, await oversight.verificationReadiness());
}
export async function listRuns(req: Request, res: Response) {
  return ok(res, await oversight.listRuns(query(req)));
}
export async function runsAwaitingReport(_req: Request, res: Response) {
  return ok(res, await oversight.runsAwaitingReport());
}
export async function listPosts(req: Request, res: Response) {
  return ok(res, await oversight.listPosts(query(req)));
}
export async function listReels(req: Request, res: Response) {
  return ok(res, await oversight.listReels(query(req)));
}
export async function takedownPost(req: Request, res: Response) {
  return ok(res, await oversight.takedownPost(actor(req), req.params.id, req.body.reason));
}
export async function takedownReel(req: Request, res: Response) {
  return ok(res, await oversight.takedownReel(actor(req), req.params.id, req.body.reason));
}
