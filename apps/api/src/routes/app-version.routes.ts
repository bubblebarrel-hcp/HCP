import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { versionPolicy } from '../services/app-version.service';
import { asyncHandler } from '../utils/async';
import { ok } from '../utils/http';

// Public and read-only: a phone that is too old cannot be expected to sign in
// first, so the gate has to be answerable without a token.
const router = Router();

router.get(
  '/app-version',
  validate(Joi.object({ platform: Joi.string().valid('android', 'ios').default('android') }), 'query'),
  asyncHandler(async (req, res) => ok(res, await versionPolicy(req.query.platform as 'android' | 'ios'))),
);

export default router;
