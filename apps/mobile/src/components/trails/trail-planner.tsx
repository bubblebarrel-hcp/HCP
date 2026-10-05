import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Beer, Flag, PenLine, Route, Undo2, X, type LucideIcon } from 'lucide-react-native';

import { TrailMap } from '@/components/map/trail-map';
import { ThemedText } from '@/components/themed-text';
import { Select } from '@/components/ui/select';
import { Button, Card, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { chalkLabel, trailPoints, waypointKindLabel, type MapPoint } from '@/lib/trails';
import type { ChalkSymbol, RouteGeoJson, Trail, WaypointKind } from '@/lib/types';

// The hare's workspace (components/trails/TrailPlanner.tsx): draw the route, drop
// waypoints, beer checks and chalk. Everything here is secret until the trail is
// released; the server enforces that. On a phone the web's "click the map" is a tap.
type Tool = 'none' | 'route' | 'waypoint' | 'beer' | 'chalk';

const tools: { value: Tool; label: string; icon: LucideIcon }[] = [
  { value: 'none', label: 'Look around', icon: PenLine },
  { value: 'route', label: 'Draw route', icon: Route },
  { value: 'waypoint', label: 'Waypoint', icon: Flag },
  { value: 'beer', label: 'Beer check', icon: Beer },
  { value: 'chalk', label: 'Chalk', icon: X },
];

interface Pending {
  tool: 'waypoint' | 'beer' | 'chalk';
  lat: number;
  lng: number;
  kind: WaypointKind;
  symbol: ChalkSymbol;
  label: string;
}

export function TrailPlanner({
  trail,
  center,
  onTrail,
}: {
  trail: Trail;
  center: [number, number] | null;
  onTrail: (trail: Trail) => void;
}) {
  const theme = useTheme();
  const [tool, setTool] = useState<Tool>('none');
  const [draft, setDraft] = useState<RouteGeoJson | null>(trail.secret?.routeGeoJson ?? null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const savedRoute = trail.secret?.routeGeoJson ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedRoute);

  function addRoutePoint(lng: number, lat: number) {
    setDraft((prev) => ({ type: 'LineString', coordinates: [...(prev?.coordinates ?? []), [lng, lat] as [number, number]] }));
  }

  async function send(path: string, method: 'PATCH' | 'POST', body: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await api<{ trail: Trail }>(path, { method, body });
      onTrail(data.trail);
      return true;
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
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
      Object.assign(body, { startLatitude: startLat, startLongitude: startLng, finishLatitude: finishLat, finishLongitude: finishLng });
    }
    await send(`/trails/${trail.id}`, 'PATCH', body);
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
    const ok = await send(paths[pending.tool], 'POST', bodies[pending.tool]);
    if (ok) setPending(null);
  }

  const points = trailPoints(trail);
  const draftPoints: MapPoint[] = pending
    ? [...points, { id: 'pending', mark: '+', label: 'New point', latitude: pending.lat, longitude: pending.lng, tone: 'primary' }]
    : points;

  return (
    <View style={styles.root}>
      <Card>
        <View testID="trail-tools" style={styles.tools}>
          {tools.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              size="sm"
              variant={tool === value ? 'default' : 'outline'}
              testID={`trail-tool-${value}`}
              onPress={() => {
                setTool(value);
                setPending(null);
              }}>
              <Icon size={16} color={tool === value ? theme.onPrimary : theme.text} />
              <ThemedText style={[styles.toolText, { color: tool === value ? theme.onPrimary : theme.text }]}>{label}</ThemedText>
            </Button>
          ))}
          {tool === 'route' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft?.coordinates.length}
                onPress={() =>
                  setDraft((prev) =>
                    prev && prev.coordinates.length > 1 ? { type: 'LineString', coordinates: prev.coordinates.slice(0, -1) } : null,
                  )
                }>
                <Undo2 size={16} color={theme.text} />
                <ThemedText style={styles.toolText}>Undo point</ThemedText>
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setDraft(null)}>Clear</Button>
            </>
          )}
          {dirty && (
            <Button size="sm" disabled={busy} testID="trail-save-route" onPress={() => void saveRoute()}>
              {busy ? 'Saving…' : 'Save route'}
            </Button>
          )}
        </View>
      </Card>

      <ThemedText themeColor="textSecondary" style={styles.hint}>
        {tool === 'route'
          ? 'Tap the map to add points to the route. Save when the shape is right.'
          : tool === 'none'
            ? 'Pick a tool to add to the trail.'
            : 'Tap the map to place it.'}
      </ThemedText>

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
        <Card>
          <View testID="trail-pending" style={styles.pending}>
            <ThemedText style={styles.pendingTitle}>
              {pending.tool === 'waypoint' ? 'New waypoint' : pending.tool === 'beer' ? 'New beer check' : 'New chalk mark'}
            </ThemedText>
            {pending.tool === 'waypoint' && (
              <Field label="Kind">
                <Select
                  testID="pending-kind"
                  value={pending.kind}
                  onChange={(value) => setPending({ ...pending, kind: value as WaypointKind })}
                  options={Object.entries(waypointKindLabel).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            )}
            {pending.tool === 'chalk' && (
              <Field label="Symbol">
                <Select
                  testID="pending-symbol"
                  value={pending.symbol}
                  onChange={(value) => setPending({ ...pending, symbol: value as ChalkSymbol })}
                  options={Object.entries(chalkLabel).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            )}
            <Field label={pending.tool === 'beer' ? 'Name' : 'Label (optional)'} hint={`${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`}>
              <Input testID="pending-label" value={pending.label} onChangeText={(label) => setPending({ ...pending, label })} />
            </Field>
            <View style={styles.pendingActions}>
              <Button variant="outline" size="sm" onPress={() => setPending(null)}>Cancel</Button>
              <Button size="sm" disabled={busy} testID="trail-pending-save" onPress={() => void savePending()}>
                {busy ? 'Saving…' : 'Add'}
              </Button>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  // flex flex-wrap items-center gap-2 p-3
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12 },
  toolText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  hint: { paddingHorizontal: 16, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  pending: { padding: 16, gap: 12 },
  pendingTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  pendingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
