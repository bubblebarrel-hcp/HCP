'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isActive, primaryNav, type NavItem } from '@/components/layout/nav';
import { cn } from '@/lib/utils';

// Phone-width tab bar. Desktop gets the same destinations in the top bar.
export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  const items: NavItem[] = [
    ...primaryNav.slice(0, 3),
    user
      ? { label: 'Menu', icon: Menu, href: '/account', match: (p) => p.startsWith('/account') }
      : { label: 'Log in', icon: UserRound, href: '/auth/login', match: (p) => p.startsWith('/auth') },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          const content = (
            <>
              <Icon className="h-6 w-6" aria-hidden />
              <span className="text-xs font-medium">{item.label}</span>
            </>
          );
          const base = 'flex h-14 flex-col items-center justify-center gap-0.5';
          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(base, active ? 'text-primary-strong' : 'text-muted-foreground active:bg-muted')}
                >
                  {content}
                </Link>
              ) : (
                <span aria-disabled title="Coming soon" className={cn(base, 'text-muted-foreground/50')}>
                  {content}
                  <span className="sr-only">(coming soon)</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
