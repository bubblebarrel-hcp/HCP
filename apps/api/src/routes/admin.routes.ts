import { Router } from 'express';
import { PlatformRole } from '@prisma/client';
import * as adminController from '../controllers/admin.controller';
import * as kennelController from '../controllers/kennel.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import { createKennelSchema, listKennelsQuery, updateKennelSchema } from '../validators/kennel.validator';
import { listUsersQuery, updateUserRoleSchema, updateUserStatusSchema } from '../validators/admin.validator';

// Platform admin boundary. Applied once at the top so a route added later
// cannot ship open by accident.
const router = Router();
router.use(requireAuth, requireRole(PlatformRole.ADMIN));

router.get('/stats', asyncHandler(adminController.stats));

router.get('/kennels', validate(listKennelsQuery, 'query'), asyncHandler(kennelController.listAdmin));
// Before '/kennels/:id', or 'pending' is read as an id and 404s on the uuid guard.
router.get('/kennels/pending', asyncHandler(adminController.pendingKennels));
router.get('/kennels/:id', asyncHandler(kennelController.getAdmin));
router.post('/kennels', validate(createKennelSchema), asyncHandler(kennelController.create));
router.patch('/kennels/:id', validate(updateKennelSchema), asyncHandler(kennelController.update));
router.delete('/kennels/:id', asyncHandler(kennelController.remove));

// Runs the hare reminder sweep now rather than on its twelve-hour timer (D45).
router.post('/reminders/hares', asyncHandler(adminController.sweepHareReminders));

router.get('/users', validate(listUsersQuery, 'query'), asyncHandler(adminController.listUsers));
router.patch('/users/:id/role', validate(updateUserRoleSchema), asyncHandler(adminController.updateUserRole));
router.patch('/users/:id/status', validate(updateUserStatusSchema), asyncHandler(adminController.updateUserStatus));

export default router;
