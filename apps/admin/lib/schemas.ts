import { z } from 'zod';
import { KENNEL_STATUSES, KENNEL_VISIBILITIES, ORG_TYPES, RUN_VISIBILITIES, VERIFICATION_LEVELS, type AdminKennel } from './types';

// Mirrors apps/api/src/validators/kennel.validator.ts (Joi). Changing one means
// changing the other. Numbers are kept as strings in the form and converted in
// toKennelPayload, so an empty coordinate field means "none", not 0.
const required = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const optional = (max: number) => z.string().trim().max(max);

const coordinate = (label: string, bound: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= bound), `${label} must be between -${bound} and ${bound}`);

const url = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Must be a full http(s) URL');

export const kennelSchema = z.object({
  name: required('Name', 120),
  shortName: required('Short name', 40),
  orgType: z.enum(ORG_TYPES),
  country: required('Country', 80),
  stateProvince: required('State / province', 80),
  city: required('City', 80),
  timeZone: required('Time zone', 60),
  latitude: coordinate('Latitude', 90),
  longitude: coordinate('Longitude', 180),
  description: required('Description', 4000),
  logoUrl: url,
  bannerUrl: url,
  motto: optional(200),
  meetingDay: optional(40),
  status: z.enum(KENNEL_STATUSES),
  verificationLevel: z.enum(VERIFICATION_LEVELS),
  visibility: z.enum(KENNEL_VISIBILITIES),
  defaultRunVisibility: z.enum(RUN_VISIBILITIES),
});

export type KennelFormValues = z.infer<typeof kennelSchema>;

export const emptyKennel: KennelFormValues = {
  name: '',
  shortName: '',
  orgType: 'LOCAL_KENNEL',
  country: '',
  stateProvince: '',
  city: '',
  timeZone: 'Africa/Lagos',
  latitude: '',
  longitude: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  motto: '',
  meetingDay: '',
  // FR-KENNEL-001: new kennels start as Pending Verification
  status: 'PENDING_VERIFICATION',
  verificationLevel: 'PENDING',
  visibility: 'PUBLIC',
  defaultRunVisibility: 'MEMBERS_ONLY',
};

export function kennelToForm(k: AdminKennel): KennelFormValues {
  return {
    name: k.name,
    shortName: k.shortName,
    orgType: k.orgType,
    country: k.country,
    stateProvince: k.stateProvince,
    city: k.city,
    timeZone: k.timeZone,
    latitude: k.latitude === null ? '' : String(k.latitude),
    longitude: k.longitude === null ? '' : String(k.longitude),
    description: k.description,
    logoUrl: k.logoUrl ?? '',
    bannerUrl: k.bannerUrl ?? '',
    motto: k.motto ?? '',
    meetingDay: k.meetingDay ?? '',
    status: k.status,
    verificationLevel: k.verificationLevel,
    visibility: k.visibility,
    defaultRunVisibility: k.defaultRunVisibility,
  };
}

export function toKennelPayload(v: KennelFormValues) {
  return {
    ...v,
    latitude: v.latitude === '' ? null : Number(v.latitude),
    longitude: v.longitude === '' ? null : Number(v.longitude),
    logoUrl: v.logoUrl || null,
    bannerUrl: v.bannerUrl || null,
    motto: v.motto || null,
    meetingDay: v.meetingDay || null,
  };
}
