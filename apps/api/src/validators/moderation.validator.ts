import Joi from 'joi';
import { uuid } from './common';

// Reports and moderation (D61). The service says which rule was broken; this
// keeps junk out.

const REASONS = ['SPAM', 'SCAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'SEXUAL', 'PRIVATE_INFO', 'SELF_HARM', 'IMPERSONATION', 'OTHER'];
const KINDS = ['DISMISS', 'REMOVE_CONTENT', 'WARN_USER', 'SUSPEND_USER', 'RESET_IDENTITY', 'ESCALATE', 'NOTE'];

export const fileReportSchema = Joi.object({
  targetType: Joi.string().valid('USER', 'DIRECT_MESSAGE', 'POST', 'REEL', 'COMMENT', 'MEDIA_ASSET').required(),
  targetId: uuid.required(),
  reason: Joi.string().valid(...REASONS).required(),
  details: Joi.string().trim().allow('', null).max(1000),
  impersonating: Joi.string().valid('ME', 'OTHER'),
  impersonatedUserId: uuid.allow(null),
});

export const queueQuery = Joi.object({
  filter: Joi.string().valid('open', 'resolved', 'all').default('open'),
  reason: Joi.string().valid(...REASONS),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const actionSchema = Joi.object({
  kind: Joi.string().valid(...KINDS).required(),
  note: Joi.string().trim().allow('', null).max(1000),
  closeSiblings: Joi.boolean(),
});

// Automatic holds and warnings (D74): staff review them here.
export const enforcementQuery = Joi.object({
  filter: Joi.string().valid('active', 'appeals', 'all').default('active'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const enforcementDecisionSchema = Joi.object({
  note: Joi.string().trim().allow('', null).max(1000),
});

export const appealDecisionSchema = Joi.object({
  outcome: Joi.string().valid('GRANT', 'DENY').required(),
  note: Joi.string().trim().allow('', null).max(1000),
});

// Suspected coordinated reporting (D75).
export const coordinationQuery = Joi.object({
  filter: Joi.string().valid('pending', 'all').default('pending'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const coordinationReviewSchema = Joi.object({
  outcome: Joi.string().valid('CLEARED', 'CONFIRMED').required(),
  note: Joi.string().trim().allow('', null).max(1000),
});
