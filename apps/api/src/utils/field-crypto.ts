import crypto from 'crypto';
import { env } from '../config/env';

// FR-ID-005: PersonProfile's most sensitive biodata (date of birth, phone,
// emergency contacts, medical notes) is encrypted at the application layer,
// not just protected by database access control. AES-256-GCM: a random IV per
// value and the auth tag travel with the ciphertext, so a value can be
// decrypted on its own without a lookup table.
//
// Encrypted columns are plain String columns holding "v1:<iv>:<tag>:<ciphertext>"
// (all base64), never the structured/typed column the plaintext would suggest —
// a date of birth stored this way cannot be queried or sorted by Postgres,
// which is the point: nothing but the application should be able to read it.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function key(): Buffer {
  const buf = Buffer.from(env.personEncryptionKey, 'hex');
  if (buf.length !== 32) {
    throw new Error('PERSON_ENCRYPTION_KEY must be 32 bytes, hex-encoded (64 hex characters)');
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptField(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unrecognized encrypted field format');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

export function encryptOptionalField(plaintext: string | null | undefined): string | null {
  return plaintext == null ? null : encryptField(plaintext);
}

export function decryptOptionalField(stored: string | null | undefined): string | null {
  return stored == null ? null : decryptField(stored);
}
