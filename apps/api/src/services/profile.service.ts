import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
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

// ─── Profile picture and banner (D56) ───

export interface ProfileImagesInput {
  // A MediaAsset id, or null to remove the picture. Absent leaves it alone.
  avatarMediaId?: string | null;
  bannerMediaId?: string | null;
}

// The picture on a hasher's public page is part of their public identity (D11),
// so it is written to User, not to the private PersonProfile. What is accepted
// is a media asset id, never a URL: the only picture a hasher can point their
// profile at is one they uploaded themselves, to their own profile, and that has
// finished landing. A URL field would let anybody hot-link anything, or a
// tracking pixel, into a page other people open.
async function ownProfileImageUrl(userId: string, mediaId: string) {
  if (!isUuid(mediaId)) throw ApiError.badRequest('That picture was not found.', 'INVALID_PROFILE_IMAGE');
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      uploaderId: userId,
      kind: 'PHOTO',
      uploadState: 'AVAILABLE',
      moderationState: { not: 'REJECTED' },
      links: { some: { targetType: 'PROFILE', targetId: userId } },
    },
    select: { url: true },
  });
  if (!asset?.url) {
    throw ApiError.badRequest(
      'That picture is not ready or is not one you uploaded for your profile.',
      'INVALID_PROFILE_IMAGE',
    );
  }
  return asset.url;
}

export async function setProfileImages(userId: string, input: ProfileImagesInput) {
  const data: { avatarUrl?: string | null; bannerUrl?: string | null } = {};
  if (input.avatarMediaId !== undefined) {
    data.avatarUrl = input.avatarMediaId === null ? null : await ownProfileImageUrl(userId, input.avatarMediaId);
  }
  if (input.bannerMediaId !== undefined) {
    data.bannerUrl = input.bannerMediaId === null ? null : await ownProfileImageUrl(userId, input.bannerMediaId);
  }

  const user = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: userId },
      data,
      select: { avatarUrl: true, bannerUrl: true },
    });
    // The previous picture's MediaAsset is kept: attribution and history are
    // permanent here, and a removed picture is simply no longer pointed at.
    const fields = Object.keys(data);
    const event = await recordEvent(tx, {
      eventType: 'ProfileUpdated',
      aggregateType: 'Identity',
      aggregateId: userId,
      actorId: userId,
      payload: { fields },
    });
    await recordAudit(tx, {
      actorId: userId,
      action: 'identity.profile.images',
      resourceType: 'Identity',
      resourceId: userId,
      newState: { fields, removed: fields.filter((f) => data[f as keyof typeof data] === null) },
      domainEventId: event.id,
    });
    return row;
  });

  return user;
}
