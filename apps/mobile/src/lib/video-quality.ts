import type { VideoRendition } from '@/lib/types';

// D69 (web lib/video-quality.ts). Which size of a clip to play. The clip's own url
// is the 720p default; its renditions are a 360p for slow connections and a 1080p
// when it was uploaded that large. A size that does not exist gets the default,
// never nothing.

export type VideoQuality = 'auto' | '360p' | '720p' | '1080p';

export const QUALITY_OPTIONS: { value: VideoQuality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '360p', label: '360p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

// There is no network-type API here without another native module, so Auto means
// the default size, and the small one when Data saver is on.
export function pickVideoSource(
  url: string,
  renditions: VideoRendition[] | undefined,
  quality: VideoQuality,
  dataSaver: boolean,
): string {
  const wanted: VideoQuality = quality === 'auto' ? (dataSaver ? '360p' : '720p') : quality;
  if (wanted === '360p') return renditions?.find((r) => r.label === '360p')?.url ?? url;
  if (wanted === '1080p') return renditions?.find((r) => r.label === '1080p')?.url ?? url;
  return url;
}
