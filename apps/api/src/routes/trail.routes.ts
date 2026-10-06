import { Router } from 'express';
import * as controller from '../controllers/trail.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  beerCheckSchema,
  chalkSchema,
  createTrailSchema,
  importGpxSchema,
  trailActionSchema,
  updateBeerCheckSchema,
  updateTrailSchema,
  updateWaypointSchema,
  waypointSchema,
} from '../validators/trail.validator';

// Mounted at /api/v1. Trail secrecy is enforced in trail.service: route, waypoints,
// beer checks, chalk and notes are only serialized to planners until release.
const router = Router();

router.get('/runs/:runId/trails', optionalAuth, asyncHandler(controller.listForRun));
router.post('/runs/:runId/trails', requireAuth, validate(createTrailSchema), asyncHandler(controller.create));

router.get('/trails/:id', optionalAuth, asyncHandler(controller.detail));
router.patch('/trails/:id', requireAuth, validate(updateTrailSchema), asyncHandler(controller.update));
router.post('/trails/:id/actions/:action', requireAuth, validate(trailActionSchema), asyncHandler(controller.act));
// FR-TRAIL-002. Import is planning work (hares, editable states); export is as
// secret as the trail itself and answers 403 until it may be seen.
router.post('/trails/:id/import/gpx', requireAuth, validate(importGpxSchema), asyncHandler(controller.importGpx));
router.get('/trails/:id/gpx', optionalAuth, asyncHandler(controller.exportGpx));
router.get('/trails/:id/revisions', requireAuth, asyncHandler(controller.revisions));

router.post('/trails/:id/waypoints', requireAuth, validate(waypointSchema), asyncHandler(controller.addWaypoint));
router.patch(
  '/trails/:id/waypoints/:waypointId',
  requireAuth,
  validate(updateWaypointSchema),
  asyncHandler(controller.updateWaypoint),
);
router.delete('/trails/:id/waypoints/:waypointId', requireAuth, asyncHandler(controller.removeWaypoint));

router.post('/trails/:id/beer-checks', requireAuth, validate(beerCheckSchema), asyncHandler(controller.addBeerCheck));
router.patch(
  '/trails/:id/beer-checks/:beerCheckId',
  requireAuth,
  validate(updateBeerCheckSchema),
  asyncHandler(controller.updateBeerCheck),
);
router.delete('/trails/:id/beer-checks/:beerCheckId', requireAuth, asyncHandler(controller.removeBeerCheck));

router.post('/trails/:id/chalk', requireAuth, validate(chalkSchema), asyncHandler(controller.placeChalk));
router.delete('/trails/:id/chalk/:chalkId', requireAuth, asyncHandler(controller.removeChalk));

export default router;
