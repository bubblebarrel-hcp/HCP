import { Bookmark, BookOpen, Footprints, Home, IdCard, MessageCircle, Settings, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  // No href means the feature has not landed yet: rendered disabled with a "Soon" tag.
  href?: string;
  // Matches nested routes too (e.g. /kennels/accra-h3 keeps Kennels active).
  match?: (pathname: string) => boolean;
}

// One source for the top bar, bottom bar and left shortcuts so they never drift.
export const primaryNav: NavItem[] = [
  { label: 'Home', icon: Home, href: '/', match: (p) => p === '/' },
  { label: 'Kennels', icon: Users, href: '/kennels', match: (p) => p.startsWith('/kennels') },
  { label: 'Runs', icon: Footprints, href: '/runs', match: (p) => p.startsWith('/runs') },
  { label: 'Trail reports', icon: BookOpen, href: '/reports', match: (p) => p.startsWith('/reports') },
];

export const shortcutNav: NavItem[] = [
  ...primaryNav,
  { label: 'Hash Passport', icon: IdCard, href: '/passport', match: (p) => p.startsWith('/passport') },
  // One-to-one messages (D71). Private to the two people in them.
  { label: 'Messages', icon: MessageCircle, href: '/messages', match: (p) => p.startsWith('/messages') },
  // What this hasher saved (D50). Private to them.
  { label: 'Saved', icon: Bookmark, href: '/saved', match: (p) => p.startsWith('/saved') },
  { label: 'Settings', icon: Settings, href: '/settings', match: (p) => p.startsWith('/settings') },
];

export function isActive(item: NavItem, pathname: string) {
  return item.match ? item.match(pathname) : item.href === pathname;
}
