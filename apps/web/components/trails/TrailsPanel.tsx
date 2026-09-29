'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Map as MapIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { formatDistance, releaseModeLabel, trailStatusLabel, trailStatusTone, trailStyleLabel } from '@/lib/trails';
import type { Page, Trail } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

function fetchTrails(runId: string) {
  return api.get<{ data: Page<Trail> }>(`/runs/${runId}/trails`).then((res) => res.data.data.items);
}

function PlanTrailDialog({ runId, onCreated }: { runId: string; onCreated: (trail: Trail) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: 'Main Trail', style: 'DEAD_HARE', releaseMode: 'AT_RUN_START' });

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="plan-trail">
          <Plus className="h-4 w-4" aria-hidden />
          Plan a trail
        </Button>
      </DialogTrigger>
      <DialogContent title="Plan a trail" description="Only the hares see it until it is released.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const res = await api.post<{ data: { trail: Trail } }>(`/runs/${runId}/trails`, values);
              onCreated(res.data.data.trail);
              setOpen(false);
            } catch (err) {
              toast.error(errorMessage(err, 'Could not create the trail'));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Name" htmlFor={`${id}-name`} hint="Main Trail, Walkers Trail, B Trail…">
            <Input
              id={`${id}-name`}
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field label="Style" htmlFor={`${id}-style`}>
            <Select
              id={`${id}-style`}
              value={values.style}
              onChange={(e) => setValues((v) => ({ ...v, style: e.target.value }))}
            >
              {Object.entries(trailStyleLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Release the trail" htmlFor={`${id}-release`} hint="You can change this while planning.">
            <Select
              id={`${id}-release`}
              value={values.releaseMode}
              onChange={(e) => setValues((v) => ({ ...v, releaseMode: e.target.value }))}
            >
              {(['AT_RUN_START', 'CHECK_IN', 'SCHEDULED', 'MANUAL'] as const).map((mode) => (
                <option key={mode} value={mode}>
                  {releaseModeLabel[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="plan-trail-submit">
              {busy ? 'Saving…' : 'Create trail'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The run page's view of its trails. What it shows before release is deliberately
// thin: that a trail exists, how long it is, and when it opens.
export function TrailsPanel({ runId, canPlan }: { runId: string; canPlan: boolean }) {
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTrails(runId)
      .then((items) => {
        if (!cancelled) setTrails(items);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load trails'));
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!canPlan && trails !== null && trails.length === 0) return null;

  return (
    <Card className={bleedCard} data-testid="trails-panel">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle>Trails</CardTitle>
        {canPlan && <PlanTrailDialog runId={runId} onCreated={(trail) => router.push(`/trails/${trail.id}`)} />}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : trails === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy />
        ) : trails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trail yet. The hares lay it before the run.</p>
        ) : (
          <ul className="divide-y divide-border">
            {trails.map((trail) => {
              const distance = formatDistance(trail.estimatedDistanceM);
              return (
                <li key={trail.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                      trail.isReleased ? 'bg-primary/10 text-primary-strong' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {trail.isReleased ? <MapIcon className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/trails/${trail.id}`} className="font-semibold hover:underline" data-testid="trail-link">
                      {trail.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {trailStyleLabel[trail.style]}
                      {distance && ` · ${distance}`}
                      {!trail.isReleased && ` · releases ${releaseModeLabel[trail.releaseMode].toLowerCase()}`}
                    </p>
                  </div>
                  <Badge className={trailStatusTone(trail.status)}>{trailStatusLabel[trail.status]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
