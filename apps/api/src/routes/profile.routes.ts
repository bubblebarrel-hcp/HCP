import { Router } from 'express';
import * as controller from '../controllers/profile.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async';
import {
  confirmPasswordSchema,
  deleteAccountSchema,
  privacySchema,
  profileImagesSchema,
  updateProfileSchema,
} from '../validators/profile.validator';

const router = Router();

// D5/FR-ID-005: a hasher's own biodata, private even from other hashers.
router.get('/me/profile', requireAuth, asyncHandler(controller.getProfile));
router.patch('/me/profile', requireAuth, validate(updateProfileSchema), asyncHandler(controller.updateProfile));

// D56: the picture and banner on a hasher's public page. Public identity, so it
// is separate from the private biodata above.
router.patch('/me/profile-images', requireAuth, validate(profileImagesSchema), asyncHandler(controller.setProfileImages));

// D57: who sees what I make, stepping away, and leaving. Deactivating hides the
// hasher and ends every session until they sign back in; deleting removes the
// person and keeps the record, and cannot be undone.
router.get('/me/privacy', requireAuth, asyncHandler(controller.getPrivacy));
router.patch('/me/privacy', requireAuth, validate(privacySchema), asyncHandler(controller.setPrivacy));
router.post('/me/deactivate', requireAuth, validate(confirmPasswordSchema), asyncHandler(controller.deactivate));
router.post('/me/delete', requireAuth, validate(deleteAccountSchema), asyncHandler(controller.deleteAccount));

export default router;
