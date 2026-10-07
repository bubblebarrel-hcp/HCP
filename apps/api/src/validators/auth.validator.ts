import Joi from 'joi';
import { email, password } from './common';

const text = (max: number) => Joi.string().trim().max(max);

// D5: full biodata is required at registration. Only the hash handle (or
// "Just <firstName>") is ever shown publicly. The admin app's Zod schema for
// users mirrors this — change both together.
export const registerSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  acceptTerms: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the Terms of Service and Privacy Policy',
  }),

  termsVersion: text(40),

  firstName: text(80).required(),
  middleName: text(80).allow('', null),
  lastName: text(80).required(),
  // Optional: many hashers are only named after several runs (D11)
  hashHandle: text(80).allow('', null),

  dateOfBirth: Joi.date().iso().max('now').required(),
  gender: Joi.string().valid('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY').required(),
  phone: text(40).required(),
  nationality: text(80).required(),
  country: text(80).required(),
  stateProvince: text(80).required(),
  city: text(80).required(),
  addressLine: text(200).allow('', null),
  occupation: text(120).allow('', null),
  languages: Joi.array().items(text(40)).max(10).default([]),

  emergencyContactName: text(120).required(),
  emergencyContactPhone: text(40).required(),
  emergencyContactRelationship: text(60).required(),

  // platformRole is deliberately absent. ADMIN is granted by an existing admin,
  // never claimed in a signup body.
});

export const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string().allow('', null),
});

// FR-AUTH-002 (D31). The token is 32 random bytes, hex-encoded.
export const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required(),
});

export const resendVerificationSchema = Joi.object({
  email: email.required(),
});

export const requestPasswordResetSchema = Joi.object({
  email: email.required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().hex().length(64).required(),
  password: password.required(),
});
