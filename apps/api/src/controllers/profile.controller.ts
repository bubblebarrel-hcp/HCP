import { Request, Response } from 'express';
import * as account from '../services/account.service';
import * as profileService from '../services/profile.service';
import { ApiError, ok } from '../utils/http';

export async function getProfile(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await profileService.getProfile(req.user.id));
}

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await profileService.updateProfile(req.user.id, req.body));
}

export async function setProfileImages(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await profileService.setProfileImages(req.user.id, req.body));
}

// D57: who sees what I make, stepping away, and leaving.
export async function getPrivacy(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await account.getPrivacy(req.user.id));
}

export async function setPrivacy(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await account.setProfileVisibility(req.user.id, req.body.profileVisibility));
}

export async function deactivate(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await account.deactivate(req.user.id, req.body.password));
}

export async function deleteAccount(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await account.deleteAccount(req.user.id, req.body.password));
}
