'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Avatar } from '@/components/Avatar';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { reportStatusLabel, reportStatusTone } from '@/lib/reports';
import { formatRunDate } from '@/lib/runs';
import type { TrailReport } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

// The archive. A report is listed to whoever could see the run it belongs to,
// so an anonymous reader sees the public ones (D29).
export default function ReportsPage() {
  const [items, setItems] = useState<TrailReport[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { items: TrailReport[] } }>('/reports')
      .then((res) => !cancelled && setItems(res.data.data.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FeedLayout left={<LeftNav />}>
      <div className="space-y-4">
        <Card className={bleedCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" aria-hidden />
              Trail reports
            </CardTitle>
            <CardDescription>What the pack did, written down by the people who were there.</CardDescription>
          </CardHeader>
        </Card>

        {items === null && <div className="h-48 animate-pulse bg-card sm:rounded-xl" aria-busy />}

        {items?.length === 0 && (
          <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="reports-empty">
            <p className="font-semibold">No trail reports yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              After a run reaches reporting, its Scribe writes it up here.
            </p>
          </Card>
        )}

        <ul className="space-y-4" data-testid="report-list">
          {items?.map((report) => (
            <li key={report.id}>
              <Card className={bleedCard}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar name={report.run.kennel.shortName} size="sm" />
                    <Link href={`/kennels/${report.run.kennel.slug}`} className="text-sm font-medium hover:underline">
                      {report.run.kennel.name}
                    </Link>
                    {report.status === 'ARCHIVED' && (
                      <Badge className={cn(reportStatusTone(report.status))}>{reportStatusLabel[report.status]}</Badge>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-bold">
                    <Link href={`/reports/${report.id}`} className="hover:underline" data-testid="report-link">
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
      </div>
    </FeedLayout>
  );
}
