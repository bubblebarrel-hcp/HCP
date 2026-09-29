'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { BrandMark } from '@/components/brand/HashLogo';
import { Button } from '@/components/ui/button';
import { ThemeToggle, ThemeToggleButton } from '@/components/ui/theme-toggle';
import { isActive, primaryNav, type NavItem } from '@/components/layout/nav';
import { NotificationBell } from '@/components/layout/NotificationBell';
import type { SessionUser } from '@/lib/types';
import { cn } from '@/lib/utils';

const logoCompanions = [
  '/alt-image1.png',
  '/alt-image2.png',
  '/alt-image3.png',
  '/alt-image4.png',
  '/alt-image5.png',
] as const;

function TopTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const inner = (
    <>
      <Icon className="h-6 w-6" aria-hidden />
      <span className="hidden text-sm font-medium xl:inline">{item.label}</span>
    </>
  );
  const base = 'relative my-1 flex w-20 items-center justify-center gap-2 rounded-lg lg:w-24 xl:w-auto xl:px-5';

  if (!item.href) {
    return (
      <span
        aria-disabled
        title={`${item.label}: coming soon`}
        className={cn(base, 'cursor-not-allowed text-muted-foreground/60')}
      >
        {inner}
        <span className="sr-only">{item.label} (coming soon)</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={cn(
        base,
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'text-primary-strong after:absolute after:inset-x-2 after:-bottom-1 after:h-[3px] after:rounded-full after:bg-primary'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {inner}
    </Link>
  );
}

function AccountMenu({ user }: { user: SessionUser }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
        data-testid="header-account"
        className="flex h-10 items-center gap-2 rounded-full pr-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:pl-1 lg:pr-3"
      >
        <Avatar name={user.displayName} />
        <span className="hidden max-w-40 truncate text-sm font-semibold lg:inline">{user.displayName}</span>
      </button>

      {open && (
        <div
          id="account-menu"
          role="menu"
          className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
          >
            <Avatar name={user.displayName} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{user.displayName}</span>
              <span className="block text-sm text-muted-foreground">See your profile</span>
            </span>
          </Link>
          <hr className="my-2 border-border" />
          <div className="p-2">
            <p className="pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display</p>
            <ThemeToggle />
          </div>
          <hr className="my-2 border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push('/');
            }}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm font-medium hover:bg-muted"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
              <LogOut className="h-5 w-5" aria-hidden />
            </span>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [companionImage, setCompanionImage] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const previousImage = window.sessionStorage.getItem('hcp-logo-companion');
      const previousIndex = previousImage === null ? -1 : Number(previousImage);
      let nextIndex = Math.floor(Math.random() * logoCompanions.length);

      if (previousIndex >= 0 && previousIndex < logoCompanions.length && nextIndex === previousIndex) {
        nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (logoCompanions.length - 1))) % logoCompanions.length;
      }

      window.sessionStorage.setItem('hcp-logo-companion', String(nextIndex));
      setCompanionImage(nextIndex);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card pt-[env(safe-area-inset-top)] shadow-sm">
      <div className="grid h-14 grid-cols-[1fr_auto] items-center gap-2 px-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Hash Community Platform home"
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BrandMark />
          </Link>
          <span className="grid h-10 w-10 shrink-0 place-items-center" aria-hidden="true">
            {companionImage !== null && (
              <Image
                src={logoCompanions[companionImage]}
                alt=""
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
                priority
              />
            )}
          </span>
          {/* Plain GET form: search works without JavaScript */}
          <form action="/search" role="search" className="relative hidden sm:block">
            <label htmlFor="global-search" className="sr-only">Search HCP</label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="global-search"
              name="q"
              type="search"
              placeholder="Search HCP"
              className="h-10 w-56 rounded-full bg-muted pl-9 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-64"
            />
          </form>
        </div>

        <nav aria-label="Primary" className="hidden h-14 items-stretch md:flex">
          {primaryNav.map((item) => (
            <TopTab key={item.label} item={item} active={isActive(item, pathname)} />
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/search"
            aria-label="Search HCP"
            className="grid h-10 w-10 place-items-center rounded-full bg-muted sm:hidden"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          <ThemeToggleButton />
          <NotificationBell />
          {loading ? (
            <span className="h-10 w-10 animate-pulse rounded-full bg-muted lg:w-32" aria-hidden />
          ) : user ? (
            <AccountMenu user={user} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/register">Join HCP</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
