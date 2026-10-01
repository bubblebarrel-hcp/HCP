import type { NotificationCategory, NotificationItem, NotificationPriority } from '@/lib/types';

export const notificationCategoryLabel: Record<NotificationCategory, string> = {
  MEMBERSHIP: 'Membership',
  RUN: 'Runs',
  TRAIL_RELEASE: 'Trail release',
  REMINDER: 'Reminders',
  REPORT: 'Trail reports',
  ANNOUNCEMENT: 'Announcements',
  GOVERNANCE: 'Governance',
  EVENT: 'Events',
  MEDIA: 'Photos',
  SAFETY: 'Safety',
  SOCIAL: 'Likes, replies and follows',
  SYSTEM: 'System',
};

export const notificationCategoryHint: Record<NotificationCategory, string> = {
  MEMBERSHIP: 'Requests to join, and decisions on yours.',
  RUN: 'New runs, changes and cancellations.',
  TRAIL_RELEASE: 'When a hare releases the trail.',
  REMINDER: 'Nudges before a run or a deadline.',
  REPORT: 'Trail reports published by the scribe.',
  ANNOUNCEMENT: 'Kennel announcements.',
  GOVERNANCE: 'Motions, votes and officer changes.',
  EVENT: 'Interhash and multi-kennel events.',
  MEDIA: 'Photos added to your runs.',
  SAFETY: 'A run paused, a hazard, an emergency.',
  SOCIAL: 'Someone liked or replied to your post, reshared it, or followed you.',
  SYSTEM: 'Account and platform notices.',
};

export function notificationTone(priority: NotificationPriority) {
  if (priority === 'CRITICAL') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (priority === 'HIGH') return 'border-accent/30 bg-accent/10 text-accent-strong';
  return '';
}

// Where tapping a notification should take you.
export function notificationHref(item: NotificationItem) {
  if (!item.contextId) return null;
  switch (item.contextType) {
    case 'Run':
      return `/runs/${item.contextId}`;
    case 'Trail':
      return `/trails/${item.contextId}`;
    // A membership has no page of its own; "Your kennels" is the closest thing.
    case 'Membership':
      return '/account';
    default:
      return null;
  }
}
