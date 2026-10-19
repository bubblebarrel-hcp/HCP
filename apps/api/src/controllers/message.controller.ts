import { Request, Response } from 'express';
import * as dm from '../services/direct-message.service';
import * as media from '../services/direct-media.service';
import { issueTicket } from '../services/realtime.service';
import { ApiError, ok } from '../utils/http';

// D71, widened by D73. Thin, like every other controller here.

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

// A browser says "audio/webm;codecs=opus"; the codec is not part of the type.
const bareType = (mime: string) => mime.split(';')[0].trim();

export const realtimeTicket = async (req: Request, res: Response) => ok(res, issueTicket(actor(req).id));

export const list = async (req: Request, res: Response) =>
  ok(res, await dm.listMine(actor(req), req.query as unknown as { box: 'inbox' | 'requests'; page: number; limit: number }));
export const unread = async (req: Request, res: Response) => ok(res, await dm.unreadFor(actor(req)));
export const start = async (req: Request, res: Response) =>
  ok(res, await dm.startWith(actor(req), req.body.userId, { kind: 'TEXT', body: req.body.body, clientKey: req.body.clientKey }), 201);
export const canMessage = async (req: Request, res: Response) => ok(res, await dm.canMessage(actor(req), req.params.id));

export const get = async (req: Request, res: Response) => ok(res, await dm.get(actor(req), req.params.id, { open: req.query.open === '1' }));
export const messages = async (req: Request, res: Response) => {
  const q = req.query as unknown as { before?: string; after?: string; limit: number };
  return ok(res, q.after ? await dm.messagesAfter(actor(req), req.params.id, q.after) : await dm.messages(actor(req), req.params.id, q));
};
export const send = async (req: Request, res: Response) => ok(res, await dm.send(actor(req), req.params.id, req.body), 201);
export const edit = async (req: Request, res: Response) => ok(res, await dm.edit(actor(req), req.params.id, req.body.body));
export const read = async (req: Request, res: Response) => ok(res, await dm.markRead(actor(req), req.params.id));
export const accept = async (req: Request, res: Response) => ok(res, await dm.accept(actor(req), req.params.id));
export const decline = async (req: Request, res: Response) => ok(res, await dm.decline(actor(req), req.params.id));
export const mute = async (req: Request, res: Response) => ok(res, await dm.setMuted(actor(req), req.params.id, req.body.muted));
export const archive = async (req: Request, res: Response) => ok(res, await dm.archive(actor(req), req.params.id));
export const active = async (req: Request, res: Response) => ok(res, await dm.setActive(actor(req), req.params.id, true));
export const inactive = async (req: Request, res: Response) => ok(res, await dm.setActive(actor(req), req.params.id, false));
export const forward = async (req: Request, res: Response) =>
  ok(res, await dm.forward(actor(req), req.params.id, req.body.messageIds, req.body.toConversationIds));
export const pin = async (req: Request, res: Response) => ok(res, await dm.pin(actor(req), req.params.id, req.body.pinned));

// Files (D73).
export const requestUpload = async (req: Request, res: Response) =>
  ok(res, await media.requestAttachmentUpload(actor(req), req.params.id, { ...req.body, mimeType: bareType(req.body.mimeType) }), 201);
export const confirmUpload = async (req: Request, res: Response) =>
  ok(res, { attachment: await media.confirmAttachment(actor(req), req.params.id, req.body) });

// Stickers (D73).
export const listStickers = async (req: Request, res: Response) => ok(res, await media.listStickers(actor(req)));
export const requestStickerUpload = async (req: Request, res: Response) =>
  ok(res, await media.requestStickerUpload(actor(req), { ...req.body, mimeType: bareType(req.body.mimeType) }), 201);
export const confirmSticker = async (req: Request, res: Response) => ok(res, { sticker: await media.confirmSticker(actor(req), req.params.id) });
export const deleteSticker = async (req: Request, res: Response) => ok(res, await media.deleteSticker(actor(req), req.params.id));
export const favoriteSticker = async (req: Request, res: Response) => ok(res, await media.setFavorite(actor(req), req.params.id, true));
export const unfavoriteSticker = async (req: Request, res: Response) => ok(res, await media.setFavorite(actor(req), req.params.id, false));
