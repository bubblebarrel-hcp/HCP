import { Router } from 'express';
import * as controller from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  listNotificationsQuery,
  quietHoursSchema,
  registerDeviceSchema,
  revokeDeviceSchema,
  setTimeZoneSchema,
  updatePreferencesSchema,
} from '../validators/notification.validator';

// Mounted at /api/v1. Everything here is the signed-in hasher's own mail, so
// requireAuth goes on each route: a router-level `use` at this shared prefix
// would also reject anonymous routes registered by routers mounted later.
const router = Router();

router.get('/me/notifications', requireAuth, validate(listNotificationsQuery, 'query'), asyncHandler(controller.list));
router.get('/me/notifications/unread-count', requireAuth, asyncHandler(controller.unreadCount));
router.post('/me/notifications/read-all', requireAuth, asyncHandler(controller.markAllRead));
router.post('/me/notifications/:id/read', requireAuth, asyncHandler(controller.markRead));

router.get('/me/notification-preferences', requireAuth, asyncHandler(controller.getPreferences));
router.put(
  '/me/notification-preferences',
  requireAuth,
  validate(updatePreferencesSchema),
  asyncHandler(controller.updatePreferences),
);

// FR-NOT-006. Quiet hours only quieten push; the in-app copy still lands.
router.put('/me/notification-preferences/quiet-hours', requireAuth, validate(quietHoursSchema), asyncHandler(controller.setQuietHours));

// D36. Without this, quiet hours evaluate against UTC for anyone who has not
// set one, which puts the window in the wrong place for most of the world.
router.put('/me/timezone', requireAuth, validate(setTimeZoneSchema), asyncHandler(controller.setTimeZone));

// Devices that can receive push (D12). The token is a sending credential, so it
// goes in and is never read back out.
router.get('/me/devices', requireAuth, asyncHandler(controller.listDevices));
router.post('/me/devices', requireAuth, validate(registerDeviceSchema), asyncHandler(controller.registerDevice));
router.post('/me/devices/revoke', requireAuth, validate(revokeDeviceSchema), asyncHandler(controller.revokeDevice));

export default router;
