'use client';

import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { HareWanted } from '@/components/runs/HareWanted';
import { RunList } from '@/components/runs/RunList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { KennelRunsPage, Page, RunSummary } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';

export default function KennelRunsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [meta, setMeta] = useState<KennelRunsPage | null>(null);
  const onMeta = useCallback((data: Page<RunSummary>) => setMeta(data as KennelRunsPage), []);

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 flex flex-wrap items-end justify-between gap-4 p-5')}>
        <div>
          <Link
            href={`/kennels/${slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {meta?.kennel.name ?? 'Back to kennel'}
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Runs</h1>
        </div>
        {meta?.canPlan && (
          <Button asChild data-testid="plan-run">
            <Link href={`/kennels/${slug}/runs/new`}>
              <Plus className="h-4 w-4" aria-hidden />
              Plan a run
            </Link>
          </Button>
        )}
      </Card>
      <div className="mb-4">
        <HareWanted kennelSlug={slug} />
      </div>
      <RunList
        path={`/kennels/${encodeURIComponent(slug)}/runs`}
        allowDrafts={meta?.canPlan ?? false}
        showKennel={false}
        onMeta={onMeta}
      />
    </FeedLayout>
  );
}
