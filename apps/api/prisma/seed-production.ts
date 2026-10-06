import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Gender, PlatformRole, PrismaClient, TrustLevel } from '@prisma/client';
import { encryptField } from '../src/utils/field-crypto';

// The seed for a real database: one platform admin and the platform settings the
// app expects, nothing else. No demo hashers, officers, kennels or runs.
//
// Idempotent. The admin email and password are required (no defaults, so the
// public dev credentials can never reach production) and are read from
// ADMIN_EMAIL / ADMIN_PASSWORD. If that user already exists it is promoted to
// ADMIN and its password is left alone, unless RESET_ADMIN_PASSWORD=1.
//
// Run it with the production variables (PERSON_ENCRYPTION_KEY must match the
// API's, or the profile it writes cannot be decrypted there). From outside
// Railway the internal DATABASE_URL does not resolve: set SEED_DATABASE_URL to
// the public one and it wins over DATABASE_URL.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: (process.env.SEED_DATABASE_URL || process.env.DATABASE_URL) as string }),
});

const MIN_PASSWORD_LENGTH = 12;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = required('ADMIN_EMAIL').toLowerCase();
  const password = required('ADMIN_PASSWORD');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (email.endsWith('@hcp.test')) {
    throw new Error('ADMIN_EMAIL must be a real address, not a @hcp.test dev account');
  }
  const resetPassword = process.env.RESET_ADMIN_PASSWORD === '1';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        platformRole: PlatformRole.ADMIN,
        ...(resetPassword ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      },
    });
    console.log(`Admin ${email} already existed: ensured ADMIN role${resetPassword ? ', password reset' : ''}.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        platformRole: PlatformRole.ADMIN,
        hashHandle: 'Admin Wipes',
        username: 'admin',
        trustLevel: TrustLevel.VERIFIED_EMAIL,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        // PersonProfile is required but private; placeholders until the admin edits their own profile.
        person: {
          create: {
            firstName: 'Platform',
            lastName: 'Admin',
            dateOfBirth: encryptField('1970-01-01'),
            gender: Gender.PREFER_NOT_TO_SAY,
            phone: encryptField('+0000000000'),
            nationality: 'Nigeria',
            country: 'Nigeria',
            stateProvince: 'Imo',
            city: 'Owerri',
            languages: ['English'],
            emergencyContactName: encryptField('Not provided'),
            emergencyContactPhone: encryptField('+0000000000'),
            emergencyContactRelationship: encryptField('Not provided'),
          },
        },
        passport: { create: {} },
        hashNames: { create: { name: 'Admin Wipes', isPrimary: true } },
      },
    });
    console.log(`Created admin ${email}.`);
  }

  // `update: {}` keeps any value an admin has since changed in the dashboard.
  await prisma.platformSetting.upsert({
    where: { key: 'kennel.verification.minMismanagement' },
    create: {
      key: 'kennel.verification.minMismanagement',
      value: 4,
      description: 'D10: minimum active mismanagement members for kennel verification',
    },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: 'membership.reapplyCooldownDays' },
    create: {
      key: 'membership.reapplyCooldownDays',
      value: 30,
      description: 'D20: days after a rejection or removal before the hasher may ask to join that kennel again',
    },
    update: {},
  });
  console.log('Platform settings ensured.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
