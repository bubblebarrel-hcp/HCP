import Joi from 'joi';
import { uuid } from './common';

// A hasher's written post (D51). A post is as visible as its author's profile (D57), so there is
// deliberately no visibility field to send.

export const createPostSchema = Joi.object({
  // Empty is allowed here and refused at publish: a draft exists so photos have
  // somewhere to upload to, and the photos may land before the words do.
  body: Joi.string().trim().allow('').max(5000),
  // Where the hasher was, not who may read it.
  kennelId: uuid.allow(null),
  runId: uuid.allow(null),
});

export const updatePostSchema = Joi.object({
  body: Joi.string().trim().allow('').max(5000),
}).min(1);

export const removePostSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const listPostsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(30).default(12),
  kennelSlug: Joi.string().trim().max(120),
  authorId: uuid,
});
