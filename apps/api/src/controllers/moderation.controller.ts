import { ModerationActionKind, ReportReason, ReportTargetType } from '@prisma/client';
import { Request, Response } from 'express';
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
