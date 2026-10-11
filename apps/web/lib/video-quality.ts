import type { VideoRendition } from '@/lib/types';

// D69. Which size of a clip to play. The clip's own url is the 720p default; its
// renditions are a 360p for slow connections and a 1080p when it was uploaded that
// large. Asking for a size that does not exist gets the nearest one that does,
// never nothing: a clip with no renditions at all plays at its default.

export type VideoQuality = 'auto' | '360p' | '720p' | '1080p';

export const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '360p', label: '360p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// Auto means the small one on a connection that says it is slow or asked to save
// data, and the default otherwise. Not every browser tells us; those get the default.
function connectionIsSlow() {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return Boolean(connection.saveData) || ['slow-2g', '2g', '3g'].includes(connection.effectiveType ?? '');
}

export function pickVideoSource(
  url: string,
  renditions: VideoRendition[] | undefined,
  quality: VideoQuality,
  dataSaver: boolean,
): string {
  const small = renditions?.find((r) => r.label === '360p');
  const large = renditions?.find((r) => r.label === '1080p');
  const wanted: VideoQuality = quality === 'auto' ? (dataSaver || connectionIsSlow() ? '360p' : '720p') : quality;
  if (wanted === '360p') return small?.url ?? url;
  if (wanted === '1080p') return large?.url ?? url;
  return url;
}
