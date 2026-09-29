import { Router } from 'express';
import * as controller from '../controllers/membership.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  approveMembershipSchema,
  listMembersQuery,
  rejectMembershipSchema,
  reinstateMembershipSchema,
  removeMembershipSchema,
  requestMembershipSchema,
  resignMembershipSchema,
  setHomeKennelSchema,
  suspendMembershipSchema,
  withdrawMembershipSchema,
} from '../validators/membership.validator';

// Mounted at /api/v1. Authentication is checked here; kennel authority is
// checked in membership.service against the database (PERMISSION-MATRIX.md).
const router = Router();

router.get('/me/memberships', requireAuth, asyncHandler(controller.mine));
// FR-MEMBER-007. Pointer only — every Membership row keeps its own history.
router.patch('/me/home-kennel', requireAuth, validate(setHomeKennelSchema), asyncHandler(controller.setHomeKennel));

router.get('/kennels/:slug/membership', optionalAuth, asyncHandler(controller.viewer));
router.post(
  '/kennels/:slug/memberships',
  requireAuth,
  validate(requestMembershipSchema),
  asyncHandler(controller.request),
);
router.get('/kennels/:slug/members', requireAuth, validate(listMembersQuery, 'query'), asyncHandler(controller.listMembers));

router.get('/memberships/:id/timeline', requireAuth, asyncHandler(controller.timeline));
router.post('/memberships/:id/approve', requireAuth, validate(approveMembershipSchema), asyncHandler(controller.approve));
router.post('/memberships/:id/reject', requireAuth, validate(rejectMembershipSchema), asyncHandler(controller.reject));
router.post('/memberships/:id/suspend', requireAuth, validate(suspendMembershipSchema), asyncHandler(controller.suspend));
router.post(
  '/memberships/:id/reinstate',
  requireAuth,
  validate(reinstateMembershipSchema),
  asyncHandler(controller.reinstate),
);
router.post('/memberships/:id/remove', requireAuth, validate(removeMembershipSchema), asyncHandler(controller.remove));
router.post('/memberships/:id/resign', requireAuth, validate(resignMembershipSchema), asyncHandler(controller.resign));
router.post('/memberships/:id/withdraw', requireAuth, validate(withdrawMembershipSchema), asyncHandler(controller.withdraw));

export default router;
