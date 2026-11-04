import Joi from 'joi';
import { uuid, paging } from './common';

const KINDS = ['HASH_RUN', 'TRAIL_LAYING', 'SOLO'];
const AUDIENCES = ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'];

// One GPS fix from the phone. 2 MB of JSON (server.ts) is room for about 20 000.
const point = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  ele: Joi.number().min(-500).max(9000).allow(null),
  t: Joi.number().integer().min(0).required(),
  seg: Joi.number().integer().min(0).max(1000),
  acc: Joi.number().min(0).allow(null),
});

export const recordActivitySchema = Joi.object({
  clientId: Joi.string().trim().min(8).max(64).required(),
  kind: Joi.string().valid(...KINDS).required(),
  runId: uuid.allow(null),
  trailId: uuid.allow(null),
  title: Joi.string().trim().max(120).allow('', null),
  notes: Joi.string().trim().max(2000).allow('', null),
  audience: Joi.string().valid(...AUDIENCES),
  points: Joi.array().items(point).min(2).max(20000).required(),
});

export const updateActivitySchema = Joi.object({
  title: Joi.string().trim().max(120).allow('', null),
  notes: Joi.string().trim().max(2000).allow('', null),
  audience: Joi.string().valid(...AUDIENCES),
}).min(1);

export const listActivitiesSchema = paging.keys({
  runId: uuid,
  kind: Joi.string().valid(...KINDS),
});
