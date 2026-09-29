import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as verification from '../services/verification.service';
import * as passwordReset from '../services/password-reset.service';
import { ApiError, ok } from '../utils/http';

// register/login/refresh return tokens alongside the user. The BFF proxy in the
// Next apps strips them before anything reaches a browser; the mobile app keeps
// them in secure storage.

export async function register(req: Request, res: Response) {
  return ok(res, await authService.register(req.body), 201);
}

export async function login(req: Request, res: Response) {
  return ok(res, await authService.login(req.body.email, req.body.password));
}

export async function refresh(req: Request, res: Response) {
  return ok(res, await authService.refresh(req.body.refreshToken));
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body?.refreshToken);
  return ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, { user: await authService.me(req.user.id) });
}

export async function verifyEmail(req: Request, res: Response) {
  return ok(res, await verification.verifyEmail(req.body.token));
}

// Always 200, whatever the address: this endpoint must not reveal who has an
// account here.
export async function resendVerification(req: Request, res: Response) {
  await verification.resendVerification(req.body.email);
  return ok(res, { sent: true });
}

// Always 200: this endpoint must not reveal who has an account here.
export async function requestPasswordReset(req: Request, res: Response) {
  await passwordReset.requestPasswordReset(req.body.email);
  return ok(res, { sent: true });
}

export async function resetPassword(req: Request, res: Response) {
  await passwordReset.resetPassword(req.body.token, req.body.password);
  return ok(res, { reset: true });
}
