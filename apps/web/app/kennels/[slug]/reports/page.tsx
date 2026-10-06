'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Badge, Card, CardContent } from '@/components/ui/card';
import { reportStatusLabel, reportStatusTone } from '@/lib/reports';
import { formatRunDate } from '@/lib/runs';
import type { TrailReport } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

// This kennel's trail reports, to whoever could see the run each belongs to.
export default function KennelReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [items, setItems] = useState<TrailReport[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { items: TrailReport[] } }>('/reports', { params: { kennelSlug: slug, limit: 50 } })
      .then((res) => !cancelled && setItems(res.data.data.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link
          href={`/kennels/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {items?.[0]?.run.kennel.name ?? 'Back to kennel'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Trail reports</h1>
      </Card>

      {items === null && <div className="h-48 animate-pulse bg-card sm:rounded-xl" aria-busy />}

      {items?.length === 0 && (
        <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="kennel-reports-empty">
          <p className="font-semibold">No trail reports yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            After a run reaches reporting, its Scribe writes it up here.
          </p>
        </Card>
      )}

      <ul className="space-y-4" data-testid="kennel-report-list">
        {items?.map((report) => (
          <li key={report.id}>
            <Card className={bleedCard}>
              <CardContent className="p-5">
                {report.status === 'ARCHIVED' && (
                  <Badge className={cn(reportStatusTone(report.status))}>{reportStatusLabel[report.status]}</Badge>
                )}
                <h2 className="text-lg font-bold">
                  <Link href={`/reports/${report.id}`} className="hover:underline">
                    #{report.run.runNumber} · {report.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatRunDate(report.run.startsAt, report.run.timeZone)} · Written by {report.scribe}
                  {report.publishedAt && ` · Published ${formatDate(report.publishedAt)}`}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </FeedLayout>
  );
}
