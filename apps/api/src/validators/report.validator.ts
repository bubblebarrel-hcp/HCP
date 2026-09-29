import Joi from 'joi';
import { uuid } from './common';

const STORY_CATEGORIES = [
  'TRAIL',
  'BEER_CHECK',
  'CIRCLE',
  'VISITOR',
  'AWARD',
  'SONG',
  'INCIDENT',
  'HUMOR',
  'SAFETY',
  'HISTORICAL',
  'GENERAL',
];

// ─── Trail Reports ───

export const startDraftSchema = Joi.object({
  title: Joi.string().trim().max(200).allow('', null),
  // Officers may nominate someone else as the Official Scribe.
  scribeId: uuid.allow(null),
});

export const updateDraftSchema = Joi.object({
  title: Joi.string().trim().max(200),
  // Reports are long-form; the cap is generous on purpose (08G non-functional).
  body: Joi.string().max(200000).allow(''),
}).min(1);

export const reportActionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

export const aiDraftDecisionSchema = Joi.object({
  decision: Joi.string().valid('ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED').required(),
  // Required unless rejecting: the text the Scribe is keeping, verbatim or edited.
  body: Joi.string().trim().max(200000).allow(''),
});

export const reviseSchema = Joi.object({
  title: Joi.string().trim().max(200),
  body: Joi.string().max(200000).allow(''),
  // FR-PUBLISH-003: a correction always says why.
  reason: Joi.string().trim().min(3).max(500).required(),
}).or('title', 'body');

export const restoreRevisionSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const contributorSchema = Joi.object({
  userId: uuid.required(),
  role: Joi.string().valid('ASSISTANT_SCRIBE', 'REVIEWER').required(),
});

export const commentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
  // Which passage the comment is against.
  anchor: Joi.string().trim().max(200).allow('', null),
});

export const listReportsQuery = Joi.object({
  kennelSlug: Joi.string().trim().max(120),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

// ─── Story assets ───

export const createStorySchema = Joi.object({
  category: Joi.string().valid(...STORY_CATEGORIES).required(),
  body: Joi.string().trim().min(1).max(4000).required(),
  occurredAt: Joi.date().iso().allow(null),
});

export const updateStorySchema = Joi.object({
  category: Joi.string().valid(...STORY_CATEGORIES),
  body: Joi.string().trim().min(1).max(4000),
}).min(1);
