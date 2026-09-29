import type { MediaAsset, MediaTarget } from '@/lib/types';
import api from '@/services/api';

// Photos never pass through our own API: it hands out an upload target, the
// browser PUTs the bytes straight to storage, then confirms (D28).

export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/heic,image/avif';
export const ACCEPTED_VIDEOS = 'video/mp4,video/quicktime,video/webm';
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

// Width and height are the client's to measure; a failure here is not worth
// failing an upload over.
async function readDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export async function uploadPhoto(file: File, target: MediaTarget, caption?: string) {
  return uploadFile(file, target, { kind: 'PHOTO', caption });
}

// A reel's video travels the same road as a photo: an upload target from the
// API, a PUT straight to storage, then a confirm (D28).
export async function uploadVideo(file: File, target: MediaTarget, caption?: string) {
  return uploadFile(file, target, { kind: 'VIDEO', caption });
}

async function uploadFile(
  file: File,
  target: MediaTarget,
  opts: { kind: 'PHOTO' | 'VIDEO'; caption?: string },
): Promise<MediaAsset> {
  const asked = await api.post<{ data: { media: MediaAsset; upload: UploadTarget; reused: boolean } }>(
    '/media/uploads',
    {
      kind: opts.kind,
      mimeType: file.type,
      sizeBytes: file.size,
      target,
      caption: opts.caption ?? null,
      // Lets a retry of the same file resume rather than duplicate.
      clientId: `${target.type}:${target.id}:${file.name}:${file.size}:${file.lastModified}`,
    },
  );
  const { media, upload } = asked.data.data;

  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  if (!put.ok) throw new Error(`Storage rejected the upload (${put.status})`);

  const measured = opts.kind === 'VIDEO' ? await readVideo(file) : await readDimensions(file);
  const confirmed = await api.post<{ data: { media: MediaAsset } }>(`/media/${media.id}/confirm`, measured);
  return confirmed.data.data.media;
}

// A video's size and length come from the element that will play it. Same rule
// as an image: worth having, never worth failing an upload over.
function readVideo(file: File) {
  return new Promise<{ width: number | null; height: number | null; durationSec: number | null }>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: { width: number | null; height: number | null; durationSec: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      done({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSec: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
      });
    video.onerror = () => done({ width: null, height: null, durationSec: null });
    video.src = url;
  });
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
