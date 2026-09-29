import Joi from 'joi';
import { email, uuid } from './common';

// Mirrored by the web run form's Zod schema (apps/web/lib/run-schema.ts).
// Changing one means changing the other.
export const RUN_TYPES = ['REGULAR', 'FULL_MOON', 'RED_DRESS', 'CAMPOUT', 'CHARITY', 'INTERHASH', 'NASH_HASH', 'THEMED', 'SPECIAL'];
export const RUN_VISIBILITIES = ['PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY'];

const optionalText = (max: number) => Joi.string().trim().max(max).allow('', null);

const hares = Joi.array()
  .items(Joi.object({ userId: uuid.required(), isLead: Joi.boolean().default(false) }))
  .max(10)
  .unique('userId');

const runFields = {
  runNumber: Joi.number().integer().min(1).max(1_000_000),
  title: Joi.string().trim().min(2).max(120),
  description: optionalText(4000),
  theme: optionalText(120),
  runType: Joi.string().valid(...RUN_TYPES),
  visibility: Joi.string().valid(...RUN_VISIBILITIES),
  // Wall-clock time in the run's time zone, e.g. 2026-09-19T15:00
  startsAtLocal: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'YYYY-MM-DDTHH:mm'),
  timeZone: Joi.string().trim().max(60),
  meetingPointName: Joi.string().trim().min(2).max(160),
  meetingAddress: optionalText(300),
  capacity: Joi.number().integer().min(1).max(10_000).allow(null),
  allowGuests: Joi.boolean(),
  allowVisitors: Joi.boolean(),
  hashCash: optionalText(60),
  // The flyer (D43). A URL rather than an upload: the file went to storage the
  // usual way and this records where it landed.
  posterUrl: Joi.string().uri().allow('', null),
  hares,
};

export const createRunSchema = Joi.object({
  ...runFields,
  title: runFields.title.required(),
  runType: runFields.runType.default('REGULAR'),
  startsAtLocal: runFields.startsAtLocal.required(),
  meetingPointName: runFields.meetingPointName.required(),
  hares: hares.default([]),
});

export const updateRunSchema = Joi.object(runFields).min(1);

export const listRunsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  scope: Joi.string().valid('upcoming', 'past', 'drafts').default('upcoming'),
});

export const runActionSchema = Joi.object({ reason: optionalText(1000) });

export const rsvpSchema = Joi.object({
  status: Joi.string().valid('GOING', 'MAYBE', 'NOT_GOING').required(),
});

// D2 / D23: the minimum a guest gives. Consent is required to store it.
export const guestSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(60).required(),
  lastName: Joi.string().trim().min(1).max(60).required(),
  email: email.required(),
  phone: optionalText(30),
  consent: Joi.boolean().valid(true).required().messages({
    'any.only': 'Guests must agree to HCP storing their details.',
    'any.required': 'Guests must agree to HCP storing their details.',
  }),
  // Hares and officers adding a walk-in at the venue may check them in at once.
  checkIn: Joi.boolean().default(false),
});

export const revertCheckInSchema = Joi.object({ reason: optionalText(500) });

export const circleSchema = Joi.object({
  songs: Joi.array().items(Joi.string().trim().min(1).max(120)).max(50),
  announcements: optionalText(4000),
  notes: optionalText(8000),
}).min(1);

export const awardSchema = Joi.object({
  title: Joi.string().trim().min(2).max(120).required(),
  reason: optionalText(500),
  isDownDown: Joi.boolean().default(false),
  participationId: uuid,
  recipientName: Joi.string().trim().min(1).max(120),
})
  .xor('participationId', 'recipientName')
  .messages({ 'object.missing': 'Choose who the award is for.', 'object.xor': 'Choose one recipient.' });
