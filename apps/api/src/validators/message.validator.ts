import Joi from 'joi';
import { uuid } from './common';

// D71. The body limit here is the transport's; the service trims and enforces
// the real one (MAX_BODY) so web, mobile and a script all get the same answer.
const body = Joi.string().max(4000).required();
const clientKey = Joi.string().trim().max(64);

export const startSchema = Joi.object({
  userId: uuid.required(),
  body,
  clientKey,
});

export const sendSchema = Joi.object({ body, clientKey });

export const listSchema = Joi.object({
  box: Joi.string().valid('inbox', 'requests').default('inbox'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(30),
});

export const messagesSchema = Joi.object({
  before: uuid,
  after: uuid,
  limit: Joi.number().integer().min(1).max(100).default(40),
});

export const mutedSchema = Joi.object({ muted: Joi.boolean().required() });
