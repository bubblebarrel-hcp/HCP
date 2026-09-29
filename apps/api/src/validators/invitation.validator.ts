import Joi from 'joi';
import { email } from './common';

const MEMBERSHIP_TYPES = ['FULL', 'ASSOCIATE', 'VISITING', 'HONORARY', 'LIFE', 'GUEST', 'VIRGIN', 'COMMITTEE'];

export const createInvitationSchema = Joi.object({
  method: Joi.string().valid('EMAIL', 'QR_CODE', 'LINK').required(),
  email: email.when('method', { is: 'EMAIL', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
  membershipType: Joi.string().valid(...MEMBERSHIP_TYPES).default('FULL'),
});
