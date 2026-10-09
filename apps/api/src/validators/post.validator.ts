import Joi from 'joi';
import { uuid } from './common';

// A hasher's written post (D51). Its audience (D57) is its own and can only narrow
// its author's profile: PUBLIC, FOLLOWERS or ONLY_ME.
const visibility = Joi.string().valid('PUBLIC', 'FOLLOWERS', 'ONLY_ME');

// Two to five answers and how long they stay open (D60). The service says which
// rule was broken; this keeps junk out.
const poll = Joi.object({
  options: Joi.array().items(Joi.string().trim().min(1).max(80)).min(2).max(5).required(),
  hours: Joi.number().integer().min(1).max(168),
});

export const createPostSchema = Joi.object({
  poll,
  // Empty is allowed here and refused at publish: a draft exists so photos have
  // somewhere to upload to, and the photos may land before the words do.
  body: Joi.string().trim().allow('').max(5000),
  visibility,
  // Where the hasher was, not who may read it.
  kennelId: uuid.allow(null),
  runId: uuid.allow(null),
  // The next part of the author's own thread: the id of its first post. The part
  // takes that post's audience, kennel and run, so none of them are sent with it.
  threadRootId: uuid.allow(null),
});

export const updatePostSchema = Joi.object({
  body: Joi.string().trim().allow('').max(5000),
  visibility,
}).min(1);

export const removePostSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const listPostsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(30).default(12),
  kennelSlug: Joi.string().trim().max(120),
  authorId: uuid,
  // A hashtag page (D59), with or without the "#".
  tag: Joi.string().trim().max(51),
  // Posts about one run (D60).
  runId: uuid,
});

export const pollVoteSchema = Joi.object({
  optionId: uuid.required(),
});
