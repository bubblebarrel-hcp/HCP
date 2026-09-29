'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { RunForm } from '@/components/runs/RunForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { runHeading } from '@/lib/runs';
import type { RunDetail, RunPlanningContext } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

export default function EditRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [context, setContext] = useState<RunPlanningContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: { run: RunDetail } }>(`/runs/${id}`)
      .then(async (res) => {
        const detail = res.data.data.run;
        // Officers choose hares, which needs the kennel's member list.
        const ctx = detail.viewer.canManage
          ? (await api.get<{ data: RunPlanningContext }>(`/kennels/${encodeURIComponent(detail.kennel.slug)}/runs/planning`)).data.data
          : null;
        if (cancelled) return;
        setRun(detail);
        setContext(ctx);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load the run'));
      });
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')}>
        <p className="font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </Card>,
    );
  }
  if (!user || !run) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  if (!run.viewer.canEdit) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="edit-run-forbidden">
        <p className="font-semibold">This run can&apos;t be edited by you right now.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hares edit while the run is a draft, scheduled or in planning; officers until it starts.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/runs/${id}`}>Back to the run</Link>
        </Button>
      </Card>,
    );
  }

  const lead = run.hares.find((h) => h.isLead);

  return shell(
    <>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link href={`/runs/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {runHeading(run)}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Edit run</h1>
        <p className="text-muted-foreground">Every change is recorded with its previous value.</p>
      </Card>
      <RunForm
        canManage={run.viewer.canManage}
        canChangeVisibility={run.viewer.canChangeVisibility}
        members={context?.members}
        submitLabel="Save changes"
        defaults={{
          runNumber: String(run.runNumber),
          title: run.title,
          runType: run.runType,
          theme: run.theme ?? '',
          description: run.description ?? '',
          startsAtLocal: run.startsAtLocal,
          timeZone: run.timeZone,
          meetingPointName: run.meetingPointName ?? '',
          meetingAddress: run.meetingAddress ?? '',
          visibility: run.visibility,
          capacity: run.capacity ? String(run.capacity) : '',
          hashCash: run.hashCash ?? '',
          allowGuests: run.allowGuests,
          allowVisitors: run.allowVisitors,
          leadHareId: lead?.userId ?? '',
          coHareIds: run.hares.filter((h) => !h.isLead).map((h) => h.userId),
        }}
        onSubmit={async (payload) => {
          try {
            await api.patch(`/runs/${id}`, payload);
            toast.success('Run updated.');
            router.push(`/runs/${id}`);
          } catch (err) {
            toast.error(errorMessage(err, 'Could not save the run'));
          }
        }}
      />
    </>,
  );
}
