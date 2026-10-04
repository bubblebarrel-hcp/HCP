import { Router } from 'express';
import Joi from 'joi';
import * as controller from '../controllers/safety.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { uuid } from '../validators/common';

// Mounted at /api/v1 (D60): blocking and muting, the mentions inbox, runs a post
// can be about, and photo tags. Everything here only takes things away or asks
// before it shows something (D8: nothing opens a channel between two hashers).
const router = Router();

const paging = validate(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
  'query',
);

router.get('/me/blocks', requireAuth, asyncHandler(controller.myBlocks));
router.put('/hashers/:id/block', requireAuth, asyncHandler(controller.block));
router.delete('/hashers/:id/block', requireAuth, asyncHandler(controller.unblock));
router.put('/hashers/:id/mute', requireAuth, asyncHandler(controller.mute));
router.delete('/hashers/:id/mute', requireAuth, asyncHandler(controller.unmute));

router.get('/me/mentions', requireAuth, paging, asyncHandler(controller.myMentions));
router.get('/me/taggable-runs', requireAuth, asyncHandler(controller.taggableRuns));

router.get('/photos/:id/tags', optionalAuth, asyncHandler(controller.photoTagList));
router.post(
  '/photos/:id/tags',
  requireAuth,
  validate(Joi.object({ userId: uuid.required() })),
  asyncHandler(controller.photoTagCreate),
);
router.post('/photo-tags/:id/approve', requireAuth, asyncHandler(controller.photoTagApprove));
router.post('/photo-tags/:id/decline', requireAuth, asyncHandler(controller.photoTagDecline));
router.post('/photo-tags/:id/remove', requireAuth, asyncHandler(controller.photoTagRemove));
router.get('/me/photo-tags/pending', requireAuth, asyncHandler(controller.photoTagsPending));
router.get('/hashers/:id/tagged-photos', optionalAuth, paging, asyncHandler(controller.photosOf));

export default router;
