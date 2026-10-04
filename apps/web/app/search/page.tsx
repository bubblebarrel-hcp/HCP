import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Camera, Footprints, MapPin, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { KennelCard } from '@/components/KennelCard';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { publicGet } from '@/lib/server-api';
import { formatRunDate } from '@/lib/runs';
import type { SearchResults } from '@/lib/types';
import { bleedCard, brandColor, cn, formatDate } from '@/lib/utils';

// Annex 08Q's global search box, scoped to what the platform actually has:
// kennels, runs, trail reports, hashers, Run Capsules. A Server Component like
// the kennel directory, so the results a link is shared to still render
// without JavaScript — search results respect the same visibility rules the
// domain's own listing page does, but only the anonymous view of them; a
// signed-in reader's own private matches are not in this render (same gap the
// community feed has, see CODEX/TODO.md).

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search kennels, runs, trail reports, hashers and Run Capsules across Shiggy Trails.',
};

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Users;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <Card className={cn(bleedCard, 'p-4')}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Hit({ href, title, subtitle, avatarName, avatarColor }: { href: string; title: string; subtitle?: string; avatarName: string; avatarColor?: string | null }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50" data-testid="search-hit">
      <Avatar name={avatarName} size="sm" color={brandColor(avatarColor)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </Link>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const data = query ? await publicGet<SearchResults>(`/search?q=${encodeURIComponent(query)}&limit=8`) : null;

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        {/* Plain GET form: search works without JavaScript */}
        <form action="/search" className="mt-3 flex gap-2" role="search">
          <label htmlFor="global-search-q" className="sr-only">Search Shiggy Trails</label>
          <Input id="global-search-q" name="q" defaultValue={q} placeholder="Kennels, runs, reports, hashers…" className="max-w-md" data-testid="search-input" />
          <Button type="submit">Search</Button>
        </form>
        {data && (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="search-total">
            {data.total} {data.total === 1 ? 'result' : 'results'} for &ldquo;{data.query}&rdquo;
          </p>
        )}
      </Card>

      {!query ? (
        <p className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x">
          Search across kennels, runs, trail reports, hashers and Run Capsules.
        </p>
      ) : !data || data.total === 0 ? (
        <p className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x" data-testid="search-empty">
          Nothing matches &ldquo;{query}&rdquo; yet.
        </p>
      ) : (
        <div className="space-y-4">
          {data.kennels.length > 0 && (
            <Card className={cn(bleedCard, 'p-4')}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
                Kennels
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.kennels.map((k) => (
                  <KennelCard key={k.id} kennel={k} />
                ))}
              </div>
            </Card>
          )}

          <Section title="Runs" icon={Footprints} count={data.runs.length}>
            {data.runs.map((r) => (
              <Hit
                key={r.id}
                href={`/runs/${r.id}`}
                title={`#${r.runNumber} · ${r.title}`}
                subtitle={`${r.kennel.shortName} · ${formatRunDate(r.startsAt, r.timeZone)}`}
                avatarName={r.kennel.shortName}
                avatarColor={r.kennel.primaryColor}
              />
            ))}
          </Section>

          <Section title="Trail reports" icon={BookOpen} count={data.reports.length}>
            {data.reports.map((r) => (
              <Hit
                key={r.id}
                href={`/reports/${r.id}`}
                title={r.title}
                subtitle={`${r.run.kennel.shortName} · Run #${r.run.runNumber} · ${formatDate(r.publishedAt)}`}
                avatarName={r.run.kennel.shortName}
                avatarColor={r.run.kennel.primaryColor}
              />
            ))}
          </Section>

          <Section title="Hashers" icon={Users} count={data.hashers.length}>
            {data.hashers.map((h) => (
              <Hit
                key={h.id}
                href={`/hashers/${h.id}`}
                title={h.name}
                subtitle={h.homeKennel?.shortName}
                avatarName={h.name}
              />
            ))}
          </Section>

          <Section title="Run Capsules" icon={Camera} count={data.capsules.length}>
            {data.capsules.map((c) => (
              <Hit
                key={c.id}
                href={`/capsules/${c.id}`}
                title={`#${c.run.runNumber} · ${c.run.title}`}
                subtitle={c.summary ?? `${c.run.kennel.shortName} · ${formatDate(c.run.startsAt)}`}
                avatarName={c.run.kennel.shortName}
                avatarColor={c.run.kennel.primaryColor}
              />
            ))}
          </Section>
        </div>
      )}
    </FeedLayout>
  );
}
