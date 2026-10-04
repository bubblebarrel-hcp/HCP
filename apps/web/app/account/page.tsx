'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ProfileBranding } from '@/components/profile/ProfileBranding';
import { MyMemberships } from '@/components/membership/MyMemberships';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { bleedCard, cn } from '@/lib/utils';

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  // Gate on loading so the page never flashes its logged-out state.
  if (loading || !user) {
    return (
      <div className="py-4 sm:px-4" aria-busy>
        <div className="h-72 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border bg-card shadow-sm">
        <ProfileBranding
          hasherId={user.id}
          name={user.displayName}
          avatarUrl={user.avatarUrl}
          avatarPosition={user.avatarPosition}
          bannerUrl={user.bannerUrl}
          bannerPosition={user.bannerPosition}
        >
          <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight" data-testid="account-display-name">
              {user.displayName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {user.hashHandle ? 'Hasher' : 'Not named yet'} · on Shiggy Trails since{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:mb-2 sm:w-auto">
            <Button asChild className="flex-1 sm:flex-none"><Link href="/kennels">Find a kennel</Link></Button>
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={async () => {
                await logout();
                router.push('/');
              }}
            >
              Log out
            </Button>
          </div>
        </ProfileBranding>
      </div>

      <div className="grid gap-4 py-4 sm:px-4 md:grid-cols-[2fr_3fr] lg:px-8 xl:grid-cols-[1fr_2fr]">
        <Card className={bleedCard}>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle>Details</CardTitle>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/account/privacy" data-testid="to-privacy">
                  Privacy
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/account/profile">Edit profile</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all" data-testid="account-email">{user.email}</dd>
              <dt className="text-muted-foreground">Hash handle</dt>
              <dd>{user.hashHandle ?? <span className="text-muted-foreground">Not named yet</span>}</dd>
              <dt className="text-muted-foreground">Email verified</dt>
              <dd>{user.emailVerified ? 'Yes' : <Badge>Pending</Badge>}</dd>
              <dt className="text-muted-foreground">Member since</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </dl>
            {/* Who follows you and who you follow live on your profile page,
                which opens on the right list (D57). */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/hashers/${user.id}?tab=followers`} data-testid="account-followers">
                  Followers
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/hashers/${user.id}?tab=following`} data-testid="account-following">
                  Following
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/hashers/${user.id}`} data-testid="account-view-profile">
                  View my profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <MyMemberships />
          <Card className={cn(bleedCard, "p-8 text-center")}>
            <p className="font-semibold">Your Hash Passport</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every run you check in to, every trail you hare, everywhere you hash.
            </p>
            <Button asChild className="mt-4">
              <Link href="/passport">Open your passport</Link>
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
