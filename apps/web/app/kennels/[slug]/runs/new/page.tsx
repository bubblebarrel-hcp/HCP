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
import type { RunDetail, RunPlanningContext } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

export default function NewRunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [context, setContext] = useState<RunPlanningContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: RunPlanningContext }>(`/kennels/${encodeURIComponent(slug)}/runs/planning`)
      .then((res) => {
        if (!cancelled) setContext(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not open run planning'));
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="plan-run-forbidden">
        <p className="font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/kennels/${slug}/runs`}>Back to runs</Link>
        </Button>
      </Card>,
    );
  }
  if (!user || !context) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const selfIsMember = context.members.some((m) => m.userId === user.id);

  return shell(
    <>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link
          href={`/kennels/${slug}/runs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {context.kennel.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Plan a run</h1>
        <p className="text-muted-foreground">It is saved as a draft. Publish it when the hares and details are ready.</p>
      </Card>
      <RunForm
        canManage
        canChangeVisibility={context.canChangeVisibility}
        members={context.members}
        submitLabel="Save draft"
        defaults={{
          runNumber: String(context.nextRunNumber),
          title: '',
          runType: 'REGULAR',
          theme: '',
          description: '',
          startsAtLocal: '',
          timeZone: context.kennel.timeZone,
          meetingPointName: '',
          meetingAddress: '',
          visibility: context.kennel.defaultRunVisibility,
          capacity: '',
          hashCash: '',
          allowGuests: true,
          allowVisitors: true,
          leadHareId: selfIsMember ? user.id : '',
          coHareIds: [],
        }}
        onSubmit={async (payload) => {
          try {
            const res = await api.post<{ data: { run: RunDetail } }>(
              `/kennels/${encodeURIComponent(slug)}/runs`,
              payload,
            );
            toast.success('Draft saved. Publish it when the details are ready.');
            router.push(`/runs/${res.data.data.run.id}`);
          } catch (err) {
            toast.error(errorMessage(err, 'Could not save the run'));
          }
        }}
      />
    </>,
  );
}
