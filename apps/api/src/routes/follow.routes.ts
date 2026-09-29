import { Router } from 'express';
import * as controller from '../controllers/follow.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { listQuery } from '../validators/engagement.validator';

// Mounted at /api/v1. The social graph (D50).
//
// `/hashers/:id` is the public face of a person: public identity only (D11),
// never biodata. It exists because following somebody needs somewhere to press
// follow.
const router = Router();

const paging = validate(listQuery, 'query');

router.get('/hashers/:id', optionalAuth, asyncHandler(controller.profile));
router.get('/hashers/:id/follow', optionalAuth, asyncHandler(controller.hasherFollowState));
router.post('/hashers/:id/follow', requireAuth, asyncHandler(controller.followHasher));
router.delete('/hashers/:id/follow', requireAuth, asyncHandler(controller.unfollowHasher));
router.get('/hashers/:id/followers', optionalAuth, paging, asyncHandler(controller.followers));
router.get('/hashers/:id/following', optionalAuth, paging, asyncHandler(controller.following));

// Following a kennel is not joining it: no membership, no vote, no authority.
router.get('/kennels/:slug/follow', optionalAuth, asyncHandler(controller.kennelFollowState));
router.post('/kennels/:slug/follow', requireAuth, asyncHandler(controller.followKennel));
router.delete('/kennels/:slug/follow', requireAuth, asyncHandler(controller.unfollowKennel));
router.get('/kennels/:slug/followers', optionalAuth, paging, asyncHandler(controller.kennelFollowers));

router.get('/me/following', requireAuth, paging, asyncHandler(controller.myFollowing));
router.get('/me/followers', requireAuth, paging, asyncHandler(controller.myFollowers));

export default router;
