import { Router } from 'express';
import * as controller from '../controllers/post.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  createPostSchema,
  listPostsQuery,
  pollVoteSchema,
  removePostSchema,
  updatePostSchema,
} from '../validators/post.validator';

// Mounted at /api/v1. A hasher's written post (D51).
//
// The same create/upload/publish shape reels use (D28, D48): the draft exists
// so photos have somewhere to land. A post with no photos goes through both
// steps too; the composer just does them back to back.
const router = Router();

router.get('/posts', optionalAuth, validate(listPostsQuery, 'query'), asyncHandler(controller.list));
router.post('/posts', requireAuth, validate(createPostSchema), asyncHandler(controller.create));
router.get('/posts/:id', optionalAuth, asyncHandler(controller.detail));
router.patch('/posts/:id', requireAuth, validate(updatePostSchema), asyncHandler(controller.update));
router.post('/posts/:id/poll/vote', requireAuth, validate(pollVoteSchema), asyncHandler(controller.pollVote));
router.post('/posts/:id/publish', requireAuth, asyncHandler(controller.publish));
router.post('/posts/:id/archive', requireAuth, asyncHandler(controller.archive));
// Moderation: the kennel's media moderators, or platform staff for a post made
// outside a kennel.
router.post('/posts/:id/remove', requireAuth, validate(removePostSchema), asyncHandler(controller.remove));

export default router;
