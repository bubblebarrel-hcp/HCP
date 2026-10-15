import Joi from 'joi';

export const listUsersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow(''),
});

export const updateUserRoleSchema = Joi.object({
  platformRole: Joi.string().valid('USER', 'ADMIN').required(),
});

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED').required(),
  reason: Joi.string().trim().max(500).allow('', null),
});

const paging = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
};
const uuid = Joi.string().uuid();
const day = Joi.date().iso();
const search = Joi.string().trim().max(100).allow('');

export const auditQuery = Joi.object({
  ...paging,
  q: search,
  actorId: uuid,
  resourceType: Joi.string().trim().max(60),
  decision: Joi.string().valid('ALLOWED', 'DENIED'),
  from: day,
  to: day,
});

export const eventsQuery = Joi.object({
  ...paging,
  q: search,
  aggregateType: Joi.string().trim().max(60),
  published: Joi.string().valid('true', 'false'),
  from: day,
  to: day,
});

export const membershipsQuery = Joi.object({
  ...paging,
  q: search,
  kennelId: uuid,
  status: Joi.string().valid(
    'APPLICANT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RESIGNED', 'REMOVED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED',
  ),
});

export const runsQuery = Joi.object({
  ...paging,
  q: search,
  kennelId: uuid,
  status: Joi.string().valid(
    'DRAFT', 'SCHEDULED', 'PLANNING', 'TRAIL_HIDDEN', 'TRAIL_RELEASED', 'CHECK_IN_OPEN', 'LIVE', 'CIRCLE', 'REPORTING', 'ARCHIVED', 'CANCELLED',
  ),
  from: day,
  to: day,
});

export const contentQuery = Joi.object({
  ...paging,
  q: search,
  kennelId: uuid,
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED', 'REMOVED', 'DELETED'),
});

export const takedownSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const updateSettingSchema = Joi.object({
  // A number for the tunable limits, text for the app version gate and store links;
  // the service checks which one a given key takes.
  value: Joi.alternatives(Joi.number().integer().min(0).max(3650), Joi.string().trim().max(300).allow('')).required(),
  reason: Joi.string().trim().max(500).allow('', null),
});

// D76: a platform broadcast. A kennel is named only for the KENNEL audience, a
// hasher's email only for the USER audience.
export const broadcastSchema = Joi.object({
  title: Joi.string().trim().min(3).max(80).required(),
  body: Joi.string().trim().min(3).max(500).required(),
  audience: Joi.string().valid('EVERYONE', 'KENNEL', 'USER').required(),
  kennelId: Joi.when('audience', { is: 'KENNEL', then: Joi.string().uuid().required(), otherwise: Joi.any().valid(null, '').optional() }),
  recipientEmail: Joi.when('audience', {
    is: 'USER',
    then: Joi.string().trim().email({ tlds: { allow: false } }).required(),
    otherwise: Joi.any().valid(null, '').optional(),
  }),
  push: Joi.boolean().default(false),
  urgent: Joi.boolean().default(false),
});

export const broadcastPreviewQuery = Joi.object({
  audience: Joi.string().valid('EVERYONE', 'KENNEL', 'USER').required(),
  kennelId: Joi.string().uuid().when('audience', { is: 'KENNEL', then: Joi.required(), otherwise: Joi.optional() }),
  recipientEmail: Joi.string().trim().email({ tlds: { allow: false } }).when('audience', { is: 'USER', then: Joi.required(), otherwise: Joi.optional() }),
});

export const broadcastListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});
