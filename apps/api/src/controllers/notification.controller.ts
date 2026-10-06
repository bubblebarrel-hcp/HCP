import { Request, Response } from 'express';
import * as notifications from '../services/notification.service';
import type { Actor } from '../services/permission.service';
import { ApiError, ok } from '../utils/http';

function actor(req: Request): Actor {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export async function list(req: Request, res: Response) {
  const { page, limit, unread } = req.query as unknown as { page: number; limit: number; unread: boolean };
  return ok(res, await notifications.listMine(actor(req), { page, limit, unreadOnly: unread }));
}

export async function unreadCount(req: Request, res: Response) {
  return ok(res, await notifications.unreadCount(actor(req)));
}

export async function markRead(req: Request, res: Response) {
  await notifications.markRead(actor(req), req.params.id);
  return ok(res, await notifications.unreadCount(actor(req)));
}

export async function markAllRead(req: Request, res: Response) {
  const result = await notifications.markAllRead(actor(req));
  return ok(res, { ...result, unread: 0 });
}

export async function getPreferences(req: Request, res: Response) {
  return ok(res, await notifications.getPreferences(actor(req)));
}

export async function updatePreferences(req: Request, res: Response) {
  return ok(res, await notifications.updatePreferences(actor(req), req.body.preferences));
}

export async function setQuietHours(req: Request, res: Response) {
  return ok(res, await notifications.setQuietHours(actor(req), req.body.quietHours));
}

export async function setDigest(req: Request, res: Response) {
  return ok(res, await notifications.setDigest(actor(req), req.body.category, req.body.frequency));
}

export async function setTimeZone(req: Request, res: Response) {
  return ok(res, await notifications.setTimeZone(actor(req), req.body.timeZone));
}

export async function listDevices(req: Request, res: Response) {
  return ok(res, await notifications.listDevices(actor(req)));
}

// D12: the mobile app hands over the Expo token it got from the OS. Registering
// the same token again moves it to whoever is signed in now.
export async function registerDevice(req: Request, res: Response) {
  return ok(res, await notifications.registerMyDevice(actor(req), req.body.pushToken, req.body.platform), 201);
}

export async function revokeDevice(req: Request, res: Response) {
  return ok(res, await notifications.revokeMyDevice(actor(req), req.body.pushToken));
}
