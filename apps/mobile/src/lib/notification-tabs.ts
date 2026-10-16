// The tabs on the notifications screen. The same groups as the web bell's dropdown
// (web/lib/notifications.ts): change both together. Inbox is whatever still needs
// you (unread, any category); the others are groups of categories; All is everything.

export type NotificationTab = 'inbox' | 'runs' | 'social' | 'kennel' | 'all';

export const notificationTabs: { id: NotificationTab; label: string; categories?: string[] }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'runs', label: 'Runs', categories: ['RUN', 'TRAIL_RELEASE', 'REMINDER', 'EVENT', 'SAFETY', 'REPORT', 'MEDIA'] },
  { id: 'social', label: 'Social', categories: ['SOCIAL', 'MESSAGE'] },
  { id: 'kennel', label: 'Kennel', categories: ['MEMBERSHIP', 'GOVERNANCE', 'ANNOUNCEMENT'] },
  { id: 'all', label: 'All' },
];

// The query string for a tab's list.
export function notificationQuery(tab: NotificationTab) {
  const def = notificationTabs.find((t) => t.id === tab);
  const parts: string[] = [];
  if (tab === 'inbox') parts.push('unread=true');
  if (def?.categories) parts.push(`categories=${def.categories.join(',')}`);
  return parts.join('&');
}

// The server filters by tab too; this keeps a tab right against an API that does not
// yet know `categories` (an older deploy) and would answer with everything.
export function matchesTab(item: { category: string; readAt: string | null }, tab: NotificationTab) {
  if (tab === 'inbox') return !item.readAt;
  const cats = notificationTabs.find((t) => t.id === tab)?.categories;
  return !cats || cats.includes(item.category);
}
