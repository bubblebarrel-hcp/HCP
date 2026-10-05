import { GRANTABLE_ROLES, type GrantableRole, type MembershipStatus, type MembershipType, type ScopedRole } from '@/lib/types';

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

export const allTypes = (Object.keys(typeLabel) as MembershipType[]).map((value) => ({ value, label: typeLabel[value] }));

export const timelineLabel: Record<string, string> = {
  REQUESTED: 'Asked to join',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  SUSPENSION: 'Suspended',
  REINSTATEMENT: 'Reinstated',
  RESIGNATION: 'Left the kennel',
  REMOVAL: 'Removed',
  WITHDRAWAL: 'Withdrawn',
  OFFICER_APPOINTMENT: 'Officer appointment',
  PROMOTION: 'Promotion',
  TYPE_CHANGED: 'Membership type changed',
  HOME_KENNEL_TRANSFER: 'Home kennel changed',
  ARCHIVED: 'Archived',
};

// What a scoped role is called in the UI. The kennel vocabulary, not the enum.
export const roleLabel: Record<ScopedRole, string> = {
  KENNEL_ADMIN: 'Kennel admin',
  SCRIBE: 'Hash Scribe',
  ASSISTANT_SCRIBE: 'Assistant Scribe',
  REVIEWER: 'Reviewer',
  PHOTOGRAPHER: 'Photographer',
  VOLUNTEER: 'Volunteer',
  MODERATOR: 'Moderator',
  EVENT_ORGANIZER: 'Event organiser',
  HARE: 'Hare',
  CO_HARE: 'Co-hare',
};

// Why a kennel would hand each one out, shown beside the choice.
export const roleHint: Record<GrantableRole, string> = {
  KENNEL_ADMIN: 'Runs the kennel: settings, offices and everything below.',
  SCRIBE: 'Writes the kennel’s trail reports.',
  ASSISTANT_SCRIBE: 'Helps the scribe write and gather the story.',
  REVIEWER: 'Reviews what the scribes write before it is published.',
  PHOTOGRAPHER: 'Shoots the runs and adds the photos.',
  VOLUNTEER: 'Lends a hand without holding an office.',
  MODERATOR: 'Keeps the kennel’s channels and media civil.',
  EVENT_ORGANIZER: 'Organises the kennel’s events and away weekends.',
};

export const grantableRoles = GRANTABLE_ROLES.map((value) => ({ value, label: roleLabel[value], hint: roleHint[value] }));
