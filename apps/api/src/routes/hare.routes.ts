import { Router } from 'express';
import * as controller from '../controllers/hare.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  declineOfferSchema,
  offerToHareSchema,
  runsNeedingHaresQuery,
  withdrawOfferSchema,
} from '../validators/hare.validator';

// Mounted at /api/v1. Offering to hare a run, and answering an offer (D44).
const router = Router();

// The dates a kennel has set and not yet hared. Readable signed out: a visitor
// weighing up a kennel should see that it needs hares.
router.get(
  '/runs/needing-hares',
  optionalAuth,
  validate(runsNeedingHaresQuery, 'query'),
  asyncHandler(controller.needingHares),
);

router.get('/runs/:runId/hare-offers', requireAuth, asyncHandler(controller.listForRun));
router.post(
  '/runs/:runId/hare-offers',
  requireAuth,
  validate(offerToHareSchema),
  asyncHandler(controller.offer),
);
router.post(
  '/hare-offers/:id/withdraw',
  requireAuth,
  validate(withdrawOfferSchema),
  asyncHandler(controller.withdraw),
);
// Answering is run.manage: a trail is the kennel's name on the line.
router.post('/hare-offers/:id/accept', requireAuth, asyncHandler(controller.accept));
router.post('/hare-offers/:id/decline', requireAuth, validate(declineOfferSchema), asyncHandler(controller.decline));

export default router;
