'use client';

import { use, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Beer, Clock, Flag, Footprints, Lock, MapPin, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { GpxButtons } from '@/components/trails/GpxButtons';
import { TrailPlanner, trailPoints } from '@/components/trails/TrailPlanner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  chalkLabel,
  formatDistance,
  formatDuration,
  releaseModeLabel,
  trailStatusLabel,
  trailStatusTone,
  trailSteps,
  trailStyleLabel,
  waypointKindLabel,
} from '@/lib/trails';
import { formatRunDate, runHeading } from '@/lib/runs';
import type { RunDetail, Trail, TrailRevision, Page } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

const TrailMap = dynamic(() => import('@/components/map/TrailMap').then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="h-[24rem] w-full animate-pulse bg-muted sm:rounded-xl" aria-busy />,
});

const PLANNING_STATES = ['DRAFT', 'PLANNING', 'REVIEW'];

export default function TrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [revisions, setRevisions] = useState<TrailRevision[] | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The planner keeps its own copy of the route while it is being drawn, so an
  // import (which replaces the route) remounts it to start from the new one.
  const [importCount, setImportCount] = useState(0);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    api
      .get<{ data: { trail: Trail } }>(`/trails/${id}`)
      .then(async (res) => {
        const detail = res.data.data.trail;
        const runRes = await api.get<{ data: { run: RunDetail } }>(`/runs/${detail.runId}`);
        if (cancelled) return;
        setTrail(detail);
        setRun(runRes.data.data.run);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Trail not found'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, loading, user]);

  const act = useCallback(
    async (action: string, reason?: string) => {
      try {
        const res = await api.post<{ data: { trail: Trail } }>(`/trails/${id}/actions/${action}`, { reason });
        setTrail(res.data.data.trail);
        toast.success('Trail updated.');
      } catch (err) {
        toast.error(errorMessage(err, 'That did not work'));
        throw err;
      }
    },
    [id],
  );

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="trail-not-found">
        <p className="font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/runs">Back to runs</Link>
        </Button>
      </Card>,
    );
  }
  if (!trail || !run) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const v = trail.viewer;
  const secret = trail.secret;
  const step = trailSteps[trail.status];
  const canStep = step && (step.needsLead ? v.canRelease : v.canPlan);
  const editable = v.canPlan && PLANNING_STATES.includes(trail.status);
  const center: [number, number] | null =
    run.meetingLongitude !== null && run.meetingLatitude !== null
      ? [run.meetingLongitude, run.meetingLatitude]
      : secret?.routeGeoJson?.coordinates[0] ?? null;

  const distance = formatDistance(trail.estimatedDistanceM);
  const duration = formatDuration(trail.estimatedDurationMin);

  return shell(
    <div className="space-y-4">
      <Card className={cn(bleedCard, 'p-5')} data-testid="trail-header">
        <Link
          href={`/runs/${trail.runId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {runHeading(run)}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={trailStatusTone(trail.status)} data-testid="trail-status">
            {trailStatusLabel[trail.status]}
          </Badge>
          <Badge>{trailStyleLabel[trail.style]}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight" data-testid="trail-name">
          {trail.name}
        </h1>
        <ul className="mt-3 space-y-2 text-[15px]">
          <li className="flex items-center gap-3">
            <Footprints className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            {trail.hares.length === 0
              ? 'No hares'
              : `Hare${trail.hares.length > 1 ? 's' : ''}: ${trail.hares
                  .map((h) => (h.isLead && trail.hares.length > 1 ? `${h.displayName} (lead)` : h.displayName))
                  .join(', ')}`}
          </li>
          {(distance || duration) && (
            <li className="flex items-center gap-3">
              <Ruler className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              {[distance, duration].filter(Boolean).join(' · ')}
              {trail.terrain && ` · ${trail.terrain}`}
            </li>
          )}
          <li className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            {trail.isReleased
              ? `Released ${formatDate(trail.releasedAt ?? trail.createdAt)}`
              : `Releases: ${releaseModeLabel[trail.releaseMode].toLowerCase()}${
                  trail.releaseMode === 'SCHEDULED' && trail.releaseAt
                    ? ` (${formatRunDate(trail.releaseAt, run.timeZone)})`
                    : ''
                }`}
          </li>
        </ul>
        {v.canSeeSecret && (
          <div className="mt-4">
            <GpxButtons
              trail={trail}
              canImport={editable}
              onTrail={(next) => {
                setTrail(next);
                setImportCount((n) => n + 1);
              }}
            />
          </div>
        )}
      </Card>

      {(canStep || v.canArchive) && (
        <Card className={cn(bleedCard, 'flex flex-wrap items-center gap-2 p-4')} data-testid="trail-lifecycle">
          {canStep && (
            <ActionDialog
              trigger={
                <Button data-testid="trail-next-step">{step.label}</Button>
              }
              title={`${step.label}?`}
              description={
                step.action === 'release'
                  ? 'Everyone who can see the run will see the route, waypoints, beer checks and chalk.'
                  : step.action === 'hide'
                    ? 'The trail becomes secret until its release condition is met. This cannot be undone.'
                    : step.action === 'lock'
                      ? 'Planning stops. A hare can unlock it again before it is hidden.'
                      : undefined
              }
              confirmLabel={step.label}
              text={step.action === 'release' ? { label: 'Note' } : undefined}
              onConfirm={({ text }) => act(step.action, text)}
            />
          )}
          {trail.status === 'LOCKED' && v.canPlan && (
            <Button variant="outline" onClick={() => void act('restore-draft').catch(() => undefined)}>
              Unlock for editing
            </Button>
          )}
          {v.canArchive && ['RELEASED', 'LIVE', 'COMPLETED'].includes(trail.status) && (
            <ActionDialog
              trigger={<Button variant="ghost">Archive trail</Button>}
              title="Archive this trail?"
              description="It becomes part of the run's history and stops changing."
              confirmLabel="Archive"
              onConfirm={() => act('archive')}
            />
          )}
          {v.canPlan && (
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={async () => {
                const next = !showRevisions;
                setShowRevisions(next);
                if (next && !revisions) {
                  try {
                    const res = await api.get<{ data: Page<TrailRevision> }>(`/trails/${id}/revisions`);
                    setRevisions(res.data.data.items);
                  } catch (err) {
                    toast.error(errorMessage(err, 'Could not load the history'));
                    setShowRevisions(false);
                  }
                }
              }}
              aria-expanded={showRevisions}
            >
              History
            </Button>
          )}
        </Card>
      )}

      {showRevisions && (
        <Card className={bleedCard} data-testid="trail-revisions">
          <CardHeader className="pb-3">
            <CardTitle>Planning history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
              {(revisions ?? []).map((revision) => (
                <li key={revision.id}>
                  <span className="font-medium">{Object.keys(revision.changes).join(', ') || 'Edited'}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatDate(revision.createdAt)} · {revision.editor}
                  </span>
                </li>
              ))}
              {revisions?.length === 0 && <li className="text-muted-foreground">No edits recorded yet.</li>}
            </ol>
          </CardContent>
        </Card>
      )}

      {!v.canSeeSecret ? (
        <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="trail-hidden">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-semibold">The hares are keeping this one quiet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The route, waypoints, beer checks and chalk appear when the trail is released:{' '}
            {releaseModeLabel[trail.releaseMode].toLowerCase()}
            {trail.releaseMode === 'SCHEDULED' && trail.releaseAt && `, ${formatRunDate(trail.releaseAt, run.timeZone)}`}.
          </p>
        </Card>
      ) : editable ? (
        <TrailPlanner key={importCount} trail={trail} center={center} onTrail={setTrail} />
      ) : (
        <TrailMap route={secret?.routeGeoJson ?? null} points={trailPoints(trail)} center={center} />
      )}

      {v.canSeeSecret && secret && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className={bleedCard} data-testid="trail-waypoints">
            <CardHeader className="pb-3">
              <CardTitle>Waypoints and beer checks</CardTitle>
            </CardHeader>
            <CardContent>
              {secret.waypoints.length === 0 && secret.beerChecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing placed yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {secret.waypoints.map((w) => (
                    <li key={w.id} className="flex items-start gap-3">
                      {w.kind === 'HAZARD' ? (
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                      ) : (
                        <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
                      )}
                      <span>
                        <span className="font-medium">{waypointKindLabel[w.kind]}</span>
                        {w.label && ` · ${w.label}`}
                        {w.notes && <span className="block text-muted-foreground">{w.notes}</span>}
                      </span>
                    </li>
                  ))}
                  {secret.beerChecks.map((b) => (
                    <li key={b.id} className="flex items-start gap-3">
                      <Beer className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                      <span>
                        <span className="font-medium">{b.name}</span>
                        {b.notes && <span className="block text-muted-foreground">{b.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className={bleedCard} data-testid="trail-chalk">
            <CardHeader className="pb-3">
              <CardTitle>Digital chalk</CardTitle>
            </CardHeader>
            <CardContent>
              {secret.chalk.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chalk laid yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {secret.chalk.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3">
                      <span>
                        <span className="font-medium">{chalkLabel[c.symbol]}</span>
                        {c.customLabel && ` · ${c.customLabel}`}
                      </span>
                      <span className="text-muted-foreground">{c.placedBy}</span>
                    </li>
                  ))}
                </ul>
              )}
              {secret.notes && (
                <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium">Hare notes:</span> {secret.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>,
  );
}
