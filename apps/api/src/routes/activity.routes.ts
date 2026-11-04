import { Router } from 'express';
import * as controller from '../controllers/activity.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { listActivitiesSchema, recordActivitySchema, updateActivitySchema } from '../validators/activity.validator';
import { paging } from '../validators/common';

// Mounted at /api/v1. A recording is its hasher's own (D79); everyone else is
// answered 404 for what they may not see.
const router = Router();

router.post('/me/activities', requireAuth, validate(recordActivitySchema), asyncHandler(controller.record));
router.get('/me/activities', requireAuth, validate(listActivitiesSchema, 'query'), asyncHandler(controller.mine));
router.get('/hashers/:userId/activities', optionalAuth, validate(paging, 'query'), asyncHandler(controller.forHasher));

router.get('/activities/:id', optionalAuth, asyncHandler(controller.get));
router.patch('/activities/:id', requireAuth, validate(updateActivitySchema), asyncHandler(controller.update));
router.delete('/activities/:id', requireAuth, asyncHandler(controller.remove));

export default router;
