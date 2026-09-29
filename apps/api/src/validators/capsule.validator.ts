import Joi from 'joi';
import { uuid } from './common';

// Supplemental contributions (BR-CAPSULE-005): newly discovered media, scanned
// newsletters, interviews, anniversary reflections.
const SUPPLEMENTAL_TYPES = ['PHOTO', 'SCANNED_NEWSLETTER', 'INTERVIEW', 'REFLECTION', 'DOCUMENT', 'OTHER'];

export const capsuleActionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

export const supplementSchema = Joi.object({
  type: Joi.string().valid(...SUPPLEMENTAL_TYPES).required(),
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(4000).allow('', null),
  // An already-uploaded asset (D28) rather than bytes: the capsule points at it.
  mediaAssetId: uuid.allow(null),
});

export const listCapsulesQuery = Joi.object({
  kennelSlug: Joi.string().trim().max(120),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});
