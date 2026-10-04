import { Router } from 'express';
import * as controller from '../controllers/moderation.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { actionSchema, fileReportSchema, queueQuery } from '../validators/moderation.validator';

// Mounted at /api/v1 (D61). Filing, and a kennel's own moderation queue. Platform
// staff's queue is under /admin/reports (admin.routes.ts), behind the admin gate.
const router = Router();

router.post('/reports', requireAuth, validate(fileReportSchema), asyncHandler(controller.file));
router.get('/me/reports', requireAuth, asyncHandler(controller.mine));

// A kennel's moderators (`media.moderate`): content made in their kennel. The
// service is the judge of who may.
router.get('/kennels/:slug/reports', requireAuth, validate(queueQuery, 'query'), asyncHandler(controller.queue));
router.get('/kennels/:slug/reports/counts', requireAuth, asyncHandler(controller.counts));
router.get('/kennels/:slug/reports/:id', requireAuth, asyncHandler(controller.detail));
router.post('/kennels/:slug/reports/:id/actions', requireAuth, validate(actionSchema), asyncHandler(controller.act));

export default router;
