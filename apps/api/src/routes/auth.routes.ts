import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.post('/logout', validate(logoutSchema), asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));

// FR-AUTH-002 (D31). Both are anonymous: the whole point is that the person
// cannot sign in yet.
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(controller.verifyEmail));
router.post('/verification/resend', validate(resendVerificationSchema), asyncHandler(controller.resendVerification));

// Password reset (FR-AUTH). Both anonymous, same non-enumeration shape as
// email verification above.
router.post('/password/forgot', validate(requestPasswordResetSchema), asyncHandler(controller.requestPasswordReset));
router.post('/password/reset', validate(resetPasswordSchema), asyncHandler(controller.resetPassword));

export default router;
