import type { ImagePickerAsset } from 'expo-image-picker';

import { api } from '@/lib/api';

// Photos and videos never pass through our own API: it hands out an upload
// target, the phone PUTs the bytes straight to storage, then confirms (D28).
// The same three steps as apps/web/lib/media.ts. Unlike a browser, the picker
// already measured the file, so there is no element to measure it with.

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export function assetKind(asset: ImagePickerAsset): 'PHOTO' | 'VIDEO' {
  return asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'VIDEO' : 'PHOTO';
}

// The picker usually knows the type; when it does not, the extension is the
// next best thing, and a phone's own camera roll is jpeg or mp4 far more often
// than not.
export function assetMimeType(asset: ImagePickerAsset) {
  const kind = assetKind(asset);
  const known = asset.mimeType?.toLowerCase();
  if (known && (kind === 'VIDEO' ? VIDEO_TYPES : IMAGE_TYPES).includes(known)) return known;
  const ext = (asset.fileName ?? asset.uri).split('?')[0].split('.').pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    avif: 'image/avif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };
  return (ext && byExt[ext]) || (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg');
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// `slot` is the item's place in the post. It is the idempotency key, so a retry
// of the same item on the same reel resumes rather than uploads twice.
export async function uploadAsset(asset: ImagePickerAsset, target: { type: 'REEL' | 'POST'; id: string }, slot: number) {
  const kind = assetKind(asset);
  const mimeType = assetMimeType(asset);

  // The size the picker reports can be missing; the bytes are the truth.
  const bytes = await (await fetch(asset.uri)).blob();
  if (bytes.size > MAX_UPLOAD_BYTES) {
    throw new Error(`That ${kind === 'VIDEO' ? 'video' : 'photo'} is ${fileSize(bytes.size)}. Each one must be 25MB or smaller.`);
  }

  const asked = await api<{ media: { id: string }; upload: UploadTarget }>('/media/uploads', {
    method: 'POST',
    body: {
      kind,
      mimeType,
      sizeBytes: bytes.size,
      target,
      caption: null,
      clientId: `${target.type}:${target.id}:${slot}`,
    },
  });

  const put = await fetch(asked.upload.url, {
    method: asked.upload.method,
    headers: asked.upload.headers,
    body: bytes,
  });
  if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);

  await api(`/media/${asked.media.id}/confirm`, {
    method: 'POST',
    body: {
      width: asset.width || null,
      height: asset.height || null,
      durationSec: kind === 'VIDEO' && asset.duration ? Math.round(asset.duration / 100) / 10 : null,
    },
  });
  return asked.media.id;
}
