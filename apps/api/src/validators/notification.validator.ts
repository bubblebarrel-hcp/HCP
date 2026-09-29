import Joi from 'joi';

const CATEGORIES = [
  'MEMBERSHIP',
  'RUN',
  'TRAIL_RELEASE',
  'REMINDER',
  'REPORT',
  'ANNOUNCEMENT',
  'GOVERNANCE',
  'EVENT',
  'MEDIA',
  'SAFETY',
  'SYSTEM',
];

const CHANNELS = ['IN_APP', 'PUSH', 'EMAIL'];

export const listNotificationsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  unread: Joi.boolean().default(false),
});

export const updatePreferencesSchema = Joi.object({
  preferences: Joi.array()
    .items(
      Joi.object({
        category: Joi.string().valid(...CATEGORIES).required(),
        channel: Joi.string().valid(...CHANNELS).required(),
        enabled: Joi.boolean().required(),
      }),
    )
    .min(1)
    .max(60)
    .required(),
});

// "HH:MM" on a 24-hour clock, in the hasher's own time zone (FR-NOT-006).
const clock = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).message('Use a 24-hour time like 22:00');

export const quietHoursSchema = Joi.object({
  // null clears the window. Both ends are required together: half a window is
  // not a window.
  quietHours: Joi.object({
    start: clock.required(),
    end: clock.required(),
  })
    .allow(null)
    .required(),
});

// IANA zone name shape only ("Africa/Lagos"); the service validates it
// actually resolves via Intl rather than duplicating that list here.
export const setTimeZoneSchema = Joi.object({
  timeZone: Joi.string().trim().min(1).max(60).required(),
});

export const registerDeviceSchema = Joi.object({
  pushToken: Joi.string().trim().min(10).max(255).required(),
  platform: Joi.string().valid('IOS', 'ANDROID', 'WEB').required(),
});

export const revokeDeviceSchema = Joi.object({
  pushToken: Joi.string().trim().min(10).max(255).required(),
});
