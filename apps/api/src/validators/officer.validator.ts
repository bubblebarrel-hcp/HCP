import Joi from 'joi';
import { uuid } from './common';

// Mirrors KENNEL_PERMISSIONS in services/permission.service.ts. Unknown keys are
// rejected rather than ignored, so a typo never silently grants nothing.
const PERMISSION_KEYS = [
  'membership.review',
  'membership.suspend',
  'membership.remove',
  'membership.invite',
  'officer.appoint',
  'kennel.manage',
  'run.manage',
  'run.visibility.change',
  'trail.manage',
  'report.publish',
  'media.moderate',
];

// Exactly the AppointmentMethod enum in schema.prisma. Joi does not typecheck
// against Prisma, so a wrong value here passes validation and fails at the
// database instead.
const APPOINTMENT_METHODS = ['APPOINTED', 'ELECTED', 'ACCLAIMED', 'INTERIM', 'FOUNDING'];

export const createPositionSchema = Joi.object({
  title: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().max(500).allow('', null),
  responsibilities: Joi.string().trim().max(2000).allow('', null),
  permissions: Joi.array().items(Joi.string().valid(...PERMISSION_KEYS)).default([]),
  termMonths: Joi.number().integer().min(1).max(120).allow(null),
  appointmentMethod: Joi.string().valid(...APPOINTMENT_METHODS),
  // D10: mismanagement positions count toward kennel verification.
  isMismanagement: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0).max(999),
});

export const updatePositionSchema = Joi.object({
  title: Joi.string().trim().min(2).max(80),
  description: Joi.string().trim().max(500).allow('', null),
  responsibilities: Joi.string().trim().max(2000).allow('', null),
  permissions: Joi.array().items(Joi.string().valid(...PERMISSION_KEYS)),
  termMonths: Joi.number().integer().min(1).max(120).allow(null),
  appointmentMethod: Joi.string().valid(...APPOINTMENT_METHODS),
  isMismanagement: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0).max(999),
}).min(1);

export const archivePositionSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const appointSchema = Joi.object({
  userId: uuid.required(),
  method: Joi.string().valid(...APPOINTMENT_METHODS),
  startDate: Joi.date().iso().allow(null),
});

export const endAppointmentSchema = Joi.object({
  // Ch.22 A.10 terminal states all keep the record; the reason says which.
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const grantDelegationSchema = Joi.object({
  delegateId: uuid.required(),
  permissions: Joi.array().items(Joi.string().valid(...PERMISSION_KEYS)).min(1).required(),
  // FR-GOV-033 lists reason as part of the record, so it is not optional.
  reason: Joi.string().trim().min(3).max(500).required(),
  expiresAt: Joi.date().iso().required(),
});

export const revokeDelegationSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

// Kennel-scoped roles. HARE and CO_HARE are not grantable here: they belong to
// a run, and run.service grants them when the hares are set.
export const GRANTABLE_ROLES = [
  'KENNEL_ADMIN',
  'SCRIBE',
  'ASSISTANT_SCRIBE',
  'REVIEWER',
  'PHOTOGRAPHER',
  'VOLUNTEER',
  'MODERATOR',
  'EVENT_ORGANIZER',
];

export const grantRoleSchema = Joi.object({
  userId: uuid.required(),
  role: Joi.string().valid(...GRANTABLE_ROLES).required(),
  // What this kennel calls the job (D40). Null or absent keeps the default.
  title: Joi.string().trim().max(60).allow('', null),
});

export const revokeRoleSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

// Renaming a grant the kennel already made. Empty means "use the default".
export const renameRoleSchema = Joi.object({
  title: Joi.string().trim().max(60).allow('', null).required(),
});
