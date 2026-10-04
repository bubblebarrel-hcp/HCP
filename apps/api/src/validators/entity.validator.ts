import Joi from 'joi';

// #hashtags and @mentions (D59).

export const trendingQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(8),
});

export const mentionSuggestQuery = Joi.object({
  // Empty is allowed: it asks for the people the hasher follows.
  q: Joi.string().trim().allow('').max(40).default(''),
  limit: Joi.number().integer().min(1).max(10).default(6),
});

// Lowercase letters, digits, "_" and ".", 3 to 30. The service says why a name is
// refused (reserved, taken); this only keeps junk out.
export const usernameSchema = Joi.object({
  username: Joi.string().trim().min(3).max(31).required(),
});
