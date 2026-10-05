import type { MembershipStatus, PublicKennel } from '@/lib/types';

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  APPLICANT: 'Applicant',
  PENDING_REVIEW: 'Request pending',
  ACTIVE: 'Member',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  RESIGNED: 'Left',
  REMOVED: 'Removed',
  REJECTED: 'Not approved',
  WITHDRAWN: 'Withdrawn',
  ARCHIVED: 'Archived',
};

export const verificationLabels: Record<PublicKennel['verificationLevel'], string | null> = {
  PENDING: null,
  COMMUNITY_VERIFIED: 'Community verified',
  OFFICER_VERIFIED: 'Officer verified',
  PLATFORM_VERIFIED: 'Platform verified',
};

// Kennel.primaryColor is admin-entered; only a plain hex value is used as a colour.
export function brandColor(color?: string | null) {
  return color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : null;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initials(name: string) {
  const words = name.replace(/^Just\s+/i, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

// "Sat, 4 Oct 2026, 14:30" in the run's own time zone (web lib/runs.ts formatRunDate).
export function formatRunDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export const reportStatusLabel = {
  DRAFT: 'Draft',
  SCRIBE_EDITING: 'Being written',
  REVIEW: 'In review',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
} as const;
