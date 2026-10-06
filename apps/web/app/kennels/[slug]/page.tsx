import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { KennelBranding } from '@/components/kennels/KennelBranding';
import { FollowButton } from '@/components/social/FollowButton';
import { JoinKennelButton } from '@/components/membership/JoinKennelButton';
import { RunCard } from '@/components/runs/RunCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { publicGet } from '@/lib/server-api';
import type { KennelDetail, Page, RunSummary } from '@/lib/types';
import { bleedCard, cn, verificationLabel } from '@/lib/utils';

export const revalidate = 60;

async function getKennel(slug: string) {
  const data = await publicGet<{ kennel: KennelDetail }>(`/kennels/${encodeURIComponent(slug)}`);
  return data?.kennel ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const kennel = await getKennel((await params).slug);
  if (!kennel) return { title: 'Kennel not found' };
  return {
    title: kennel.name,
    description: `${kennel.name} — ${kennel.city}, ${kennel.country}. ${kennel.description.slice(0, 140)}`,
  };
}

// The first tab is this page; the rest are links to their own pages.
const tabs: { label: string; active?: boolean; href?: string }[] = [
  { label: 'About', active: true },
  { label: 'Runs', href: 'runs' },
  { label: 'Trail reports', href: 'reports' },
  { label: 'Photos', href: 'photos' },
  { label: 'People', href: 'people' },
];

export default async function KennelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kennel = await getKennel(slug);
  if (!kennel) notFound();

  // Public (anonymous) view: members-only runs appear on the runs page for members.
  const runs = await publicGet<Page<RunSummary>>(
    `/kennels/${encodeURIComponent(kennel.slug)}/runs?scope=upcoming&limit=3`,
  ).catch(() => null);

  const verified = kennel.verificationLevel !== 'PENDING';

  return (
    <>
      {/* Page header, Facebook Page style: cover, avatar, name, action, tabs */}
      <div className="border-b border-border bg-card shadow-sm">
        <KennelBranding
          kennelId={kennel.id}
          slug={kennel.slug}
          shortName={kennel.shortName}
          primaryColor={kennel.primaryColor}
          logoUrl={kennel.logoUrl}
          bannerUrl={kennel.bannerUrl}
          bannerPosition={kennel.bannerPosition}
        >
          <>
            <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight" data-testid="kennel-name">
                {kennel.name}
              </h1>
              <p className="mt-1 text-muted-foreground">
                <Link href={`/kennels/${kennel.slug}/people`} className="hover:underline" data-testid="kennel-people-link">
                  {kennel.activeMemberCount} {kennel.activeMemberCount === 1 ? 'member' : 'members'}
                  {kennel.followerCount > 0 && (
                    <> · {kennel.followerCount} {kennel.followerCount === 1 ? 'follower' : 'followers'}</>
                  )}
                </Link>{' '}
                · {kennel.city}, {kennel.country}
              </p>
              {verified && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary-strong">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  {verificationLabel(kennel.verificationLevel)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              {/* Following is not joining (D50): no membership, no vote, no
                  authority — just this kennel's runs in your feed. */}
              <FollowButton kind="kennel" target={kennel.slug} initialFollowers={kennel.followerCount} showCount={false} />
              <JoinKennelButton slug={kennel.slug} shortName={kennel.shortName} />
            </div>
          </>
        </KennelBranding>

        <nav aria-label="Kennel sections" className="flex overflow-x-auto border-t border-border px-2 lg:px-6">
            {tabs.map((t) =>
              t.active ? (
                <span
                  key={t.label}
                  aria-current="page"
                  className="relative whitespace-nowrap px-4 py-3.5 text-[15px] font-semibold text-primary-strong after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary"
                >
                  {t.label}
                </span>
              ) : t.href ? (
                <Link
                  key={t.label}
                  href={`/kennels/${kennel.slug}/${t.href}`}
                  className="whitespace-nowrap px-4 py-3.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground"
                  data-testid={`kennel-tab-${t.href}`}
                >
                  {t.label}
                </Link>
              ) : (
                <span
                  key={t.label}
                  aria-disabled
                  title="Coming soon"
                  className="whitespace-nowrap px-4 py-3.5 text-[15px] font-semibold text-muted-foreground/60"
                >
                  {t.label}
                  <span className="sr-only"> (coming soon)</span>
                </span>
              ),
            )}
        </nav>
      </div>

      <div className="grid gap-4 py-4 sm:px-4 md:grid-cols-[2fr_3fr] lg:px-8 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <Card className={bleedCard}>
            <CardHeader className="pb-3">
              <CardTitle>Intro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[15px]">
              {kennel.motto && <p className="text-center italic">“{kennel.motto}”</p>}
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  {kennel.city}, {kennel.stateProvince}, {kennel.country}
                </li>
                <li className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  Runs on {kennel.meetingDay ?? 'varying days'}
                </li>
                <li className="flex items-center gap-3">
                  <Users className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  {kennel.activeMemberCount} active {kennel.activeMemberCount === 1 ? 'member' : 'members'}
                </li>
                <li className="flex items-center gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  {kennel.timeZone}
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className={bleedCard}>
            <CardHeader className="pb-3">
              <CardTitle>Mismanagement</CardTitle>
            </CardHeader>
            <CardContent>
              {kennel.officers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No officers listed yet.</p>
              ) : (
                <ul className="space-y-3 text-sm" data-testid="officer-list">
                  {kennel.officers.map((o) => (
                    <li key={o.title} className="flex items-center gap-3">
                      <Avatar name={o.name} size="sm" src={o.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{o.name}</span>
                        <span className="block text-muted-foreground">{o.title}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={bleedCard}>
            <CardHeader className="pb-3">
              <CardTitle>About the kennel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line leading-relaxed">{kennel.description}</p>
              {kennel.landingMessage && <p className="rounded-lg bg-muted p-4 text-sm">{kennel.landingMessage}</p>}
            </CardContent>
          </Card>

          <Card className={bleedCard} data-testid="kennel-upcoming-runs">
            <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
              <CardTitle>Upcoming runs</CardTitle>
              <Link href={`/kennels/${kennel.slug}/runs`} className="text-sm font-medium text-primary-strong hover:underline">
                All runs
              </Link>
            </CardHeader>
            <CardContent>
              {runs && runs.items.length > 0 ? (
                <ul className="space-y-3">
                  {runs.items.map((run) => (
                    <li key={run.id}>
                      <RunCard run={run} variant="row" showKennel={false} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cn('text-sm text-muted-foreground')}>
                  No public runs scheduled. Members may see more on the runs page.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
