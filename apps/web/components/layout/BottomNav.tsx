'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PhotoPostDialog } from '@/components/feed/PhotoPostDialog';
import { isActive, primaryNav, type NavItem } from '@/components/layout/nav';
import { cn } from '@/lib/utils';

// Phone-width tab bar. Desktop gets the same destinations in the top bar.
// The + in the middle posts photos from anywhere (signed in), or goes to log in.
export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [posting, setPosting] = useState(false);

  const items: NavItem[] = [
    ...primaryNav.slice(0, 3),
    user
      ? { label: 'Me', icon: Menu, href: '/account', match: (p) => p.startsWith('/account') }
      : { label: 'Log in', icon: UserRound, href: '/auth/login', match: (p) => p.startsWith('/auth') },
  ];

  const plus = (
    <li key="post" className="grid place-items-center">
      {user ? (
        <button
          type="button"
          aria-label="Post photos"
          onClick={() => setPosting(true)}
          data-testid="nav-post"
          className="grid h-9 w-12 place-items-center rounded-xl bg-primary text-primary-foreground active:opacity-80"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
      ) : (
        <Link
          href="/auth/login"
          aria-label="Post photos"
          data-testid="nav-post"
          className="grid h-9 w-12 place-items-center rounded-xl bg-primary text-primary-foreground active:opacity-80"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </Link>
      )}
    </li>
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.flatMap((item, index) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          const content = (
            <>
              <Icon className="h-6 w-6" aria-hidden />
              <span className="text-xs font-medium">{item.label}</span>
            </>
          );
          const base = 'flex h-14 flex-col items-center justify-center gap-0.5';
          const entry = (
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
          // The + sits between Kennels and Runs, matching the app.
          return index === 2 ? [plus, entry] : [entry];
        })}
      </ul>
      <PhotoPostDialog open={posting} onOpenChange={setPosting} />
    </nav>
  );
}
