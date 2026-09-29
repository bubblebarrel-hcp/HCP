import express, { Router } from 'express';
import { env } from '../config/env';
import * as controller from '../controllers/media.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  confirmUploadSchema,
  listMediaQuery,
  moderateMediaSchema,
  requestUploadSchema,
} from '../validators/media.validator';

// Mounted at /api/v1. Uploads go straight from the browser to storage: the API
// hands out a presigned target and is told when the bytes landed.
const router = Router();

router.get('/media', optionalAuth, validate(listMediaQuery, 'query'), asyncHandler(controller.list));
router.post('/media/uploads', requireAuth, validate(requestUploadSchema), asyncHandler(controller.requestUpload));
router.post('/media/:id/confirm', requireAuth, validate(confirmUploadSchema), asyncHandler(controller.confirmUpload));
router.post('/media/:id/moderate', requireAuth, validate(moderateMediaSchema), asyncHandler(controller.moderate));
router.get('/media/:id', requireAuth, asyncHandler(controller.detail));

// The local driver's receiving end. With R2 configured this route is never used:
// the presigned URL points at Cloudflare instead.
router.put(
  '/media/local/*',
  express.raw({ type: '*/*', limit: env.media.maxUploadBytes }),
  asyncHandler(controller.putLocalObject),
);

export default router;
