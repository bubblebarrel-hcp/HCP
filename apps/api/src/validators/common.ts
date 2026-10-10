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

// Shiggy Trails is for adults (Terms of Service, and the child safety standards
// at /child-safety). Web (register/page.tsx) and mobile (auth/register.tsx) check
// the same rule on the form; this is the one that counts.
export const MIN_AGE = 18;
export const dateOfBirth = Joi.date()
  .iso()
  .max('now')
  .custom((value: Date, helpers) => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE);
    return value <= cutoff ? value : helpers.error('date.adult');
  })
  .messages({ 'date.adult': `You must be ${MIN_AGE} or older to join Shiggy Trails` });

export const paging = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).unknown(true);
