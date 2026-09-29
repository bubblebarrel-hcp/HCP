-- AlterTable
-- FR-ID-005: dateOfBirth moves from a typed date column to an opaque
-- ciphertext blob (utils/field-crypto.ts). The cast preserves the existing
-- plaintext value as YYYY-MM-DD text; the follow-up data migration
-- (encrypt-person-profile-fields.ts) then encrypts it and every other
-- sensitive PersonProfile column in place.
ALTER TABLE "PersonProfile" ALTER COLUMN "dateOfBirth" SET DATA TYPE TEXT USING "dateOfBirth"::TEXT;
