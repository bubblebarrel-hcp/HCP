import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import * as controller from '../controllers/run.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  awardSchema,
  circleAttendanceSchema,
  circleSchema,
  createRunSchema,
  guestSchema,
  listRunsQuery,
  revertCheckInSchema,
  rsvpSchema,
  runActionSchema,
  updateRunSchema,
} from '../validators/run.validator';

// Mounted at /api/v1. Authentication is checked here; run visibility and
// authority are checked in run.service against the database (PERMISSION-MATRIX.md).
const router = Router();

// Guest registration is the one unauthenticated write, so it is rate limited.
const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many registrations. Try again shortly.', code: 'RATE_LIMITED' } },
});

router.get('/runs', optionalAuth, validate(listRunsQuery, 'query'), asyncHandler(controller.list));
router.get('/kennels/:slug/runs', optionalAuth, validate(listRunsQuery, 'query'), asyncHandler(controller.kennelRuns));
router.get('/kennels/:slug/runs/planning', requireAuth, asyncHandler(controller.planning));
router.post('/kennels/:slug/runs', requireAuth, validate(createRunSchema), asyncHandler(controller.create));

router.get('/runs/:id', optionalAuth, asyncHandler(controller.detail));
router.patch('/runs/:id', requireAuth, validate(updateRunSchema), asyncHandler(controller.update));
router.post('/runs/:id/actions/:action', requireAuth, validate(runActionSchema), asyncHandler(controller.act));

router.put('/runs/:id/rsvp', requireAuth, validate(rsvpSchema), asyncHandler(controller.rsvp));
router.delete('/runs/:id/rsvp', requireAuth, asyncHandler(controller.withdraw));
router.post('/runs/:id/check-in', requireAuth, asyncHandler(controller.checkIn));
router.post('/runs/:id/guests', guestLimiter, optionalAuth, validate(guestSchema), asyncHandler(controller.registerGuest));
router.post(
  '/runs/:id/participants/:participationId/check-in',
  requireAuth,
  asyncHandler(controller.checkInParticipant),
);
router.delete(
  '/runs/:id/participants/:participationId/check-in',
  requireAuth,
  validate(revertCheckInSchema),
  asyncHandler(controller.revertCheckIn),
);

router.patch('/runs/:id/circle', requireAuth, validate(circleSchema), asyncHandler(controller.updateCircle));
router.post(
  '/runs/:id/circle/attendance',
  requireAuth,
  validate(circleAttendanceSchema),
  asyncHandler(controller.recordCircleAttendance),
);
router.delete('/runs/:id/circle/attendance/:attendeeId', requireAuth, asyncHandler(controller.removeCircleAttendee));
router.post('/runs/:id/circle/awards', requireAuth, validate(awardSchema), asyncHandler(controller.addAward));
router.delete('/runs/:id/circle/awards/:awardId', requireAuth, asyncHandler(controller.removeAward));

export default router;
