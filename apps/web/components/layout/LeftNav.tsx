'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { isActive, shortcutNav } from '@/components/layout/nav';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { brandColor, cn } from '@/lib/utils';

const row = 'flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-[15px] font-medium';

export function LeftNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { memberships } = useMyMemberships();
  const yourKennels = memberships?.filter((m) => m.status === 'ACTIVE') ?? [];

  return (
    <nav aria-label="Shortcuts" data-testid="left-nav">
      <ul className="space-y-0.5">
        <li>
          {user ? (
            <Link href="/account" className={cn(row, 'hover:bg-foreground/5')}>
              <Avatar name={user.displayName} size="sm" />
              <span className="truncate font-semibold">{user.displayName}</span>
            </Link>
          ) : (
            <Link href="/auth/login" className={cn(row, 'hover:bg-foreground/5')}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-card">
                <UserRound className="h-5 w-5" aria-hidden />
              </span>
              Log in
            </Link>
          )}
        </li>
        {shortcutNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          const icon = (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-card">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          );
          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(row, active ? 'bg-primary/10 text-primary-strong' : 'hover:bg-foreground/5')}
                >
                  {icon}
                  {item.label}
                </Link>
              ) : (
                <span aria-disabled className={cn(row, 'text-muted-foreground')}>
                  {icon}
                  {item.label}
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs">Soon</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {yourKennels.length > 0 && (
        <>
          <hr className="my-4 border-border" />
          <h2 className="px-2 text-[15px] font-semibold text-muted-foreground">Your kennels</h2>
          <ul className="mt-1 space-y-0.5" data-testid="left-nav-kennels">
            {yourKennels.map((m) => {
              const href = `/kennels/${m.kennel.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={m.id}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(row, active ? 'bg-primary/10 text-primary-strong' : 'hover:bg-foreground/5')}
                  >
                    <Avatar name={m.kennel.shortName} size="sm" color={brandColor(m.kennel.primaryColor)} />
                    <span className="truncate">{m.kennel.shortName}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <hr className="my-4 border-border" />
      <p className="px-2 text-xs leading-relaxed text-muted-foreground">
        <Link href="/kennels" className="hover:underline">Kennels</Link>
        {/* Nothing to join once you have an account. */}
        {!user && (
          <>
            {' · '}
            <Link href="/auth/register" className="hover:underline">Join</Link>
          </>
        )}
        <br />
        Hash Community Platform, a digital home for Hash House Harriers.
      </p>
    </nav>
  );
}
