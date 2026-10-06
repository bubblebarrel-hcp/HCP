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
// Their photos, gated by their profile and by what each photo is on (D57).
router.get('/hashers/:id/photos', optionalAuth, paging, asyncHandler(controller.hasherPhotos));

// Following a kennel is not joining it: no membership, no vote, no authority.
router.get('/kennels/:slug/follow', optionalAuth, asyncHandler(controller.kennelFollowState));
router.post('/kennels/:slug/follow', requireAuth, asyncHandler(controller.followKennel));
router.delete('/kennels/:slug/follow', requireAuth, asyncHandler(controller.unfollowKennel));
router.get('/kennels/:slug/followers', optionalAuth, paging, asyncHandler(controller.kennelFollowers));
// The roll, for the kennel's own members. `/members` is the officers' review queue.
router.get('/kennels/:slug/roster', requireAuth, paging, asyncHandler(controller.kennelRoster));

// A locked profile's follow requests (D57): approve, decline, or remove a follower.
router.get('/me/follow-requests', requireAuth, paging, asyncHandler(controller.requests));
router.post('/me/follow-requests/:followerId/approve', requireAuth, asyncHandler(controller.approveRequest));
router.post('/me/follow-requests/:followerId/decline', requireAuth, asyncHandler(controller.declineRequest));
router.delete('/me/followers/:followerId', requireAuth, asyncHandler(controller.removeFollower));

router.get('/me/following', requireAuth, paging, asyncHandler(controller.myFollowing));
router.get('/me/followers', requireAuth, paging, asyncHandler(controller.myFollowers));

export default router;
