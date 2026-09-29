import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const verificationLabels: Record<string, string> = {
  PENDING: 'Unverified',
  COMMUNITY_VERIFIED: 'Community verified',
  OFFICER_VERIFIED: 'Officer verified',
  PLATFORM_VERIFIED: 'Platform verified',
};

export function verificationLabel(level: string) {
  return verificationLabels[level] ?? level;
}

// Cards run edge to edge on phones (no rounded corners or side borders), as in the Facebook feed.
export const bleedCard = 'rounded-none border-x-0 sm:rounded-xl sm:border-x';

// Kennel.primaryColor is admin-entered; only a plain hex value reaches a style attribute.
export function brandColor(color?: string | null) {
  return color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : null;
}

// Cover band behind a kennel's name. Covers are imagery, so the same in both
// themes. Defaults to HCP Orange when the kennel has no colour of its own (D24).
export function coverBackground(color?: string | null) {
  const base = brandColor(color) ?? '#f4511e';
  return `linear-gradient(135deg, ${base}, color-mix(in oklab, ${base} 45%, black))`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
