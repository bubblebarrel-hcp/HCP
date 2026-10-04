import { BlockKind } from '@prisma/client';
import { Request, Response } from 'express';
import * as blocks from '../services/block.service';
import * as inbox from '../services/mentions-inbox';
import * as photoTags from '../services/photo-tag.service';
import * as taggable from '../services/taggable-runs';
import { ApiError, ok } from '../utils/http';

// D60. Thin, like every other controller here.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};
const viewer = (req: Request) => (req.user ? { id: req.user.id, role: req.user.role } : undefined);
const paging = (req: Request) => req.query as unknown as { page: number; limit: number };

export const myBlocks = async (req: Request, res: Response) => ok(res, { items: await blocks.listMine(actor(req)) });
export const block = async (req: Request, res: Response) =>
  ok(res, await blocks.setRelation(actor(req), req.params.id, BlockKind.BLOCK));
export const unblock = async (req: Request, res: Response) =>
  ok(res, await blocks.clearRelation(actor(req), req.params.id, BlockKind.BLOCK));
export const mute = async (req: Request, res: Response) =>
  ok(res, await blocks.setRelation(actor(req), req.params.id, BlockKind.MUTE));
export const unmute = async (req: Request, res: Response) =>
  ok(res, await blocks.clearRelation(actor(req), req.params.id, BlockKind.MUTE));

export const myMentions = async (req: Request, res: Response) =>
  ok(res, await inbox.listMentionsOfMe(actor(req), paging(req)));
export const taggableRuns = async (req: Request, res: Response) =>
  ok(res, { items: await taggable.taggableRuns(actor(req)) });

export const photoTagList = async (req: Request, res: Response) =>
  ok(res, { items: await photoTags.listForPhoto(viewer(req), req.params.id) });
export const photoTagCreate = async (req: Request, res: Response) =>
  ok(res, await photoTags.tag(actor(req), req.params.id, req.body.userId), 201);
export const photoTagApprove = async (req: Request, res: Response) =>
  ok(res, await photoTags.decide(actor(req), req.params.id, true));
export const photoTagDecline = async (req: Request, res: Response) =>
  ok(res, await photoTags.decide(actor(req), req.params.id, false));
export const photoTagRemove = async (req: Request, res: Response) =>
  ok(res, await photoTags.remove(actor(req), req.params.id));
export const photoTagsPending = async (req: Request, res: Response) =>
  ok(res, { items: await photoTags.pendingForMe(actor(req)) });
export const photosOf = async (req: Request, res: Response) =>
  ok(res, await photoTags.photosOf(viewer(req), req.params.id, paging(req)));
