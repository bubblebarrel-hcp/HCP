import Joi from 'joi';
import { uuid } from './common';
import { MEMORY_KINDS } from '../services/passport.service';

export const addMemorySchema = Joi.object({
  kind: Joi.string().valid(...MEMORY_KINDS).required(),
  title: Joi.string().trim().min(2).max(120).required(),
  note: Joi.string().trim().max(2000).allow('', null),
  refType: Joi.string().valid('Run', 'Trail', 'Kennel').allow(null),
  refId: uuid.allow(null),
});
