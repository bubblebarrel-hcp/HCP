import { ModerationActionKind, ReportReason, ReportTargetType } from '@prisma/client';
import { Request, Response } from 'express';
import * as appeals from '../services/appeal.service';
import * as enforcement from '../services/enforcement.service';
import * as moderation from '../services/moderation.service';
import { ApiError, ok } from '../utils/http';

// D61. Thin, like every other controller here. The same handlers serve platform
// staff (`/admin/reports`) and a kennel's moderators (`/kennels/:slug/reports`);
// the service decides what each may see and do.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};
const slug = (req: Request) => (typeof req.params.slug === 'string' ? req.params.slug : undefined);

export const file = async (req: Request, res: Response) =>
  ok(
    res,
    await moderation.file(actor(req), {
      targetType: req.body.targetType as ReportTargetType,
      targetId: req.body.targetId,
      reason: req.body.reason as ReportReason,
      details: req.body.details,
      impersonating: req.body.impersonating,
      impersonatedUserId: req.body.impersonatedUserId,
    }),
    201,
  );

export const mine = async (req: Request, res: Response) => ok(res, { items: await moderation.listMine(actor(req)) });

export const queue = async (req: Request, res: Response) => {
  const q = req.query as unknown as {
    filter: 'open' | 'resolved' | 'all';
    reason?: ReportReason;
    page: number;
    limit: number;
  };
  return ok(res, await moderation.queue(actor(req), { kennelSlug: slug(req), ...q }));
};

export const counts = async (req: Request, res: Response) => ok(res, await moderation.counts(actor(req), slug(req)));
export const detail = async (req: Request, res: Response) =>
  ok(res, { report: await moderation.detail(actor(req), req.params.id, slug(req)) });
// A file out of a reported direct message (D73): platform staff, five minutes, audited.
export const reportedFile = async (req: Request, res: Response) =>
  ok(res, await moderation.reportedFile(actor(req), req.params.id, req.params.fileId));
export const act = async (req: Request, res: Response) =>
  ok(
    res,
    {
      report: await moderation.act(
        actor(req),
        req.params.id,
        { kind: req.body.kind as ModerationActionKind, note: req.body.note, closeSiblings: req.body.closeSiblings },
        slug(req),
      ),
    },
  );

// Automatic holds and warnings (D74). Platform staff only: the router applies the
// admin gate once, at its top.
export const enforcements = async (req: Request, res: Response) =>
  ok(res, await enforcement.list(req.query as unknown as { filter: 'active' | 'appeals' | 'all'; page: number; limit: number }));
export const liftEnforcement = async (req: Request, res: Response) =>
  ok(res, { enforcement: await enforcement.lift(req.params.id, { id: actor(req).id }, req.body.note) });
export const confirmEnforcement = async (req: Request, res: Response) =>
  ok(res, { enforcement: await enforcement.confirm(req.params.id, { id: actor(req).id }, req.body.note) });

export const decideAppeal = async (req: Request, res: Response) =>
  ok(res, { appeal: await appeals.decide(req.params.id, { id: actor(req).id }, req.body.outcome, req.body.note) });
export const coordination = async (req: Request, res: Response) =>
  ok(res, await enforcement.listFlags(req.query as unknown as { filter: 'pending' | 'all'; page: number; limit: number }));
export const reviewCoordination = async (req: Request, res: Response) =>
  ok(res, { flag: await enforcement.reviewFlag(req.params.id, { id: actor(req).id }, req.body.outcome, req.body.note) });
export const enforcementCounts = async (_req: Request, res: Response) =>
  ok(res, { appeals: await enforcement.openAppealCount(), coordination: await enforcement.pendingFlagCount(), holds: await enforcement.activeCount() });
