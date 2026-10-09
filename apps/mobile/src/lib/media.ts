import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { type VideoPlayer, createVideoPlayer } from 'expo-video';

import { api } from '@/lib/api';
import type { MediaAsset } from '@/lib/types';

// Photos and videos never pass through our own API: it hands out an upload
// target, the phone PUTs the bytes straight to storage, then confirms (D28).
// The same three steps as apps/web/lib/media.ts. Unlike a browser, the picker
// already measured the file, so there is no element to measure it with.

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// A video on a post may be larger; everything else keeps the cap above. The API
// holds the same line (MEDIA_MAX_POST_VIDEO_BYTES).
export const MAX_POST_VIDEO_BYTES = 100 * 1024 * 1024;

// The most one file may weigh where it is going.
function uploadLimit(kind: 'PHOTO' | 'VIDEO', targetType?: string) {
  return kind === 'VIDEO' && targetType === 'POST' ? MAX_POST_VIDEO_BYTES : MAX_UPLOAD_BYTES;
}

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

// A phone films far more than a reel needs. On iOS the picker can re-encode the
// clip as 720p H.264 on the way out of the library, which is what keeps a
// thirty-second clip under the 25MB cap (D41); the camera is asked for medium
// quality for the same reason. Android's picker has no such option, so a long
// clip there can still be over the cap and the error says what to do about it.
// (Both options are ignored where they do not apply.)
export const VIDEO_PICK_OPTIONS = {
  videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
} as const;

export function tooBigMessage(kind: 'PHOTO' | 'VIDEO', bytes: number, name?: string | null, targetType?: string) {
  const what = name ?? `That ${kind === 'VIDEO' ? 'video' : 'photo'}`;
  return `${what} is ${fileSize(bytes)}. Each one must be ${Math.round(uploadLimit(kind, targetType) / (1024 * 1024))}MB or smaller${
    kind === 'VIDEO' ? ': try a shorter clip, or trim it in your Photos app first' : ''
  }.`;
}

// What the picker adds to what is already chosen for a post: four in all, at most
// one of them a video, each within the upload limit (the API holds the same line).
// Whatever does not fit is left out and the first reason comes back, so the
// composer can say why.
export const MAX_POST_MEDIA = 4;

export function mergePostMedia(
  current: ImagePickerAsset[],
  picked: ImagePickerAsset[],
): { assets: ImagePickerAsset[]; error: string | null } {
  const assets = [...current];
  let error: string | null = null;
  for (const asset of picked) {
    const kind = assetKind(asset);
    if (asset.fileSize !== undefined && asset.fileSize > uploadLimit(kind, 'POST')) {
      error ??= tooBigMessage(kind, asset.fileSize, asset.fileName, 'POST');
    } else if (kind === 'VIDEO' && assets.some((a) => assetKind(a) === 'VIDEO')) {
      error ??= 'A post carries one video.';
    } else if (assets.length >= MAX_POST_MEDIA) {
      error ??= `${MAX_POST_MEDIA} is the limit on a post.`;
    } else {
      assets.push(asset);
    }
  }
  return { assets, error };
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// `slot` is the item's place in the post. It is the idempotency key, so a retry
// of the same item on the same reel resumes rather than uploads twice.
export type MediaTarget = { type: 'REEL' | 'POST' | 'PROFILE' | 'KENNEL' | 'RUN' | 'GALLERY' | 'TRAIL' | 'CIRCLE'; id: string };

// Same road as the web's uploadPhoto (apps/web/lib/media.ts): ask for a target, PUT the
// bytes, confirm. Returns the media id and, once confirmed, its public address.

// The bytes go straight to storage with XMLHttpRequest rather than fetch, because
// fetch cannot say how much of a body has gone: a 20MB clip on a bad connection is
// a long minute, and "Uploading 2 of 3…" with nothing moving looks like a hang.
// `onProgress` gets 0 to 1 for this one file.
function putWithProgress(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress?: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`Storage rejected the upload (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('The upload could not reach storage. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Try again on a better connection.'));
    xhr.send(body);
  });
}

export async function uploadAssetFull(
  asset: ImagePickerAsset,
  target: MediaTarget,
  slot: number,
  caption?: string,
  onProgress?: (fraction: number) => void,
) {
  return uploadInternal(asset, target, slot, caption ?? null, onProgress);
}

export async function uploadAsset(
  asset: ImagePickerAsset,
  target: MediaTarget,
  slot: number,
  onProgress?: (fraction: number) => void,
) {
  return (await uploadInternal(asset, target, slot, null, onProgress)).id;
}

async function uploadInternal(
  asset: ImagePickerAsset,
  target: MediaTarget,
  slot: number,
  caption: string | null,
  onProgress?: (fraction: number) => void,
) {
  const kind = assetKind(asset);
  const mimeType = assetMimeType(asset);

  // The size the picker reports can be missing; the bytes are the truth.
  const bytes = await (await fetch(asset.uri)).blob();
  if (bytes.size > uploadLimit(kind, target.type)) {
    throw new Error(tooBigMessage(kind, bytes.size, null, target.type));
  }

  const asked = await api<{ media: { id: string }; upload: UploadTarget }>('/media/uploads', {
    method: 'POST',
    body: {
      kind,
      mimeType,
      sizeBytes: bytes.size,
      target,
      caption,
      clientId: `${target.type}:${target.id}:${slot}`,
    },
  });

  await putWithProgress(asked.upload.url, asked.upload.method, asked.upload.headers, bytes, onProgress);

  const confirmed = await api<{ media: MediaAsset }>(`/media/${asked.media.id}/confirm`, {
    method: 'POST',
    body: {
      width: asset.width || null,
      height: asset.height || null,
      durationSec: kind === 'VIDEO' && asset.duration ? Math.round(asset.duration / 100) / 10 : null,
    },
  });

  // A clip has no picture of its own, so a frame is grabbed for its cover (D41),
  // the same as the web does at upload. Worth having, never worth failing an
  // upload over: a reel without one shows its kennel colour and a play icon.
  let media = confirmed.media;
  if (kind === 'VIDEO') {
    try {
      const image = await grabPoster(asset.uri, asset.duration ? asset.duration / 1000 : null);
      if (image) {
        const posted = await api<{ media: MediaAsset }>(`/media/${asked.media.id}/poster`, {
          method: 'POST',
          body: { image },
        });
        media = posted.media ?? media;
      }
    } catch {
      // The reel still plays.
    }
  }
  return { id: asked.media.id, url: media?.url ?? null, media };
}

// The first moment of the clip as a small JPEG data URL. A hair in, not frame
// zero: a clip that fades up from black would otherwise get a black cover.
// The player has to have the clip loaded before it can be asked for a frame, and
// a clip that will not load in a few seconds is not worth holding the post for.
const POSTER_WIDTH = 480;
const POSTER_LOAD_MS = 8000;

function loaded(player: VideoPlayer) {
  if (player.status === 'readyToPlay') return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      subscription.remove();
      resolve(false);
    }, POSTER_LOAD_MS);
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status !== 'readyToPlay' && status !== 'error') return;
      clearTimeout(timer);
      subscription.remove();
      resolve(status === 'readyToPlay');
    });
  });
}

export async function grabPoster(uri: string, durationSec?: number | null): Promise<string | null> {
  let player: VideoPlayer | null = null;
  try {
    player = createVideoPlayer({ uri });
    if (!(await loaded(player))) return null;
    const at = durationSec && durationSec > 0 ? Math.min(0.2, durationSec / 2) : 0;
    const [thumbnail] = await player.generateThumbnailsAsync(at, { maxWidth: POSTER_WIDTH });
    if (!thumbnail) return null;
    const image = await ImageManipulator.ImageManipulator.manipulate(thumbnail).renderAsync();
    const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.75, base64: true });
    return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
  } catch {
    return null;
  } finally {
    player?.release();
  }
}
