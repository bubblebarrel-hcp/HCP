'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { reportStatusLabel, reportStatusTone } from '@/lib/reports';
import type { TrailReport } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// The Trail Report as it appears on the run: a way in for the Scribe, a way to
// read it for everyone else. A draft nobody is entitled to see returns nothing
// at all (BR-SCRIBE-004), so this renders nothing rather than a locked card.
export function ReportPanel({ runId }: { runId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<TrailReport | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { report: TrailReport | null; canStart: boolean } }>(`/runs/${runId}/report`)
      .then((res) => {
        if (cancelled) return;
        setReport(res.data.data.report);
        setCanStart(res.data.data.canStart);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function start() {
    setStarting(true);
    try {
      const res = await api.post<{ data: { report: TrailReport } }>(`/runs/${runId}/report`, {});
      router.push(`/reports/${res.data.data.report.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      setStarting(false);
    }
  }

  if (!loaded) return null;
  if (!report && !canStart) return null;

  return (
    <Card className={bleedCard} data-testid="report-panel">
      <CardHeader className="pb-3">
        <CardTitle>Trail Report</CardTitle>
        <CardDescription>
          {report
            ? report.status === 'PUBLISHED' || report.status === 'ARCHIVED'
              ? `Written by ${report.scribe}.`
              : `${report.scribe} is writing it.`
            : 'Nobody has written up this run yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {report ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(reportStatusTone(report.status))} data-testid="report-status">
                {reportStatusLabel[report.status]}
              </Badge>
              <span className="font-medium">{report.title}</span>
            </div>
            <Button asChild variant={report.viewer.canEdit ? 'default' : 'outline'} data-testid="report-open">
              <Link href={`/reports/${report.id}`}>
                {report.viewer.canEdit ? (
                  <>
                    <PenLine className="h-4 w-4" aria-hidden />
                    Open in Scribe Studio
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4" aria-hidden />
                    Read the report
                  </>
                )}
              </Link>
            </Button>
          </>
        ) : (
          <Button type="button" onClick={start} disabled={starting} data-testid="report-start">
            <PenLine className="h-4 w-4" aria-hidden />
            {starting ? 'Starting…' : 'Write the Trail Report'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
