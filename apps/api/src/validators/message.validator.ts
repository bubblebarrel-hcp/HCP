import Joi from 'joi';
import { uuid } from './common';

// D71, widened by D73. The body limit here is the transport's; the service
// trims and enforces the real ones (MAX_BODY, MAX_CAPTION) so web, mobile and a
// script all get the same answer.
const body = Joi.string().max(4000).allow('');
const clientKey = Joi.string().trim().max(64);

// A first message is words (D73); the service refuses anything else.
export const startSchema = Joi.object({
  userId: uuid.required(),
  body: Joi.string().max(4000).required(),
  clientKey,
});

export const sendSchema = Joi.object({
  kind: Joi.string().valid('TEXT', 'MEDIA', 'STICKER', 'VOICE').default('TEXT'),
  body,
  attachmentIds: Joi.array().items(uuid).max(10),
  stickerId: uuid,
  // The earlier message of this conversation being answered.
  replyToId: uuid,
  clientKey,
});

export const editSchema = Joi.object({ body });

// Passing messages on: up to twenty, into up to five of my conversations.
export const forwardSchema = Joi.object({
  messageIds: Joi.array().items(uuid).min(1).max(20).unique().required(),
  toConversationIds: Joi.array().items(uuid).min(1).max(5).unique().required(),
});

export const pinSchema = Joi.object({ pinned: Joi.boolean().required() });

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

// Files and stickers (D73).
export const attachmentUploadSchema = Joi.object({
  kind: Joi.string().valid('PHOTO', 'VIDEO', 'AUDIO').required(),
  // Browsers report "audio/webm;codecs=opus": the codec is not part of the type.
  mimeType: Joi.string().trim().lowercase().max(100).required(),
  sizeBytes: Joi.number().integer().min(1).max(100 * 1024 * 1024).required(),
  width: Joi.number().integer().min(1).max(20000),
  height: Joi.number().integer().min(1).max(20000),
  durationSec: Joi.number().min(0).max(3600),
});

export const attachmentConfirmSchema = Joi.object({
  width: Joi.number().integer().min(1).max(20000),
  height: Joi.number().integer().min(1).max(20000),
  durationSec: Joi.number().min(0).max(3600),
});

export const stickerUploadSchema = Joi.object({
  mimeType: Joi.string().trim().lowercase().max(100).required(),
  sizeBytes: Joi.number().integer().min(1).max(2 * 1024 * 1024).required(),
  width: Joi.number().integer().min(1).max(4096),
  height: Joi.number().integer().min(1).max(4096),
});
