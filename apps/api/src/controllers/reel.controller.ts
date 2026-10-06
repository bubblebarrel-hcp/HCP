import { Request, Response } from 'express';
import { SubjectType } from '@prisma/client';
import * as reels from '../services/reel.service';
import * as feed from '../services/feed.service';
import * as engagement from '../services/engagement.service';
import { ApiError, ok } from '../utils/http';

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

// Signed out is a normal way to read a feed, so the optional actor is passed
// through rather than demanded.
const viewer = (req: Request) => (req.user ? { id: req.user.id, role: req.user.role } : undefined);

export async function list(req: Request, res: Response) {
  const { page, limit, kennelSlug, authorId, tag, runId } = req.query as unknown as {
    page: number;
    limit: number;
    kennelSlug?: string;
    authorId?: string;
    tag?: string;
    runId?: string;
  };
  return ok(res, await reels.listPublished(viewer(req), { page, limit, kennelSlug, authorId, tag, runId }));
}

export async function detail(req: Request, res: Response) {
  return ok(res, { reel: await reels.detail(viewer(req), req.params.id) });
}

export async function create(req: Request, res: Response) {
  return ok(res, { reel: await reels.createDraft(actor(req), req.body) }, 201);
}

export async function update(req: Request, res: Response) {
  return ok(res, { reel: await reels.updateDraft(actor(req), req.params.id, req.body) });
}

export async function publish(req: Request, res: Response) {
  return ok(res, { reel: await reels.publish(actor(req), req.params.id) });
}

export async function archive(req: Request, res: Response) {
  return ok(res, { reel: await reels.archive(actor(req), req.params.id) });
}

export async function deleteOwn(req: Request, res: Response) {
  return ok(res, await reels.deleteOwn(actor(req), req.params.id));
}

export async function pin(req: Request, res: Response) {
  return ok(res, { reel: await reels.setPinned(actor(req), req.params.id, true) });
}

export async function unpin(req: Request, res: Response) {
  return ok(res, { reel: await reels.setPinned(actor(req), req.params.id, false) });
}

export async function remove(req: Request, res: Response) {
  return ok(res, { reel: await reels.remove(actor(req), req.params.id, req.body.reason) });
}

// Views are deduped per signed-in viewer now (D50), so this goes through the
// shared counter rather than a bare increment. The reel's own column is still
// mirrored for anything reading it.
export async function countView(req: Request, res: Response) {
  const result = await engagement.countView(viewer(req), SubjectType.REEL, req.params.id);
  await reels.mirrorViewCount(req.params.id);
  return ok(res, result);
}

export async function communityFeed(req: Request, res: Response) {
  const { page, limit, scope } = req.query as unknown as {
    page: number;
    limit: number;
    scope: feed.FeedScope;
  };
  return ok(res, await feed.list(viewer(req), { page, limit, scope }));
}
