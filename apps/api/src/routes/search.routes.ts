import { Router } from 'express';
import * as controller from '../controllers/search.controller';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { searchQuery } from '../validators/search.validator';

// Mounted at /api/v1. Annex 08Q, scoped MVP: one global search across
// kennels, runs, trail reports, hashers and Run Capsules. Reading is
// signed-out-friendly, same as every other discovery surface.
const router = Router();

router.get('/search', optionalAuth, validate(searchQuery, 'query'), asyncHandler(controller.global));

export default router;
