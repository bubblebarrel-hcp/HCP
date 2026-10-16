import type { NotificationCategory, NotificationItem, NotificationPriority } from '@/lib/types';

// Fired when the notifications page changes read state, so the bell's badge follows without waiting for its poll.
export const NOTIFICATIONS_CHANGED = 'hcp:notifications-changed';

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
  MESSAGE: 'Messages',
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
  MESSAGE: 'Someone sent you a direct message, or asked to. It says who, never what.',
  SYSTEM: 'Account and platform notices.',
};

// The tabs of the bell's dropdown. Inbox is whatever still needs you (unread, any
// category); the others are groups of categories; All is everything, read or not.
export type NotificationTab = 'inbox' | 'runs' | 'social' | 'kennel' | 'all';

export const notificationTabs: { id: NotificationTab; label: string; categories?: NotificationCategory[] }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'runs', label: 'Runs', categories: ['RUN', 'TRAIL_RELEASE', 'REMINDER', 'EVENT', 'SAFETY', 'REPORT', 'MEDIA'] },
  { id: 'social', label: 'Social', categories: ['SOCIAL', 'MESSAGE'] },
  { id: 'kennel', label: 'Kennel', categories: ['MEMBERSHIP', 'GOVERNANCE', 'ANNOUNCEMENT'] },
  { id: 'all', label: 'All' },
];

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
    case 'RUN':
      return `/runs/${item.contextId}`;
    case 'Trail':
      return `/trails/${item.contextId}`;
    // A like or a comment names the thing it was on (D50). The upper-case names
    // are older rows, written before the API named the page.
    case 'Post':
    case 'POST':
      return `/posts/${item.contextId}`;
    case 'Reel':
    case 'REEL':
      return `/reels/${item.contextId}`;
    case 'TrailReport':
    case 'TRAIL_REPORT':
      return `/reports/${item.contextId}`;
    case 'RunCapsule':
    case 'RUN_CAPSULE':
      return `/capsules/${item.contextId}`;
    // Somebody asked to follow a locked profile (D57): the thing to do is answer.
    // Somebody tagged you in a photo and wants your yes (D60).
    // The outcome of something you reported (D61).
    case 'Report':
      return '/account/reports';
    case 'PhotoTag':
      return '/account/photo-tags';
    // A direct message, or a request for one (D71).
    case 'DirectConversation':
      return `/messages/${item.contextId}`;
    case 'FollowRequest':
      return '/account/follow-requests';
    // A social notice about a person (an approved request, a follow) opens them.
    case 'User':
      return `/hashers/${item.contextId}`;
    // A membership has no page of its own; "Your kennels" is the closest thing.
    case 'Membership':
      return '/account';
    default:
      return null;
  }
}

// The server filters by tab too; this keeps a tab right against an API that does not
// yet know `categories` (an older deploy) and would answer with everything.
export function matchesTab(item: NotificationItem, tab: NotificationTab) {
  if (tab === 'inbox') return !item.readAt;
  const cats = notificationTabs.find((t) => t.id === tab)?.categories;
  return !cats || cats.includes(item.category);
}
