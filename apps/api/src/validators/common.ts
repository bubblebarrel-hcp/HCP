import Joi from 'joi';

// Joi's default .email() validates the TLD against a bundled IANA list, which
// rejects RFC 2606 dev addresses (.test, .local, .invalid) and lags new real
// gTLDs — both false negatives. Define the rule once and reuse it everywhere.
export const email = Joi.string().email({ tlds: { allow: false } }).lowercase().max(255);

// FR-AUTH-001: password policy enforced
export const password = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/[0-9]/, 'number')
  .messages({ 'string.pattern.name': 'Password must contain at least one {#name}' });

export const uuid = Joi.string().uuid();

export const paging = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);
