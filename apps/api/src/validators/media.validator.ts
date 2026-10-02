import Joi from 'joi';
import { SUPPORTED_TARGETS } from '../services/media.service';
import { uuid } from './common';

// One list, owned by the service that enforces it — never a second copy here.
const TARGET_TYPES = SUPPORTED_TARGETS;
const KINDS = ['PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT'];

export const requestUploadSchema = Joi.object({
  kind: Joi.string().valid(...KINDS).required(),
  mimeType: Joi.string().trim().max(120).required(),
  sizeBytes: Joi.number().integer().min(1).max(500 * 1024 * 1024).required(),
  target: Joi.object({
    type: Joi.string().valid(...TARGET_TYPES).required(),
    id: uuid.required(),
  }).required(),
  // Idempotency key from the offline upload queue (Ch.22 B.2).
  clientId: Joi.string().trim().max(120).allow(null),
  caption: Joi.string().trim().max(500).allow('', null),
  capturedAt: Joi.date().iso().allow(null),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
});

export const confirmUploadSchema = Joi.object({
  width: Joi.number().integer().min(1).max(20000).allow(null),
  height: Joi.number().integer().min(1).max(20000).allow(null),
  durationSec: Joi.number().min(0).max(86400).allow(null),
});

// A single frame as a data URL; the service checks the type, the bytes and the size.
export const posterSchema = Joi.object({
  image: Joi.string().max(900 * 1024).required(),
});

export const listMediaQuery = Joi.object({
  targetType: Joi.string().valid(...TARGET_TYPES).required(),
  targetId: uuid.required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(60).default(24),
});

export const moderateMediaSchema = Joi.object({
  approve: Joi.boolean().required(),
  reason: Joi.string().trim().max(500).allow('', null),
});
