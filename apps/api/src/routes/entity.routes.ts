import { Router } from 'express';
import * as controller from '../controllers/entity.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { mentionSuggestQuery, trendingQuery, usernameSchema } from '../validators/entity.validator';

// Mounted at /api/v1. Hashtags and mentions (D59).
//
// What is under a tag is read through /posts?tag= and /reels?tag=, which apply
// the same audience rules as every other list; there is no tag endpoint that
// returns content, so a tag cannot be a way around them.
const router = Router();

router.get('/tags/trending', optionalAuth, validate(trendingQuery, 'query'), asyncHandler(controller.trending));
router.get('/mentions/suggest', requireAuth, validate(mentionSuggestQuery, 'query'), asyncHandler(controller.suggest));
router.get('/usernames/:username', optionalAuth, asyncHandler(controller.byUsername));
router.patch('/me/username', requireAuth, validate(usernameSchema), asyncHandler(controller.setUsername));

export default router;
