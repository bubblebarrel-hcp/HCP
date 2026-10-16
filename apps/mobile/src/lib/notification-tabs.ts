// The tabs on the notifications screen. The same groups as the web bell's dropdown
// (web/lib/notifications.ts): change both together. All is everything, read or
// not, and carries the unread count; the others are groups of categories.

export type NotificationTab = 'all' | 'runs' | 'social' | 'kennel';

export const notificationTabs: { id: NotificationTab; label: string; categories?: string[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'runs', label: 'Runs', categories: ['RUN', 'TRAIL_RELEASE', 'REMINDER', 'EVENT', 'SAFETY', 'REPORT', 'MEDIA'] },
  { id: 'social', label: 'Social', categories: ['SOCIAL', 'MESSAGE'] },
  { id: 'kennel', label: 'Kennel', categories: ['MEMBERSHIP', 'GOVERNANCE', 'ANNOUNCEMENT'] },
];

// The query string for a tab's list.
export function notificationQuery(tab: NotificationTab) {
  const def = notificationTabs.find((t) => t.id === tab);
  const parts: string[] = [];
  if (def?.categories) parts.push(`categories=${def.categories.join(',')}`);
  return parts.join('&');
}

// The server filters by tab too; this keeps a tab right against an API that does not
// yet know `categories` (an older deploy) and would answer with everything.
export function matchesTab(item: { category: string; readAt: string | null }, tab: NotificationTab) {
  const cats = notificationTabs.find((t) => t.id === tab)?.categories;
  return !cats || cats.includes(item.category);
}
