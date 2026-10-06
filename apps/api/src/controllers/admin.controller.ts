import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
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
