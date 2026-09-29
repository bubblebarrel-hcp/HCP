import { Router } from 'express';
import * as controller from '../controllers/capsule.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { capsuleActionSchema, listCapsulesQuery, supplementSchema } from '../validators/capsule.validator';

// Mounted at /api/v1. The Run Capsule is the canonical historical record of a
// run: assembled automatically, published by a human, then enriched but never
// rewritten (Annex 08H).
const router = Router();

router.get('/capsules', optionalAuth, validate(listCapsulesQuery, 'query'), asyncHandler(controller.list));
router.get('/capsules/:id', optionalAuth, asyncHandler(controller.detail));

// One capsule per run (BR-CAPSULE-002), so the run is the other way in.
router.get('/runs/:runId/capsule', optionalAuth, asyncHandler(controller.forRun));

router.post(
  '/capsules/:id/actions/:action',
  requireAuth,
  validate(capsuleActionSchema),
  asyncHandler(controller.transition),
);

// BR-CAPSULE-005: enrichment after publication never changes the record.
router.post('/capsules/:id/supplements', requireAuth, validate(supplementSchema), asyncHandler(controller.addSupplement));

export default router;
