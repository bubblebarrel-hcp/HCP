import { Request, Response } from 'express';
import * as dm from '../services/direct-message.service';
import { issueTicket } from '../services/realtime.service';
import { ApiError, ok } from '../utils/http';

// D71. Thin, like every other controller here.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

export const realtimeTicket = async (req: Request, res: Response) => ok(res, issueTicket(actor(req).id));

export const list = async (req: Request, res: Response) =>
  ok(res, await dm.listMine(actor(req), req.query as unknown as { box: 'inbox' | 'requests'; page: number; limit: number }));
export const unread = async (req: Request, res: Response) => ok(res, await dm.unreadCount(actor(req)));
export const start = async (req: Request, res: Response) =>
  ok(res, await dm.startWith(actor(req), req.body.userId, req.body.body, req.body.clientKey), 201);
export const canMessage = async (req: Request, res: Response) => ok(res, await dm.canMessage(actor(req), req.params.id));

export const get = async (req: Request, res: Response) => ok(res, await dm.get(actor(req), req.params.id));
export const messages = async (req: Request, res: Response) => {
  const q = req.query as unknown as { before?: string; after?: string; limit: number };
  return ok(res, q.after ? await dm.messagesAfter(actor(req), req.params.id, q.after) : await dm.messages(actor(req), req.params.id, q));
};
export const send = async (req: Request, res: Response) =>
  ok(res, await dm.send(actor(req), req.params.id, req.body.body, req.body.clientKey), 201);
export const read = async (req: Request, res: Response) => ok(res, await dm.markRead(actor(req), req.params.id));
export const accept = async (req: Request, res: Response) => ok(res, await dm.accept(actor(req), req.params.id));
export const decline = async (req: Request, res: Response) => ok(res, await dm.decline(actor(req), req.params.id));
export const mute = async (req: Request, res: Response) => ok(res, await dm.setMuted(actor(req), req.params.id, req.body.muted));
export const archive = async (req: Request, res: Response) => ok(res, await dm.archive(actor(req), req.params.id));
export const unsend = async (req: Request, res: Response) => ok(res, await dm.unsend(actor(req), req.params.id));
