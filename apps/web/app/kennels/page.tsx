import type { Metadata } from 'next';
import Link from 'next/link';
import { KennelCard } from '@/components/KennelCard';
import { KennelMap, type KennelPin } from '@/components/map/KennelMap';
import { StartKennelButton } from '@/components/kennels/StartKennelButton';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { publicGet } from '@/lib/server-api';
import type { Page, PublicKennel } from '@/lib/types';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Find a kennel',
  description: 'Discover Hash House Harriers kennels near you or wherever you are travelling.',
};

const PAGE_SIZE = 12;

export default async function KennelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const query = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE), ...(q ? { q } : {}) });
  const data = await publicGet<Page<PublicKennel>>(`/kennels?${query}`);
  const kennels = data?.items ?? [];

  // The map shows every kennel, not the page of twelve below it, so it reads
  // from its own endpoint rather than the paged list (which caps at 100).
  const mapData = await publicGet<{ items: KennelPin[] }>('/kennels/map');
  const pins: KennelPin[] = mapData?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const pageHref = (n: number) => `/kennels?${new URLSearchParams({ page: String(n), ...(q ? { q } : {}) })}`;

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className="mb-4 flex flex-col gap-4 rounded-none border-x-0 p-5 sm:flex-row sm:items-end sm:justify-between sm:rounded-xl sm:border-x">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Find a kennel</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.total ?? 0} {data?.total === 1 ? 'kennel' : 'kennels'} welcoming hashers and visitors.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          {/* Plain GET form: search works without JavaScript */}
          <form action="/kennels" className="flex w-full gap-2 sm:w-auto" role="search">
            <label htmlFor="kennel-search" className="sr-only">Search kennels</label>
            <Input id="kennel-search" name="q" defaultValue={q} placeholder="Name or city" className="sm:w-64" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
          <StartKennelButton />
        </div>
      </Card>

      {pins.length > 0 && (
        <Card className="mb-4 overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x" data-testid="kennel-map-card">
          <KennelMap kennels={pins} />
          <p className="px-5 py-3 text-sm text-muted-foreground">
            {pins.length} {pins.length === 1 ? 'kennel' : 'kennels'} on the map. Select a pin to open one.
          </p>
        </Card>
      )}

      {kennels.length === 0 ? (
        <p className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x">
          No kennels match{q ? ` “${q}”` : ''} yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="kennel-list">
          {kennels.map((k) => (
            <KennelCard key={k.id} kennel={k} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {pageNum > 1 && <Link className="rounded-md border border-border bg-card px-3 py-2 hover:bg-muted" href={pageHref(pageNum - 1)}>Previous</Link>}
          <span className="px-2 text-muted-foreground">Page {pageNum} of {totalPages}</span>
          {pageNum < totalPages && <Link className="rounded-md border border-border bg-card px-3 py-2 hover:bg-muted" href={pageHref(pageNum + 1)}>Next</Link>}
        </nav>
      )}
    </FeedLayout>
  );
}
