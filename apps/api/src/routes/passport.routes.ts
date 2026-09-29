import { Router } from 'express';
import * as controller from '../controllers/passport.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { addMemorySchema } from '../validators/passport.validator';

// Mounted at /api/v1. A passport belongs to its hasher; the only way anyone else
// sees one is the read-only share link (FR-PASSPORT-007).
const router = Router();

router.get('/passports/shared/:shareToken', asyncHandler(controller.shared));

router.get('/me/passport', requireAuth, asyncHandler(controller.mine));
router.get('/me/passport/timeline', requireAuth, asyncHandler(controller.timeline));
router.post('/me/passport/share/rotate', requireAuth, asyncHandler(controller.rotateShare));
router.post('/me/passport/memories', requireAuth, validate(addMemorySchema), asyncHandler(controller.addMemory));
router.delete('/me/passport/memories/:id', requireAuth, asyncHandler(controller.removeMemory));

export default router;
