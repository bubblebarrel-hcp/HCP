import { Router } from 'express';
import * as controller from '../controllers/profile.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import { profileImagesSchema, updateProfileSchema } from '../validators/profile.validator';

const router = Router();

// D5/FR-ID-005: a hasher's own biodata, private even from other hashers.
router.get('/me/profile', requireAuth, asyncHandler(controller.getProfile));
router.patch('/me/profile', requireAuth, validate(updateProfileSchema), asyncHandler(controller.updateProfile));

// D56: the picture and banner on a hasher's public page. Public identity, so it
// is separate from the private biodata above.
router.patch('/me/profile-images', requireAuth, validate(profileImagesSchema), asyncHandler(controller.setProfileImages));

export default router;
