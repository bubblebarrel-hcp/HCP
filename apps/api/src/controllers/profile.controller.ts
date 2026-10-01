import { Request, Response } from 'express';
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
