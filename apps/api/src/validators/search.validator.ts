import Joi from 'joi';

// A short query only: this is a global "find things" box, not a query language.
export const searchQuery = Joi.object({
  q: Joi.string().trim().min(1).max(100).required(),
  limit: Joi.number().integer().min(1).max(10).default(5),
});
