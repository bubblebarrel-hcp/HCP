'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, Banknote, CalendarDays, Check, Footprints, MapPin, Pause, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { CapsulePanel } from '@/components/capsules/CapsulePanel';
import { ReportPanel } from '@/components/reports/ReportPanel';
import { RunMedia } from '@/components/runs/RunMedia';
import { RunPoster } from '@/components/runs/RunPoster';
import { HarePanel } from '@/components/runs/HarePanel';
import { AttendanceCard, CircleCard, OrganiserPanel, RsvpPanel, type Send } from '@/components/runs/RunPanels';
import { TrailsPanel } from '@/components/trails/TrailsPanel';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatRunDate,
  runHeading,
  runStatusLabel,
  runStatusTone,
  runTimelineLabel,
  runTypeLabel,
  runVisibilityLabel,
} from '@/lib/runs';
import type { RunDetail, RunStatus } from '@/lib/types';
import { bleedCard, brandColor, cn } from '@/lib/utils';
import { EngagementBar } from '@/components/social/EngagementBar';
import api, { errorMessage } from '@/services/api';

// A Client Component, so the counts are not in its server payload; the bar
// asks for them once it knows who is reading.
const EMPTY_ENGAGEMENT = {
  likes: 0,
  comments: 0,
  reshares: 0,
  bookmarks: 0,
  views: 0,
  liked: false,
  bookmarked: false,
  reshared: false,
};

// Chapter 22 A.3, shown as progress.
const LIFECYCLE: RunStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'PLANNING',
  'TRAIL_HIDDEN',
  'TRAIL_RELEASED',
  'CHECK_IN_OPEN',
  'LIVE',
  'CIRCLE',
  'REPORTING',
  'ARCHIVED',
];

function Stepper({ status }: { status: RunStatus }) {
  const current = LIFECYCLE.indexOf(status);
  return (
    <ol className="flex gap-1 overflow-x-auto border-t border-border px-5 py-3" aria-label="Run progress" data-testid="run-stepper">
      {LIFECYCLE.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
              active && 'bg-primary text-primary-foreground',
              done && 'text-primary-strong',
              !active && !done && 'text-muted-foreground',
            )}
          >
            {done && <Check className="h-3.5 w-3.5" aria-hidden />}
            {runStatusLabel[step]}
          </li>
        );
      })}
    </ol>
  );
}

// The interactive run page. Its own metadata lives on the server component in
// page.tsx, which is the only thing that can produce Open Graph tags (D50).
export function RunDetailPage({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reload when the session changes: what a viewer may see and do depends on who they are.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    api
      .get<{ data: { run: RunDetail } }>(`/runs/${id}`)
      .then((res) => {
        if (cancelled) return;
        setRun(res.data.data.run);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Run not found'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, loading, user]);

  const send: Send = useCallback(async (method, path, body, success) => {
    try {
      const res = await api.request<{ data: { run: RunDetail } }>({ method, url: path, data: body });
      setRun(res.data.data.run);
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      throw err;
    }
  }, []);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="run-not-found">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm text-muted-foreground">It may be members-only, or not published yet.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </Card>,
    );
  }
  if (!run) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const lead = run.hares.find((h) => h.isLead);
  const coHares = run.hares.filter((h) => !h.isLead);
  const openPause = run.isPaused ? run.pauses[run.pauses.length - 1] : null;

  return shell(
    <div className="space-y-4">
      {run.status === 'CANCELLED' && (
        <div
          role="status"
          className="flex items-start gap-3 border-y border-destructive/30 bg-destructive/10 p-4 text-destructive sm:rounded-xl sm:border-x"
          data-testid="run-cancelled"
        >
          <Ban className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">This run was cancelled.</span> {run.cancelReason}
          </p>
        </div>
      )}
      {openPause && (
        <div
          role="status"
          className="flex items-start gap-3 border-y border-accent/30 bg-accent/10 p-4 text-accent-strong sm:rounded-xl sm:border-x"
          data-testid="run-paused"
        >
          <Pause className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">The run is paused.</span> {openPause.reason}
          </p>
        </div>
      )}

      <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="run-header">
        <div className="p-5">
          <Link href={`/kennels/${run.kennel.slug}`} className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
            <Avatar name={run.kennel.shortName} size="sm" color={brandColor(run.kennel.primaryColor)} />
            {run.kennel.name}
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={runStatusTone(run.status)} data-testid="run-status">
              {runStatusLabel[run.status]}
            </Badge>
            <Badge>{runTypeLabel[run.runType]}</Badge>
            <Badge>{runVisibilityLabel[run.visibility]}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" data-testid="run-title">
            {runHeading(run)}
          </h1>
          {run.theme && <p className="mt-1 italic">{run.theme}</p>}
          <ul className="mt-4 space-y-2 text-[15px]">
            <li className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                {formatRunDate(run.startsAt, run.timeZone)}
                <span className="text-sm text-muted-foreground"> ({run.timeZone})</span>
              </span>
            </li>
            {run.meetingPointName && (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  {run.meetingPointName}
                  {run.meetingAddress && <span className="block text-sm text-muted-foreground">{run.meetingAddress}</span>}
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <Footprints className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span data-testid="run-hares">
                {run.hares.length === 0
                  ? 'No hares yet'
                  : `Hare${run.hares.length > 1 ? 's' : ''}: ${[lead, ...coHares]
                      .filter(Boolean)
                      .map((h) => (h!.isLead && run.hares.length > 1 ? `${h!.displayName} (lead)` : h!.displayName))
                      .join(', ')}`}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                {run.counts.going} going{run.capacity ? ` of ${run.capacity}` : ''}
                {!run.allowVisitors && ' · members only'}
                {run.allowGuests && ' · guests welcome'}
              </span>
            </li>
            {run.hashCash && (
              <li className="flex items-start gap-3">
                <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span>Hash cash {run.hashCash}</span>
              </li>
            )}
          </ul>
          {run.description && <p className="mt-4 whitespace-pre-line leading-relaxed">{run.description}</p>}
        </div>
        {/* Like, comment, reshare, share the link out, save (D50). A run is
            the flyer a kennel would otherwise paste into WhatsApp (D43), so
            this is where the share button most earns its place. */}
        <EngagementBar segment="runs" id={run.id} initial={EMPTY_ENGAGEMENT} countViewOnMount showViews={false} />
        {run.status !== 'CANCELLED' && <Stepper status={run.status} />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 xl:order-2">
          <RsvpPanel run={run} send={send} onRun={setRun} />
          <OrganiserPanel run={run} send={send} onRun={setRun} />
        </div>
        <div className="min-w-0 space-y-4 xl:order-1">
          {/* The flyer, when the kennel has made one (D43). */}
          <RunPoster
            runId={run.id}
            posterUrl={run.posterUrl}
            canManage={run.viewer.canOperate}
            onChanged={async () => {
              const res = await api.get<{ data: { run: RunDetail } }>(`/runs/${id}`);
              setRun(res.data.data.run);
            }}
          />
          {/* Who is laying this trail, and who has offered to (D44). */}
          <HarePanel
            run={run}
            onChanged={async () => {
              const res = await api.get<{ data: { run: RunDetail } }>(`/runs/${id}`);
              setRun(res.data.data.run);
            }}
          />
          <TrailsPanel runId={run.id} canPlan={run.viewer.canOperate} />
          <AttendanceCard run={run} send={send} />
          {/* Adding photos needs the hosting kennel or a place on the run; the API is the judge. */}
          <RunMedia
            target={{ type: 'RUN', id: run.id }}
            canContribute={Boolean(user) && (run.viewer.canSeeNames || run.viewer.canOperate)}
          />
          <CircleCard run={run} send={send} />
          <ReportPanel runId={run.id} />
          <CapsulePanel runId={run.id} />
          {run.timeline && run.timeline.length > 0 && (
            <Card className={bleedCard} data-testid="run-timeline">
              <CardHeader className="pb-3">
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
                  {run.timeline.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-medium">{runTimelineLabel[entry.type] ?? entry.type}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        <time dateTime={entry.occurredAt}>{formatRunDate(entry.occurredAt, run.timeZone)}</time>
                        {entry.actor && ` · ${entry.actor}`}
                      </span>
                      {entry.reason && <p className="text-muted-foreground">“{entry.reason}”</p>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
          {!run.viewer.canSeeNames && (
            <p className="px-4 text-sm text-muted-foreground sm:px-0">
              Members of {run.kennel.shortName} see who is going and the Circle record.
            </p>
          )}
        </div>
      </div>
    </div>,
  );
}
