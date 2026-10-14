import {
  Activity,
  Building2,
  CalendarDays,
  Flag,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

// One place the sidebar reads from. Hiding an entry is UX only: every /admin/*
// route is gated by requireRole('ADMIN') on the API.
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'reports';
}
export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: null, items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Community',
    items: [
      { href: '/kennels', label: 'Kennels', icon: Building2 },
      { href: '/users', label: 'Hashers', icon: Users },
      { href: '/memberships', label: 'Memberships', icon: UserCheck },
      { href: '/runs', label: 'Runs', icon: CalendarDays },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { href: '/reports', label: 'Reports', icon: Flag, badge: 'reports' },
      { href: '/enforcement', label: 'Automatic actions', icon: ShieldAlert },
      { href: '/content', label: 'Content', icon: ImageIcon },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
      { href: '/audit', label: 'Audit & events', icon: Activity },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];
