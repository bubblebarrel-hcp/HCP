import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import { decryptField, decryptOptionalField, encryptField, encryptOptionalField } from '../utils/field-crypto';
import { recordAudit, recordEvent } from './record.service';

// D5/FR-ID-005: full biodata is required at registration but private ever
// after — this is the one place a hasher can see and change their own. The
// five encrypted columns (utils/field-crypto.ts) are decrypted only here, for
// the account's own owner, and never through any list or search endpoint.

const profileSelect = {
  firstName: true,
  middleName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
  nationality: true,
  country: true,
  stateProvince: true,
  city: true,
  addressLine: true,
  occupation: true,
  languages: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,
  medicalNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function decorate(person: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine: string | null;
  occupation: string | null;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  medicalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    firstName: person.firstName,
    middleName: person.middleName,
    lastName: person.lastName,
    dateOfBirth: decryptField(person.dateOfBirth),
    gender: person.gender,
    phone: decryptField(person.phone),
    nationality: person.nationality,
    country: person.country,
    stateProvince: person.stateProvince,
    city: person.city,
    addressLine: person.addressLine,
    occupation: person.occupation,
    languages: person.languages,
    emergencyContactName: decryptField(person.emergencyContactName),
    emergencyContactPhone: decryptField(person.emergencyContactPhone),
    emergencyContactRelationship: decryptField(person.emergencyContactRelationship),
    medicalNotes: decryptOptionalField(person.medicalNotes),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

export async function getProfile(userId: string) {
  const [person, hashNames] = await Promise.all([
    prisma.personProfile.findUnique({ where: { userId }, select: profileSelect }),
    prisma.hashName.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isPrimary: true, isAlias: true, kennelId: true, bestowedAt: true, endedAt: true },
    }),
  ]);
  if (!person) throw ApiError.notFound('Profile not found', 'PROFILE_NOT_FOUND');

  return { ...decorate(person), hashNames };
}

export interface UpdateProfileInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  dateOfBirth?: string | Date;
  gender?: 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  phone?: string;
  nationality?: string;
  country?: string;
  stateProvince?: string;
  city?: string;
  addressLine?: string | null;
  occupation?: string | null;
  languages?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  medicalNotes?: string | null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const existing = await prisma.personProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!existing) throw ApiError.notFound('Profile not found', 'PROFILE_NOT_FOUND');

  const data: Record<string, unknown> = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.middleName !== undefined) data.middleName = input.middleName || null;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.dateOfBirth !== undefined) {
    const iso = input.dateOfBirth instanceof Date ? input.dateOfBirth.toISOString().slice(0, 10) : input.dateOfBirth;
    data.dateOfBirth = encryptField(iso);
  }
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.phone !== undefined) data.phone = encryptField(input.phone);
  if (input.nationality !== undefined) data.nationality = input.nationality;
  if (input.country !== undefined) data.country = input.country;
  if (input.stateProvince !== undefined) data.stateProvince = input.stateProvince;
  if (input.city !== undefined) data.city = input.city;
  if (input.addressLine !== undefined) data.addressLine = input.addressLine || null;
  if (input.occupation !== undefined) data.occupation = input.occupation || null;
  if (input.languages !== undefined) data.languages = input.languages;
  if (input.emergencyContactName !== undefined) data.emergencyContactName = encryptField(input.emergencyContactName);
  if (input.emergencyContactPhone !== undefined) data.emergencyContactPhone = encryptField(input.emergencyContactPhone);
  if (input.emergencyContactRelationship !== undefined) {
    data.emergencyContactRelationship = encryptField(input.emergencyContactRelationship);
  }
  if (input.medicalNotes !== undefined) data.medicalNotes = encryptOptionalField(input.medicalNotes);

  await prisma.$transaction(async (tx) => {
    await tx.personProfile.update({ where: { userId }, data });

    // Not yet in Chapter 24's Identity & Membership Events table — the same gap
    // already noted in CODEX/TODO.md for ReelPosted, HareOffered and friends:
    // the code emits it before the chapter names it.
    const event = await recordEvent(tx, {
      eventType: 'ProfileUpdated',
      aggregateType: 'Identity',
      aggregateId: userId,
      actorId: userId,
      payload: { fields: Object.keys(data) },
    });
    await recordAudit(tx, {
      actorId: userId,
      action: 'identity.profile.update',
      resourceType: 'Identity',
      resourceId: userId,
      newState: { fields: Object.keys(data) },
      domainEventId: event.id,
    });
  });

  return getProfile(userId);
}
