import type { ActivityAudience, ActivityKind } from '@/lib/types';

// How a recording reads (D79): the same figures on the live screen, the summary,
// the list and the Passport.

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatDistance(metres: number) {
  return (metres / 1000).toFixed(2);
}

// Seconds per kilometre as m:ss, or a dash when there is no pace to give.
export function formatPace(secondsPerKm: number | null | undefined) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm) || secondsPerKm > 3600) return '–:––';
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const kindLabel: Record<ActivityKind, string> = {
  HASH_RUN: 'Hash run',
  TRAIL_LAYING: 'Laying the trail',
  SOLO: 'Solo run',
};

export const audienceLabel: Record<ActivityAudience, string> = {
  PUBLIC: 'Everyone',
  FOLLOWERS: 'Followers',
  ONLY_ME: 'Only me',
};

export const audienceNote: Record<ActivityAudience, string> = {
  PUBLIC: 'Anyone can see this run once the trail is out. The first and last 200 m are always hidden.',
  FOLLOWERS: 'Only hashers who follow you. The first and last 200 m are hidden from them.',
  ONLY_ME: 'Only you can see it.',
};

// What a run is called before the hasher names it.
export function defaultTitle(kind: ActivityKind, startedAt: Date, runTitle?: string | null) {
  if (runTitle) return kind === 'TRAIL_LAYING' ? `Trail for ${runTitle}` : runTitle;
  const h = startedAt.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} run`;
}
