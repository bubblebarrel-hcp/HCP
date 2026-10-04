import { Request, Response } from 'express';
import { ReactionKind } from '@prisma/client';
import * as engagement from '../services/engagement.service';
import { subjectTypeFromSegment } from '../services/subject.service';
import { ApiError, ok } from '../utils/http';

// D50. Thin, like every other controller here: the subject segment becomes an
// enum, the actor becomes an actor, and the service does the rest.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

const viewer = (req: Request) => (req.user ? { id: req.user.id, role: req.user.role } : undefined);

const subject = (req: Request) => subjectTypeFromSegment(req.params.subject);

const paging = (req: Request) => req.query as unknown as { page: number; limit: number };

export async function get(req: Request, res: Response) {
  return ok(res, await engagement.getEngagement(viewer(req), subject(req), req.params.id));
}

export async function like(req: Request, res: Response) {
  // A plain press is ON_ON; a hash reaction names itself (D60).
  const reaction = typeof req.body?.reaction === 'string' ? req.body.reaction : undefined;
  if (reaction !== undefined && !(reaction in ReactionKind)) {
    throw ApiError.badRequest('That is not a reaction.', 'BAD_REACTION');
  }
  return ok(res, await engagement.like(actor(req), subject(req), req.params.id, reaction as ReactionKind | undefined));
}

export async function unlike(req: Request, res: Response) {
  return ok(res, await engagement.unlike(actor(req), subject(req), req.params.id));
}

export async function likes(req: Request, res: Response) {
  return ok(res, await engagement.listLikes(viewer(req), subject(req), req.params.id, paging(req)));
}

export async function bookmark(req: Request, res: Response) {
  return ok(res, await engagement.bookmark(actor(req), subject(req), req.params.id, req.body?.note));
}

export async function unbookmark(req: Request, res: Response) {
  return ok(res, await engagement.unbookmark(actor(req), subject(req), req.params.id));
}

export async function myBookmarks(req: Request, res: Response) {
  const { page, limit, subject: segment } = req.query as unknown as {
    page: number;
    limit: number;
    subject?: string;
  };
  return ok(
    res,
    await engagement.listBookmarks(actor(req), {
      page,
      limit,
      type: segment ? subjectTypeFromSegment(segment) : undefined,
    }),
  );
}

export async function reshare(req: Request, res: Response) {
  return ok(res, await engagement.reshare(actor(req), subject(req), req.params.id, req.body?.commentary));
}

export async function unreshare(req: Request, res: Response) {
  return ok(res, await engagement.unreshare(actor(req), subject(req), req.params.id));
}

export async function reshares(req: Request, res: Response) {
  return ok(res, await engagement.listReshares(viewer(req), subject(req), req.params.id, paging(req)));
}

export async function comments(req: Request, res: Response) {
  return ok(res, await engagement.listComments(viewer(req), subject(req), req.params.id, paging(req)));
}

export async function addComment(req: Request, res: Response) {
  return ok(res, { comment: await engagement.addComment(actor(req), subject(req), req.params.id, req.body) }, 201);
}

export async function replies(req: Request, res: Response) {
  return ok(res, await engagement.listReplies(viewer(req), req.params.commentId, paging(req)));
}

export async function editComment(req: Request, res: Response) {
  return ok(res, { comment: await engagement.editComment(actor(req), req.params.commentId, req.body.body) });
}

export async function deleteComment(req: Request, res: Response) {
  return ok(res, await engagement.deleteComment(actor(req), req.params.commentId));
}

export async function removeComment(req: Request, res: Response) {
  return ok(res, await engagement.removeComment(actor(req), req.params.commentId, req.body.reason));
}

// A view is a tally, so reading signed out still counts — it just counts as an
// anonymous open rather than as a named viewer.
export async function countView(req: Request, res: Response) {
  return ok(res, await engagement.countView(viewer(req), subject(req), req.params.id));
}
