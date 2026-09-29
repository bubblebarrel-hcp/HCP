import { GRANTABLE_ROLES, type GrantableRole, type MembershipStatus, type MembershipType, type ScopedRole } from '@/lib/types';

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

export const typeLabel: Record<MembershipType, string> = {
  FULL: 'Full member',
  ASSOCIATE: 'Associate member',
  VISITING: 'Visiting hasher',
  HONORARY: 'Honorary member',
  LIFE: 'Life member',
  GUEST: 'Guest',
  VIRGIN: 'Virgin',
  COMMITTEE: 'Committee member',
};

// D20: what a hasher may choose when asking to join. Mirrors
// SELF_SELECTABLE_TYPES in apps/api/src/validators/membership.validator.ts.
export const selfSelectableTypes: { value: MembershipType; label: string; hint: string }[] = [
  { value: 'FULL', label: typeLabel.FULL, hint: 'You hash with this kennel regularly.' },
  { value: 'ASSOCIATE', label: typeLabel.ASSOCIATE, hint: 'You hash here now and then.' },
  { value: 'VISITING', label: typeLabel.VISITING, hint: 'Your home kennel is somewhere else.' },
  { value: 'VIRGIN', label: typeLabel.VIRGIN, hint: 'You have not hashed before. Welcome!' },
];

export const allTypes = (Object.keys(typeLabel) as MembershipType[]).map((value) => ({
  value,
  label: typeLabel[value],
}));

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

export function isPending(status: MembershipStatus) {
  return status === 'PENDING_REVIEW' || status === 'APPLICANT';
}

// Badge colours; the label text always carries the meaning too.
export function statusTone(status: MembershipStatus) {
  if (status === 'ACTIVE') return 'border-primary/30 bg-primary/10 text-primary-strong';
  if (isPending(status)) return 'border-accent/30 bg-accent/10 text-accent-strong';
  if (status === 'SUSPENDED' || status === 'REMOVED') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'text-muted-foreground';
}

// Components showing membership data listen for this and reload after any change.
export const MEMBERSHIPS_CHANGED = 'hcp:memberships-changed';

export function notifyMembershipsChanged() {
  window.dispatchEvent(new Event(MEMBERSHIPS_CHANGED));
}

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

export const grantableRoles = GRANTABLE_ROLES.map((value) => ({
  value,
  label: roleLabel[value],
  hint: roleHint[value],
}));
