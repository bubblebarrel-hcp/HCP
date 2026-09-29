import { Router } from 'express';
import * as controller from '../controllers/invitation.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { createInvitationSchema } from '../validators/invitation.validator';

// Mounted at /api/v1. FR-MEMBER-005: the officer-facing routes sit under a
// kennel; the redeem routes are token-addressed and reachable by anyone
// holding the link, same shape as email verification and password reset.
const router = Router();

router.get('/kennels/:slug/invitations', requireAuth, asyncHandler(controller.list));
router.post('/kennels/:slug/invitations', requireAuth, validate(createInvitationSchema), asyncHandler(controller.create));
router.post('/invitations/:id/revoke', requireAuth, asyncHandler(controller.revoke));

// Preview is anonymous (deciding whether to log in first); accepting needs a
// session, since it is the one path that seats someone as a member directly.
router.get('/invitations/token/:token', asyncHandler(controller.preview));
router.post('/invitations/token/:token/accept', requireAuth, asyncHandler(controller.accept));

export default router;
