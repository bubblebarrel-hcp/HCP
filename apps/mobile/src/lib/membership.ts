import type { MembershipStatus } from '@/lib/types';

// Membership wording and tones from the web app (apps/web/lib/membership.ts).

export const statusLabel: Record<MembershipStatus, string> = {
  APPLICANT: 'Applicant',
  PENDING_REVIEW: 'Pending review',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  RESIGNED: 'Left',
  REMOVED: 'Removed',
  REJECTED: 'Not approved',
  WITHDRAWN: 'Withdrawn',
  ARCHIVED: 'Archived',
};

export const typeLabel: Record<string, string> = {
  FULL: 'Full member',
  ASSOCIATE: 'Associate member',
  VISITING: 'Visiting hasher',
  HONORARY: 'Honorary member',
  LIFE: 'Life member',
  GUEST: 'Guest',
  VIRGIN: 'Virgin',
  COMMITTEE: 'Committee member',
};

export function isPending(status: MembershipStatus) {
  return status === 'PENDING_REVIEW' || status === 'APPLICANT';
}

// Badge tone for a status; the label text always carries the meaning too.
export function statusTone(status: MembershipStatus) {
  if (status === 'ACTIVE') return 'soft-primary' as const;
  if (isPending(status)) return 'soft-accent' as const;
  if (status === 'SUSPENDED' || status === 'REMOVED') return 'danger' as const;
  return 'muted' as const;
}
