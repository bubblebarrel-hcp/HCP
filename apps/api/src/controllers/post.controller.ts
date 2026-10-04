import { Request, Response } from 'express';
import * as posts from '../services/post.service';
import * as polls from '../services/poll.service';
import { ApiError, ok } from '../utils/http';

// D51. Thin, like every other controller here.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

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
  return ok(res, await posts.listPublished(viewer(req), { page, limit, kennelSlug, authorId, tag, runId }));
}

export async function detail(req: Request, res: Response) {
  return ok(res, { post: await posts.detail(viewer(req), req.params.id) });
}

export async function create(req: Request, res: Response) {
  return ok(res, { post: await posts.createDraft(actor(req), req.body) }, 201);
}

export async function update(req: Request, res: Response) {
  return ok(res, { post: await posts.updateDraft(actor(req), req.params.id, req.body) });
}

export async function publish(req: Request, res: Response) {
  return ok(res, { post: await posts.publish(actor(req), req.params.id) });
}

export async function archive(req: Request, res: Response) {
  return ok(res, { post: await posts.archive(actor(req), req.params.id) });
}

export async function remove(req: Request, res: Response) {
  return ok(res, { post: await posts.remove(actor(req), req.params.id, req.body.reason) });
}

// D60. Answering a poll on a post.
export async function pollVote(req: Request, res: Response) {
  return ok(res, await polls.vote(actor(req), req.params.id, req.body.optionId));
}
