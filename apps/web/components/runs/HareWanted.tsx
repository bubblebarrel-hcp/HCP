'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Footprints } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRunWhen } from '@/lib/runs';
import type { Page, RunNeedingHare } from '@/lib/types';
import { bleedCard } from '@/lib/utils';
import api from '@/services/api';

// The dates a kennel has set and nobody is haring yet (D44) — the list every
// flyer ends by asking people to pick from. Readable signed out on purpose: a
// hasher weighing up a kennel should be able to see that it needs hares.
export function HareWanted({ kennelSlug, title = 'Dates needing a hare' }: { kennelSlug?: string; title?: string }) {
  const [runs, setRuns] = useState<RunNeedingHare[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ limit: '8', ...(kennelSlug ? { kennelSlug } : {}) });
    api
      .get<{ data: Page<RunNeedingHare> }>(`/runs/needing-hares?${query}`)
      .then((res) => {
        if (!cancelled) setRuns(res.data.data.items);
      })
      .catch(() => {
        if (!cancelled) setRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kennelSlug]);

  if (!runs || runs.length === 0) return null;

  return (
    <Card className={bleedCard} data-testid="hare-wanted">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Footprints className="h-5 w-5" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>Pick one that suits you. The mismanagement answers.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {runs.map((run) => (
            <li key={run.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link href={`/runs/${run.id}`} className="group flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium group-hover:underline">
                  {run.runNumber ? `Run #${run.runNumber}` : 'A run'}
                </span>
                <span className="text-sm text-muted-foreground">
                  <time dateTime={run.startsAt}>{formatRunWhen(run.startsAt, run.timeZone)}</time>
                  {!kennelSlug && run.kennel ? ` · ${run.kennel.shortName}` : ''}
                </span>
                {run.offerCount > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {run.offerCount} {run.offerCount === 1 ? 'offer' : 'offers'} in
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
