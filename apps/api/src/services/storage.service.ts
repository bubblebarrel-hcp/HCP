import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Object storage for photos and media. Cloudflare R2 is S3-compatible, so the
// AWS SDK talks to it directly.
//
// Without R2 credentials the driver falls back to local disk, so development
// works before the bucket exists and the code path stays identical: the client
// always asks for an upload target, PUTs the file to it, then confirms.

export type StorageDriver = 'r2' | 'local';

export const storageDriver: StorageDriver = env.r2.configured ? 'r2' : 'local';

const LOCAL_ROOT = path.join(process.cwd(), 'uploads');
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

const client = env.r2.configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.r2.accessKeyId, secretAccessKey: env.r2.secretAccessKey },
    })
  : null;

if (storageDriver === 'local') {
  logger.warn?.('R2 is not configured: media uploads are stored on local disk (CODEX/PROVIDERS.md)');
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/webm': '.weba',
  'application/pdf': '.pdf',
};

export function extensionFor(mimeType: string) {
  return EXTENSIONS[mimeType] ?? '';
}

// Keys are date-prefixed so a bucket listing stays browsable, and random so one
// upload can never overwrite another.
export function buildStorageKey(prefix: string, mimeType: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}/${yyyy}/${mm}/${randomUUID()}${extensionFor(mimeType)}`;
}

export interface UploadTarget {
  driver: StorageDriver;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
}

// The browser uploads straight to storage; the API never carries the bytes.
export async function createUploadTarget(storageKey: string, mimeType: string): Promise<UploadTarget> {
  if (client) {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: env.r2.bucket, Key: storageKey, ContentType: mimeType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return { driver: 'r2', url, method: 'PUT', headers: { 'Content-Type': mimeType }, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  return {
    driver: 'local',
    url: `${env.apiBaseUrl}/api/v1/media/local/${storageKey}`,
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

export function publicUrlFor(storageKey: string) {
  if (storageDriver === 'r2') {
    // Without a public domain the bucket is private; the URL is filled in when
    // R2_PUBLIC_BASE_URL is set (or later, by signed read URLs).
    return env.r2.publicBaseUrl ? `${env.r2.publicBaseUrl}/${storageKey}` : null;
  }
  return `${env.apiBaseUrl}/uploads/${storageKey}`;
}

// Local driver only: the API receives the bytes itself.
export async function writeLocalObject(storageKey: string, body: Buffer) {
  const safeKey = path.normalize(storageKey).replace(/^(\.\.[/\\])+/, '');
  const destination = path.join(LOCAL_ROOT, safeKey);
  if (!destination.startsWith(LOCAL_ROOT)) throw new Error('Invalid storage key');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
  return destination;
}

// For small objects the API itself produces or receives, such as a video's
// poster frame. Anything large still goes browser to storage by presigned PUT.
export async function putObject(storageKey: string, body: Buffer, mimeType: string) {
  if (client) {
    await client.send(
      new PutObjectCommand({ Bucket: env.r2.bucket, Key: storageKey, Body: body, ContentType: mimeType }),
    );
    return;
  }
  await writeLocalObject(storageKey, body);
}

export const localRoot = LOCAL_ROOT;

export async function deleteObject(storageKey: string) {
  if (client) {
    await client.send(new DeleteObjectCommand({ Bucket: env.r2.bucket, Key: storageKey }));
    return;
  }
  await rm(path.join(LOCAL_ROOT, storageKey), { force: true });
}
