import { Router } from 'express';
import { PlatformRole } from '@prisma/client';
import * as adminController from '../controllers/admin.controller';
import * as moderationController from '../controllers/moderation.controller';
import * as kennelController from '../controllers/kennel.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { createKennelSchema, listKennelsQuery, updateKennelSchema } from '../validators/kennel.validator';
import { actionSchema, queueQuery } from '../validators/moderation.validator';
import {
  auditQuery,
  contentQuery,
  eventsQuery,
  listUsersQuery,
  membershipsQuery,
  runsQuery,
  takedownSchema,
  updateSettingSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../validators/admin.validator';

// Platform admin boundary. Applied once at the top so a route added later
// cannot ship open by accident.
const router = Router();
router.use(requireAuth, requireRole(PlatformRole.ADMIN));

router.get('/stats', asyncHandler(adminController.stats));

router.get('/kennels', validate(listKennelsQuery, 'query'), asyncHandler(kennelController.listAdmin));
// Before '/kennels/:id', or 'pending' is read as an id and 404s on the uuid guard.
router.get('/kennels/pending', asyncHandler(adminController.pendingKennels));
router.get('/kennels/:id', asyncHandler(kennelController.getAdmin));
router.post('/kennels', validate(createKennelSchema), asyncHandler(kennelController.create));
router.patch('/kennels/:id', validate(updateKennelSchema), asyncHandler(kennelController.update));
router.delete('/kennels/:id', asyncHandler(kennelController.remove));

// Runs the hare reminder sweep now rather than on its twelve-hour timer (D45).
router.post('/reminders/hares', asyncHandler(adminController.sweepHareReminders));
router.post('/notifications/digests', asyncHandler(adminController.sweepDigests));
router.post('/notifications/escalations', asyncHandler(adminController.sweepEscalations));

router.get('/users', validate(listUsersQuery, 'query'), asyncHandler(adminController.listUsers));
router.patch('/users/:id/role', validate(updateUserRoleSchema), asyncHandler(adminController.updateUserRole));
router.patch('/users/:id/status', validate(updateUserStatusSchema), asyncHandler(adminController.updateUserStatus));

// Reports and moderation (D61): platform staff see every report and may do
// everything about it. Before ':id', or 'counts' is read as one.
router.get('/reports', validate(queueQuery, 'query'), asyncHandler(moderationController.queue));
router.get('/reports/counts', asyncHandler(moderationController.counts));
router.get('/reports/:id', asyncHandler(moderationController.detail));
router.post('/reports/:id/actions', validate(actionSchema), asyncHandler(moderationController.act));

// Governance record and event stream (append-only; read here, never edited).
router.get('/audit', validate(auditQuery, 'query'), asyncHandler(adminController.listAudit));
// Before any ':id' route should one be added, or 'health' is read as an id.
router.get('/events/health', asyncHandler(adminController.eventsHealth));
router.get('/events', validate(eventsQuery, 'query'), asyncHandler(adminController.listEvents));

router.get('/settings', asyncHandler(adminController.listSettings));
router.patch('/settings/:key', validate(updateSettingSchema), asyncHandler(adminController.updateSetting));

// Read-only oversight: a kennel decides its members, the platform sees them.
router.get('/memberships', validate(membershipsQuery, 'query'), asyncHandler(adminController.listMemberships));
router.get('/verification-readiness', asyncHandler(adminController.verificationReadiness));
router.get('/runs', validate(runsQuery, 'query'), asyncHandler(adminController.listRuns));
router.get('/runs/awaiting-report', asyncHandler(adminController.runsAwaitingReport));

router.get('/posts', validate(contentQuery, 'query'), asyncHandler(adminController.listPosts));
router.post('/posts/:id/remove', validate(takedownSchema), asyncHandler(adminController.takedownPost));
router.get('/reels', validate(contentQuery, 'query'), asyncHandler(adminController.listReels));
router.post('/reels/:id/remove', validate(takedownSchema), asyncHandler(adminController.takedownReel));

export default router;
