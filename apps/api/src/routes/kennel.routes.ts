import { Router } from 'express';
import * as controller from '../controllers/kennel.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  abandonKennelSchema,
  foundKennelSchema,
  kennelSettingsSchema,
  listKennelsQuery,
} from '../validators/kennel.validator';
import { listQuery } from '../validators/engagement.validator';

// Public reads, plus the one write a hasher may make: founding a kennel of
// their own (D33). Editing an existing kennel still lives under /admin/kennels.
const router = Router();

router.get('/', validate(listKennelsQuery, 'query'), asyncHandler(controller.listPublic));

// Before '/:slug', or 'map' is read as a slug. Every discoverable kennel with
// coordinates, id/slug/name/coordinates only — the list endpoint's limit caps
// at 100, which would otherwise drop pins past it.
router.get('/map', asyncHandler(controller.mapPins));

// FR-KENNEL-001 (D33): a signed-in hasher starts their own kennel. It opens
// Pending Verification with them as provisional kennel admin.
router.post('/', requireAuth, validate(foundKennelSchema), asyncHandler(controller.found));
router.get('/:slug', asyncHandler(controller.getPublic));

// The Photos tab: pictures on this kennel's runs, each gated by its run and by
// whoever took it.
router.get('/:slug/photos', optionalAuth, validate(listQuery, 'query'), asyncHandler(controller.photos));

// The kennel's own admins run it from here (D34). Standing and verification are
// not theirs to set, so those stay under /admin/kennels.
router.get('/:slug/settings', requireAuth, asyncHandler(controller.getSettings));
router.patch('/:slug/settings', requireAuth, validate(kennelSettingsSchema), asyncHandler(controller.updateSettings));
// A founder changing their mind before anyone else joins.
router.post('/:slug/abandon', requireAuth, validate(abandonKennelSchema), asyncHandler(controller.abandon));

export default router;
