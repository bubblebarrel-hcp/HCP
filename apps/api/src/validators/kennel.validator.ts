import Joi from 'joi';

const text = (max: number) => Joi.string().trim().max(max);
const optionalText = (max: number) => text(max).allow('', null);

// Mirrored by the admin app's Zod schema (apps/admin/lib/schemas.ts).
// Changing one means changing the other.
const kennelFields = {
  name: text(120),
  shortName: text(40),
  orgType: Joi.string().valid(
    'LOCAL_KENNEL',
    'REGIONAL_ASSOCIATION',
    'NATIONAL_ASSOCIATION',
    'CONTINENTAL_ASSOCIATION',
    'INTERNATIONAL_COMMITTEE',
    'WORKING_GROUP',
    'HERITAGE_FOUNDATION',
    'TEMPORARY_EVENT_COMMITTEE',
  ),
  country: text(80),
  stateProvince: text(80),
  city: text(80),
  timeZone: text(60),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  description: text(4000),
  logoUrl: Joi.string().uri().allow('', null),
  bannerUrl: Joi.string().uri().allow('', null),
  // A CSS background-position pair in per cent ("50% 30%"): which part of the
  // banner the crop shows. Kept to two percentages so it can only ever be
  // written into a style attribute, never arbitrary CSS.
  bannerPosition: Joi.string()
    .trim()
    .pattern(/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/)
    .message('Banner position must be two percentages, e.g. "50% 30%"')
    .allow('', null),
  motto: optionalText(200),
  meetingDay: optionalText(40),
  status: Joi.string().valid('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'ARCHIVED'),
  verificationLevel: Joi.string().valid('PENDING', 'COMMUNITY_VERIFIED', 'OFFICER_VERIFIED', 'PLATFORM_VERIFIED'),
  visibility: Joi.string().valid('PUBLIC', 'UNLISTED', 'HIDDEN'),
  defaultRunVisibility: Joi.string().valid('PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY'),
  // FR-CIRCLE-006: "Kennels may disable this feature" (down-downs).
  downDownsEnabled: Joi.boolean(),
  // D45 follow-up: null (or an empty field on the form) means "use the
  // platform default" (settings.service.ts#SETTING_DEFAULTS).
  hareNudgeSoonDays: Joi.number().integer().min(1).max(180).allow(null),
  hareNudgeUrgentDays: Joi.number().integer().min(0).max(180).allow(null),
};

export const createKennelSchema = Joi.object({
  ...kennelFields,
  name: kennelFields.name.required(),
  shortName: kennelFields.shortName.required(),
  country: kennelFields.country.required(),
  stateProvince: kennelFields.stateProvince.required(),
  city: kennelFields.city.required(),
  timeZone: kennelFields.timeZone.required(),
  description: kennelFields.description.required(),
});

export const updateKennelSchema = Joi.object(kennelFields).min(1);

export const listKennelsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow(''),
  country: Joi.string().trim().max(80).allow(''),
  status: Joi.string().valid('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'ARCHIVED'),
});

// FR-KENNEL-001 self-service founding (D33). Deliberately narrower than
// createKennelSchema: status, verificationLevel and visibility are NOT accepted,
// so a founder cannot hand themselves an ACTIVE, PLATFORM_VERIFIED kennel.
export const foundKennelSchema = Joi.object({
  name: kennelFields.name.required(),
  shortName: kennelFields.shortName.required(),
  orgType: kennelFields.orgType,
  country: kennelFields.country.required(),
  stateProvince: kennelFields.stateProvince.required(),
  city: kennelFields.city.required(),
  timeZone: kennelFields.timeZone.required(),
  description: kennelFields.description.required(),
  // Optional, but a kennel with coordinates appears on the world map.
  latitude: kennelFields.latitude,
  longitude: kennelFields.longitude,
  motto: kennelFields.motto,
  meetingDay: kennelFields.meetingDay,
  logoUrl: kennelFields.logoUrl,
  bannerUrl: kennelFields.bannerUrl,
  bannerPosition: kennelFields.bannerPosition,
});

// D34: what a kennel admin may change about their own kennel. Everything here
// is presentation or policy; status and verificationLevel are deliberately
// absent, because standing is earned (D10) and granted by the platform, never
// set by the kennel itself.
export const kennelSettingsSchema = Joi.object({
  name: kennelFields.name,
  shortName: kennelFields.shortName,
  description: kennelFields.description,
  motto: kennelFields.motto,
  meetingDay: kennelFields.meetingDay,
  logoUrl: kennelFields.logoUrl,
  bannerUrl: kennelFields.bannerUrl,
  bannerPosition: kennelFields.bannerPosition,
  landingMessage: optionalText(2000),
  primaryColor: optionalText(20),
  secondaryColor: optionalText(20),
  country: kennelFields.country,
  stateProvince: kennelFields.stateProvince,
  city: kennelFields.city,
  timeZone: kennelFields.timeZone,
  latitude: kennelFields.latitude,
  longitude: kennelFields.longitude,
  visibility: kennelFields.visibility,
  defaultRunVisibility: kennelFields.defaultRunVisibility,
  downDownsEnabled: kennelFields.downDownsEnabled,
  hareNudgeSoonDays: kennelFields.hareNudgeSoonDays,
  hareNudgeUrgentDays: kennelFields.hareNudgeUrgentDays,
}).min(1);

export const abandonKennelSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});
