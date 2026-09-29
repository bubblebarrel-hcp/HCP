import { Router } from 'express';
import * as controller from '../controllers/reel.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  createReelSchema,
  feedQuery,
  listReelsQuery,
  removeReelSchema,
  updateReelSchema,
} from '../validators/reel.validator';

// Mounted at /api/v1. Reels (D41) and the community feed they sit above (D42).
// Reading either signed out is normal; posting is not.
const router = Router();

router.get('/feed', optionalAuth, validate(feedQuery, 'query'), asyncHandler(controller.communityFeed));

router.get('/reels', optionalAuth, validate(listReelsQuery, 'query'), asyncHandler(controller.list));
router.post('/reels', requireAuth, validate(createReelSchema), asyncHandler(controller.create));
router.get('/reels/:id', optionalAuth, asyncHandler(controller.detail));
router.patch('/reels/:id', requireAuth, validate(updateReelSchema), asyncHandler(controller.update));
router.post('/reels/:id/publish', requireAuth, asyncHandler(controller.publish));
router.post('/reels/:id/archive', requireAuth, asyncHandler(controller.archive));
// Moderation: the kennel's media moderators, or platform staff for a reel that
// belongs to no kennel.
router.post('/reels/:id/remove', requireAuth, validate(removeReelSchema), asyncHandler(controller.remove));
// A tally, not a decision: no session needed to watch.
router.post('/reels/:id/views', optionalAuth, asyncHandler(controller.countView));

export default router;
