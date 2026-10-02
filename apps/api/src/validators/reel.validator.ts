import Joi from 'joi';
import { uuid } from './common';

// Reels (D41). The context is optional on purpose: a reel shot at home belongs
// to no kennel and no run, and that is a first-class case rather than an edge.
const context = {
  kennelId: uuid.allow(null),
  runId: uuid.allow(null),
  eventId: uuid.allow(null),
  visibility: Joi.string().valid('PUBLIC', 'FOLLOWERS', 'ONLY_ME'),
  caption: Joi.string().trim().max(500).allow('', null),
};

export const createReelSchema = Joi.object(context);

export const updateReelSchema = Joi.object({
  caption: context.caption,
  visibility: context.visibility,
}).min(1);

export const removeReelSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const listReelsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(30).default(12),
  kennelSlug: Joi.string().trim().max(120),
  authorId: uuid,
});

export const feedQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(30).default(10),
  // 'FOLLOWING' narrows the stream to the hashers and kennels this reader
  // follows (D50). Signed out it is simply empty.
  scope: Joi.string().valid('ALL', 'FOLLOWING').default('ALL'),
});
