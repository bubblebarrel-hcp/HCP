import Joi from 'joi';
import { SUBJECT_SEGMENTS } from '../services/subject.service';

// D50. The subject is addressed by a path segment (`reels`, `reports`,
// `photos`, `runs`, `capsules`, `comments`), validated here so an unknown one
// is a 400 at the edge rather than a switch falling through in a service.

export const subjectParams = Joi.object({
  subject: Joi.string()
    .valid(...SUBJECT_SEGMENTS)
    .required(),
  id: Joi.string().uuid().required(),
});

export const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const commentsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const addCommentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  // A reply to a reply attaches to the same root, so this is always a root id
  // by the time the service is done with it.
  parentId: Joi.string().uuid().allow(null),
});

export const editCommentSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
});

export const removeCommentSchema = Joi.object({
  // A moderator says why. The reason is written to the audit log.
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const reshareSchema = Joi.object({
  commentary: Joi.string().trim().max(1000).allow('', null),
});

export const bookmarkSchema = Joi.object({
  note: Joi.string().trim().max(500).allow('', null),
});

export const bookmarksQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  subject: Joi.string().valid(...SUBJECT_SEGMENTS),
});
