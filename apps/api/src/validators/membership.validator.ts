import Joi from 'joi';

const MEMBERSHIP_TYPES = ['FULL', 'ASSOCIATE', 'VISITING', 'HONORARY', 'LIFE', 'GUEST', 'VIRGIN', 'COMMITTEE'];
const MEMBERSHIP_STATUSES = [
  'APPLICANT',
  'PENDING_REVIEW',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'RESIGNED',
  'REMOVED',
  'REJECTED',
  'WITHDRAWN',
  'ARCHIVED',
];

// D20: a hasher picks from these when asking to join. Honorary, Life, Guest and
// Committee are granted by officers on approval, never self-selected.
export const SELF_SELECTABLE_TYPES = ['FULL', 'ASSOCIATE', 'VISITING', 'VIRGIN'];

const note = Joi.string().trim().max(1000).allow('', null);
const reason = Joi.string().trim().min(3).max(1000).required();

export const requestMembershipSchema = Joi.object({
  type: Joi.string().valid(...SELF_SELECTABLE_TYPES).default('FULL'),
  message: note,
});

export const approveMembershipSchema = Joi.object({
  type: Joi.string().valid(...MEMBERSHIP_TYPES),
  notes: note,
});

export const rejectMembershipSchema = Joi.object({ notes: note });

export const suspendMembershipSchema = Joi.object({
  reason,
  until: Joi.date().iso().greater('now').allow(null, ''),
});

export const reinstateMembershipSchema = Joi.object({ notes: note });

export const removeMembershipSchema = Joi.object({ reason });

export const resignMembershipSchema = Joi.object({ reason: note });

export const withdrawMembershipSchema = Joi.object({ reason: note });

// FR-MEMBER-007. null clears it; the service checks the kennelId is an active
// membership.
export const setHomeKennelSchema = Joi.object({
  kennelId: Joi.string().uuid().allow(null).required(),
});

export const listMembersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...MEMBERSHIP_STATUSES),
});
