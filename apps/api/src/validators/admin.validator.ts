import Joi from 'joi';

export const listUsersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow(''),
});

export const updateUserRoleSchema = Joi.object({
  platformRole: Joi.string().valid('USER', 'ADMIN').required(),
});

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED').required(),
  reason: Joi.string().trim().max(500).allow('', null),
});
