import Joi from 'joi';

const text = (max: number) => Joi.string().trim().max(max);

// Mirrors registerSchema's biodata fields (auth.validator.ts), minus email,
// password and acceptTerms — this is the same D5 shape, editable after the
// fact. Every field is optional: a PATCH only touches what it sends.
export const updateProfileSchema = Joi.object({
  firstName: text(80),
  middleName: text(80).allow('', null),
  lastName: text(80),

  dateOfBirth: Joi.date().iso().max('now'),
  gender: Joi.string().valid('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'),
  phone: text(40),
  nationality: text(80),
  country: text(80),
  stateProvince: text(80),
  city: text(80),
  addressLine: text(200).allow('', null),
  occupation: text(120).allow('', null),
  languages: Joi.array().items(text(40)).max(10),

  emergencyContactName: text(120),
  emergencyContactPhone: text(40),
  emergencyContactRelationship: text(60),

  medicalNotes: text(2000).allow('', null),
}).min(1);

// D56. Media ids, never URLs: see profile.service#setProfileImages.
export const profileImagesSchema = Joi.object({
  avatarMediaId: Joi.string().uuid().allow(null),
  bannerMediaId: Joi.string().uuid().allow(null),
}).min(1);
