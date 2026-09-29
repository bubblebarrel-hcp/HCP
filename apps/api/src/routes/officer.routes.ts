import { Router } from 'express';
import * as controller from '../controllers/officer.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  appointSchema,
  archivePositionSchema,
  createPositionSchema,
  endAppointmentSchema,
  grantDelegationSchema,
  grantRoleSchema,
  renameRoleSchema,
  revokeRoleSchema,
  revokeDelegationSchema,
  updatePositionSchema,
} from '../validators/officer.validator';

// Mounted at /api/v1. How a kennel is run: who holds which office, and who is
// standing in for whom (Annex 08L, D32). Everything here needs a session; the
// public kennel page already shows current officers by name.
const router = Router();

router.get('/kennels/:slug/positions', requireAuth, asyncHandler(controller.listPositions));
router.get('/kennels/:slug/leadership', requireAuth, asyncHandler(controller.timeline));

// Defining what a position may do is kennel.manage, deliberately stricter than
// filling the seat (D32).
router.post(
  '/kennels/:slug/positions',
  requireAuth,
  validate(createPositionSchema),
  asyncHandler(controller.createPosition),
);
router.patch('/positions/:id', requireAuth, validate(updatePositionSchema), asyncHandler(controller.updatePosition));
router.post(
  '/positions/:id/archive',
  requireAuth,
  validate(archivePositionSchema),
  asyncHandler(controller.archivePosition),
);

router.post('/positions/:id/appointments', requireAuth, validate(appointSchema), asyncHandler(controller.appoint));
// action: term-ended | resigned | revoked
router.post(
  '/appointments/:id/:action',
  requireAuth,
  validate(endAppointmentSchema),
  asyncHandler(controller.endAppointment),
);

// Standing roles rather than offices: scribe, photographer, another kennel
// admin. Granting authority is kennel.manage, stricter than filling a seat.
router.post('/kennels/:slug/roles', requireAuth, validate(grantRoleSchema), asyncHandler(controller.grantRole));
router.patch('/roles/:id', requireAuth, validate(renameRoleSchema), asyncHandler(controller.renameRole));
router.post('/roles/:id/revoke', requireAuth, validate(revokeRoleSchema), asyncHandler(controller.revokeRole));

// Delegations (FR-GOV-033).
router.get('/kennels/:slug/delegations', requireAuth, asyncHandler(controller.listDelegations));
router.post(
  '/kennels/:slug/delegations',
  requireAuth,
  validate(grantDelegationSchema),
  asyncHandler(controller.grantDelegation),
);
router.post(
  '/delegations/:id/revoke',
  requireAuth,
  validate(revokeDelegationSchema),
  asyncHandler(controller.revokeDelegation),
);

export default router;
