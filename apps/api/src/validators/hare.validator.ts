import Joi from 'joi';

// Offering to hare a run (D44).
export const offerToHareSchema = Joi.object({
  message: Joi.string().trim().max(500).allow('', null),
  // A first hare leads by default; this says they want to, when there is a choice.
  wantsLead: Joi.boolean(),
});

export const withdrawOfferSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

export const declineOfferSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});

export const runsNeedingHaresQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  kennelSlug: Joi.string().trim().max(120),
});
