import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { encryptField, encryptOptionalField } from '../src/utils/field-crypto';

// One-time data migration for FR-ID-005 (migration
// 20260924094404_encrypt_person_profile_fields moved the columns to text but
// left existing values as plaintext). Detects already-encrypted rows by the
// "v1:" prefix so it is safe to re-run.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

function isEncrypted(value: string | null) {
  return value != null && value.startsWith('v1:');
}

async function main() {
  const rows = await prisma.personProfile.findMany({
    select: {
      id: true,
      dateOfBirth: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelationship: true,
      medicalNotes: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    if (
      isEncrypted(row.dateOfBirth) &&
      isEncrypted(row.phone) &&
      isEncrypted(row.emergencyContactName) &&
      isEncrypted(row.emergencyContactPhone) &&
      isEncrypted(row.emergencyContactRelationship) &&
      (row.medicalNotes == null || isEncrypted(row.medicalNotes))
    ) {
      continue;
    }

    await prisma.personProfile.update({
      where: { id: row.id },
      data: {
        dateOfBirth: isEncrypted(row.dateOfBirth) ? row.dateOfBirth : encryptField(row.dateOfBirth),
        phone: isEncrypted(row.phone) ? row.phone : encryptField(row.phone),
        emergencyContactName: isEncrypted(row.emergencyContactName)
          ? row.emergencyContactName
          : encryptField(row.emergencyContactName),
        emergencyContactPhone: isEncrypted(row.emergencyContactPhone)
          ? row.emergencyContactPhone
          : encryptField(row.emergencyContactPhone),
        emergencyContactRelationship: isEncrypted(row.emergencyContactRelationship)
          ? row.emergencyContactRelationship
          : encryptField(row.emergencyContactRelationship),
        medicalNotes: isEncrypted(row.medicalNotes) ? row.medicalNotes : encryptOptionalField(row.medicalNotes),
      },
    });
    updated += 1;
  }

  console.log(`Encrypted ${updated} of ${rows.length} PersonProfile row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
