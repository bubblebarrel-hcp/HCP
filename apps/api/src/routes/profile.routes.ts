import { Router } from 'express';
import * as controller from '../controllers/profile.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { updateProfileSchema } from '../validators/profile.validator';

const router = Router();

// D5/FR-ID-005: a hasher's own biodata, private even from other hashers.
router.get('/me/profile', requireAuth, asyncHandler(controller.getProfile));
router.patch('/me/profile', requireAuth, validate(updateProfileSchema), asyncHandler(controller.updateProfile));

export default router;
