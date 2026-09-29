import { Request, Response } from 'express';
import type { ReportContributorRole, StoryCategory } from '@prisma/client';
import * as reports from '../services/report.service';
import * as stories from '../services/story.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

function viewer(req: Request): Actor | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

// ─── Trail Reports ───

export async function listPublished(req: Request, res: Response) {
  const { kennelSlug, page, limit } = req.query as unknown as { kennelSlug?: string; page: number; limit: number };
  return ok(res, await reports.listPublished(viewer(req), { kennelSlug, page, limit }));
}

export async function forRun(req: Request, res: Response) {
  return ok(res, await reports.getForRun(viewer(req), req.params.runId));
}

export async function detail(req: Request, res: Response) {
  return ok(res, { report: await reports.getReport(viewer(req), req.params.id) });
}

export async function startDraft(req: Request, res: Response) {
  return ok(res, { report: await reports.startDraft(actor(req), req.params.runId, req.body) }, 201);
}

export async function updateDraft(req: Request, res: Response) {
  return ok(res, { report: await reports.updateDraft(actor(req), req.params.id, req.body) });
}

export async function transition(req: Request, res: Response) {
  return ok(res, { report: await reports.transition(actor(req), req.params.id, req.params.action, req.body) });
}

export async function revise(req: Request, res: Response) {
  return ok(res, { report: await reports.revise(actor(req), req.params.id, req.body) });
}

export async function listRevisions(req: Request, res: Response) {
  return ok(res, await reports.listRevisions(actor(req), req.params.id));
}

export async function getRevision(req: Request, res: Response) {
  return ok(res, { revision: await reports.getRevision(actor(req), req.params.id, Number(req.params.version)) });
}

export async function restoreRevision(req: Request, res: Response) {
  return ok(res, {
    report: await reports.restoreRevision(actor(req), req.params.id, Number(req.params.version), req.body.reason),
  });
}

export async function addContributor(req: Request, res: Response) {
  return ok(res, { report: await reports.addContributor(actor(req), req.params.id, req.body) }, 201);
}

export async function removeContributor(req: Request, res: Response) {
  const role = req.params.role as ReportContributorRole;
  return ok(res, { report: await reports.removeContributor(actor(req), req.params.id, req.params.userId, role) });
}

export async function listComments(req: Request, res: Response) {
  return ok(res, await reports.listComments(actor(req), req.params.id));
}

export async function addComment(req: Request, res: Response) {
  return ok(res, { comment: await reports.addComment(actor(req), req.params.id, req.body) }, 201);
}

export async function resolveComment(req: Request, res: Response) {
  return ok(res, await reports.resolveComment(actor(req), req.params.id, req.params.commentId));
}

export async function requestAiDraft(req: Request, res: Response) {
  return ok(res, await reports.requestAiDraft(actor(req), req.params.id), 201);
}

export async function decideAiDraft(req: Request, res: Response) {
  return ok(res, await reports.decideAiDraft(actor(req), req.params.id, req.params.suggestionId, req.body));
}

// ─── Story timeline ───

export async function timeline(req: Request, res: Response) {
  return ok(res, await stories.listTimeline(actor(req), req.params.runId));
}

export async function createStory(req: Request, res: Response) {
  const body = req.body as { category: StoryCategory; body: string; occurredAt?: Date | null };
  return ok(res, { story: await stories.createManual(actor(req), req.params.runId, body) }, 201);
}

export async function updateStory(req: Request, res: Response) {
  return ok(res, { story: await stories.updateManual(actor(req), req.params.storyId, req.body) });
}

export async function removeStory(req: Request, res: Response) {
  await stories.removeManual(actor(req), req.params.storyId);
  return ok(res, { removed: true });
}
