import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RouteMap } from '@/components/record/route-map';
import { StatGrid } from '@/components/record/stat-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Segmented, Skeleton } from '@/components/ui/web-ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { audienceLabel, audienceNote, formatDistance, formatDuration, formatPace, kindLabel } from '@/lib/activities';
import { formatDate } from '@/lib/format';
import type { ActivityAudience, RunActivity } from '@/lib/types';

// One recorded run (D79): the route, the figures and the kilometre splits. The
// hasher sees their own whole and can change who sees it or delete it; anyone else
// sees what the API gives them, with the ends of the route already cut.
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<RunActivity | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ activity: RunActivity }>(`/activities/${id}`);
      setActivity(data.activity);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else Alert.alert('Could not load that run', errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function setAudience(audience: ActivityAudience) {
    if (!activity || audience === activity.audience) return;
    setBusy(true);
    try {
      const data = await api<{ activity: RunActivity }>(`/activities/${activity.id}`, { method: 'PATCH', body: { audience } });
      setActivity(data.activity);
    } catch (err) {
      Alert.alert('Could not change that', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!activity) return;
    Alert.alert('Delete this run?', 'It will no longer be on your Passport. This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void api(`/activities/${activity.id}`, { method: 'DELETE' })
            .then(() => router.replace('/activities' as never))
            .catch((err) => Alert.alert('Could not delete', errorMessage(err)));
        },
      },
    ]);
  }

  if (missing) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <Card style={styles.pad}>
          <CardHeader>
            <CardTitle>Run not found</CardTitle>
            <CardDescription>It may have been deleted, or it is not yours to see.</CardDescription>
          </CardHeader>
        </Card>
      </ThemedView>
    );
  }
  if (!activity) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <Skeleton />
      </ThemedView>
    );
  }

  const line = (activity.track ?? []).map(([latitude, longitude]) => ({ latitude, longitude }));
  const splits = activity.splits ?? [];
  const fastest = splits.length > 0 ? Math.min(...splits.map((s) => s.paceSPerKm)) : 0;
  const slowest = splits.length > 0 ? Math.max(...splits.map((s) => s.paceSPerKm)) : 0;

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {line.length >= 2 ? (
          <RouteMap segments={[line]} height={300} testID="activity-map" />
        ) : (
          <Card>
            <CardContent>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                This run is too short, or too close to home, to draw a route for anyone else.
              </ThemedText>
            </CardContent>
          </Card>
        )}

        <View style={styles.head}>
          <ThemedText accessibilityRole="header" testID="activity-title" style={styles.h1}>
            {activity.title ?? kindLabel[activity.kind]}
          </ThemedText>
          <View style={styles.meta}>
            <Badge>{kindLabel[activity.kind]}</Badge>
            <ThemedText themeColor="textSecondary" style={styles.sm}>{formatDate(activity.startedAt)}</ThemedText>
          </View>
          {activity.notes ? <ThemedText style={styles.sm}>{activity.notes}</ThemedText> : null}
        </View>

        <StatGrid
          hero={{ label: 'Distance', value: formatDistance(activity.distanceM), unit: 'km', testID: 'activity-distance' }}
          stats={[
            { label: 'Time', value: formatDuration(activity.movingTimeS), testID: 'activity-time' },
            { label: 'Avg pace', value: formatPace(activity.avgPaceSPerKm), unit: '/km', testID: 'activity-pace' },
            { label: 'Climb', value: String(activity.elevationGainM), unit: 'm' },
            { label: 'Descent', value: String(activity.elevationLossM), unit: 'm' },
          ]}
        />

        {splits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Splits</CardTitle>
            </CardHeader>
            <CardContent style={styles.splits}>
              <View testID="activity-splits" style={styles.splits}>{splits.map((s) => {
                // Bars run from the slowest split (short) to the fastest (full).
                const width = slowest === fastest ? 1 : 0.35 + 0.65 * ((slowest - s.paceSPerKm) / (slowest - fastest));
                return (
                  <View key={s.index} style={styles.splitRow}>
                    <ThemedText themeColor="textSecondary" style={styles.splitKm}>
                      {s.distanceM >= 1000 ? s.index : `${(s.distanceM / 1000).toFixed(2)}`}
                    </ThemedText>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { width: `${Math.round(width * 100)}%` }]} />
                    </View>
                    <ThemedText style={styles.splitPace}>{formatPace(s.paceSPerKm)}</ThemedText>
                  </View>
                );
              })}</View>
            </CardContent>
          </Card>
        )}

        {activity.isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Who can see this run</CardTitle>
              <CardDescription>{audienceNote[activity.audience]}</CardDescription>
            </CardHeader>
            <CardContent style={styles.form}>
              <Segmented<ActivityAudience>
                value={activity.audience}
                onChange={(next) => void setAudience(next)}
                testIDPrefix="audience"
                options={(['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] as const).map((value) => ({ value, label: audienceLabel[value] }))}
              />
              <Button variant="outline" disabled={busy} onPress={remove} testID="activity-delete">Delete this run</Button>
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { margin: 16 },
  content: { gap: 16, paddingBottom: 48 },
  head: { gap: 6, paddingHorizontal: 16 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sm: { fontSize: 14, lineHeight: 20 },
  form: { gap: 12 },
  splits: { gap: 8 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitKm: { width: 36, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, height: 12 },
  bar: { height: 12, borderRadius: 6, backgroundColor: '#f4511e' },
  splitPace: { width: 56, fontSize: 14, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
});
