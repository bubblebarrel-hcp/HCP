'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Beer, Flag, PenLine, Route, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { chalkLabel, chalkMark, waypointKindLabel, waypointMark } from '@/lib/trails';
import type { ChalkSymbol, RouteGeoJson, Trail, WaypointKind } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';
import type { MapPoint } from '@/components/map/TrailMap';

// MapLibre needs a browser; never render it on the server.
const TrailMap = dynamic(() => import('@/components/map/TrailMap').then((m) => m.TrailMap), {
  ssr: false,
  loading: () => <div className="h-[24rem] w-full animate-pulse bg-muted sm:rounded-xl" aria-busy />,
});

type Tool = 'none' | 'route' | 'waypoint' | 'beer' | 'chalk';

const tools: { value: Tool; label: string; icon: typeof Route }[] = [
  { value: 'none', label: 'Look around', icon: PenLine },
  { value: 'route', label: 'Draw route', icon: Route },
  { value: 'waypoint', label: 'Waypoint', icon: Flag },
  { value: 'beer', label: 'Beer check', icon: Beer },
  { value: 'chalk', label: 'Chalk', icon: X },
];

export function trailPoints(trail: Trail): MapPoint[] {
  const secret = trail.secret;
  if (!secret) return [];
  return [
    ...secret.waypoints.map((w) => ({
      id: w.id,
      mark: waypointMark[w.kind],
      label: `${waypointKindLabel[w.kind]}${w.label ? `: ${w.label}` : ''}`,
      latitude: w.latitude,
      longitude: w.longitude,
      tone: w.kind === 'HAZARD' ? ('danger' as const) : ('primary' as const),
    })),
    ...secret.beerChecks.map((b) => ({
      id: b.id,
      mark: 'B',
      label: `Beer check: ${b.name}`,
      latitude: b.latitude,
      longitude: b.longitude,
      tone: 'accent' as const,
    })),
    ...secret.chalk.map((c) => ({
      id: c.id,
      mark: chalkMark[c.symbol],
      label: `${chalkLabel[c.symbol]}${c.customLabel ? `: ${c.customLabel}` : ''}`,
      latitude: c.latitude,
      longitude: c.longitude,
      tone: 'plain' as const,
    })),
  ];
}

interface Pending {
  tool: 'waypoint' | 'beer' | 'chalk';
  lat: number;
  lng: number;
  kind: WaypointKind;
  symbol: ChalkSymbol;
  label: string;
}

// The hare's workspace: draw the route, drop waypoints, beer checks and chalk.
// Everything here is secret until the trail is released; the server enforces that.
export function TrailPlanner({
  trail,
  center,
  onTrail,
}: {
  trail: Trail;
  center: [number, number] | null;
  onTrail: (trail: Trail) => void;
}) {
  const [tool, setTool] = useState<Tool>('none');
  const [draft, setDraft] = useState<RouteGeoJson | null>(trail.secret?.routeGeoJson ?? null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const savedRoute = trail.secret?.routeGeoJson ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedRoute);

  function addRoutePoint(lng: number, lat: number) {
    setDraft((prev) => ({
      type: 'LineString',
      coordinates: [...(prev?.coordinates ?? []), [lng, lat] as [number, number]],
    }));
  }

  async function send(request: Promise<{ data: { data: { trail: Trail } } }>, success: string) {
    setBusy(true);
    try {
      const res = await request;
      onTrail(res.data.data.trail);
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveRoute() {
    const coordinates = draft?.coordinates ?? [];
    const body: Record<string, unknown> = {
      routeGeoJson: coordinates.length >= 2 ? { type: 'LineString', coordinates } : null,
    };
    if (coordinates.length >= 2) {
      const [startLng, startLat] = coordinates[0];
      const [finishLng, finishLat] = coordinates[coordinates.length - 1];
      Object.assign(body, {
        startLatitude: startLat,
        startLongitude: startLng,
        finishLatitude: finishLat,
        finishLongitude: finishLng,
      });
    }
    await send(api.patch(`/trails/${trail.id}`, body), 'Route saved.');
  }

  async function savePending() {
    if (!pending) return;
    const paths = {
      waypoint: `/trails/${trail.id}/waypoints`,
      beer: `/trails/${trail.id}/beer-checks`,
      chalk: `/trails/${trail.id}/chalk`,
    };
    const bodies = {
      waypoint: { kind: pending.kind, label: pending.label, latitude: pending.lat, longitude: pending.lng },
      beer: { name: pending.label || 'Beer check', latitude: pending.lat, longitude: pending.lng },
      chalk: { symbol: pending.symbol, customLabel: pending.label, latitude: pending.lat, longitude: pending.lng },
    };
    const ok = await send(api.post(paths[pending.tool], bodies[pending.tool]), 'Added to the trail.');
    if (ok) setPending(null);
  }

  const points = trailPoints(trail);
  const draftPoints: MapPoint[] = pending
    ? [...points, { id: 'pending', mark: '+', label: 'New point', latitude: pending.lat, longitude: pending.lng, tone: 'primary' }]
    : points;

  return (
    <div className="space-y-3">
      <Card className={cn(bleedCard, 'flex flex-wrap items-center gap-2 p-3')} data-testid="trail-tools">
        {tools.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={tool === value ? 'default' : 'outline'}
            aria-pressed={tool === value}
            onClick={() => {
              setTool(value);
              setPending(null);
            }}
            data-testid={`trail-tool-${value}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          {tool === 'route' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft?.coordinates.length}
                onClick={() =>
                  setDraft((prev) =>
                    prev && prev.coordinates.length > 1
                      ? { type: 'LineString', coordinates: prev.coordinates.slice(0, -1) }
                      : null,
                  )
                }
              >
                <Undo2 className="h-4 w-4" aria-hidden />
                Undo point
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Clear
              </Button>
            </>
          )}
          {dirty && (
            <Button size="sm" disabled={busy} onClick={() => void saveRoute()} data-testid="trail-save-route">
              {busy ? 'Saving…' : 'Save route'}
            </Button>
          )}
        </span>
      </Card>

      <p className="px-4 text-sm text-muted-foreground sm:px-0">
        {tool === 'route'
          ? 'Click the map to add points to the route. Save when the shape is right.'
          : tool === 'none'
            ? 'Pick a tool to add to the trail.'
            : 'Click the map to place it.'}
      </p>

      <TrailMap
        route={draft}
        points={draftPoints}
        center={center}
        onMapClick={
          tool === 'none'
            ? undefined
            : ({ lng, lat }) => {
                if (tool === 'route') return addRoutePoint(lng, lat);
                setPending({ tool, lat, lng, kind: 'CHECKPOINT', symbol: 'CHECK', label: '' });
              }
        }
      />

      {pending && (
        <Card className={cn(bleedCard, 'space-y-3 p-4')} data-testid="trail-pending">
          <p className="font-semibold">
            {pending.tool === 'waypoint' ? 'New waypoint' : pending.tool === 'beer' ? 'New beer check' : 'New chalk mark'}
          </p>
          {pending.tool === 'waypoint' && (
            <Field label="Kind" htmlFor="pending-kind">
              <Select
                id="pending-kind"
                value={pending.kind}
                onChange={(e) => setPending({ ...pending, kind: e.target.value as WaypointKind })}
              >
                {Object.entries(waypointKindLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {pending.tool === 'chalk' && (
            <Field label="Symbol" htmlFor="pending-symbol">
              <Select
                id="pending-symbol"
                value={pending.symbol}
                onChange={(e) => setPending({ ...pending, symbol: e.target.value as ChalkSymbol })}
              >
                {Object.entries(chalkLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={pending.tool === 'beer' ? 'Name' : 'Label (optional)'}
            htmlFor="pending-label"
            hint={`${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`}
          >
            <Input
              id="pending-label"
              value={pending.label}
              onChange={(e) => setPending({ ...pending, label: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void savePending()} data-testid="trail-pending-save">
              {busy ? 'Saving…' : 'Add'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
