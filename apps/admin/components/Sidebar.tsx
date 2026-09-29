'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BrandMark } from '@/components/brand/HashLogo';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kennels', label: 'Kennels', icon: Building2 },
  { href: '/users', label: 'Hashers', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-full flex-col border-b border-border bg-card md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-start justify-between gap-3 px-5 py-5">
        <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="HCP Admin home">
          <BrandMark className="h-10 w-10" />
          <span className="min-w-0">
            <span className="block font-bold tracking-tight">HCP Admin</span>
            <span className="block text-xs text-muted-foreground">Hash Community Platform</span>
          </span>
        </Link>
        <ThemeToggleButton />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 md:flex-col" aria-label="Admin">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                active ? 'bg-primary/10 font-semibold text-primary-strong' : 'hover:bg-muted',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-border p-4 md:block">
        <p className="truncate text-sm font-medium">{user?.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        <button
          type="button"
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden /> Log out
        </button>
      </div>
    </aside>
  );
}
