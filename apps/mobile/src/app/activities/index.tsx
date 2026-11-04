import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';

import { RoutePreview } from '@/components/record/route-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { flushPending } from '@/lib/activity-upload';
import { api, errorMessage } from '@/lib/api';
import { audienceLabel, formatDistance, formatDuration, formatPace, kindLabel } from '@/lib/activities';
import { formatDate } from '@/lib/format';
import { listPending } from '@/lib/recording-store';
import type { RunActivity } from '@/lib/types';

// My recorded runs (D79), newest first, and the way to record another. A run saved
// without signal shows here as waiting, and goes up when this screen opens with a
// connection.
export default function ActivitiesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<RunActivity[] | null>(null);
  const [total, setTotal] = useState(0);
  const [waiting, setWaiting] = useState(() => listPending().length);

  const load = useCallback(async () => {
    try {
      const sent = await flushPending();
      setWaiting(sent.waiting);
      const data = await api<{ items: RunActivity[]; total: number }>('/me/activities?limit=50');
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setWaiting(listPending().length);
      setItems((prev) => prev ?? []);
      Alert.alert('Could not load your runs', errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const km = (items ?? []).reduce((sum, a) => sum + a.distanceM, 0);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <CardHeader>
            <CardTitle>My runs</CardTitle>
            <CardDescription>
              {items ? `${total} recorded · ${formatDistance(km)} km${total > items.length ? ' in the latest ' + items.length : ''}` : 'Loading'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" testID="record-new" onPress={() => router.push('/record' as never)}>
              <Play size={18} color={theme.onPrimary} />
              <ThemedText style={[styles.startText, { color: theme.onPrimary }]}>Record a run</ThemedText>
            </Button>
          </CardContent>
        </Card>

        {waiting > 0 && (
          <Card>
            <CardContent>
              <ThemedText testID="activities-waiting" style={styles.sm}>
                {waiting} {waiting === 1 ? 'run is' : 'runs are'} saved on your phone and will go up when you are online.
              </ThemedText>
            </CardContent>
          </Card>
        )}

        {items === null ? (
          <Skeleton />
        ) : items.length === 0 ? (
          <Card>
            <CardContent>
              <ThemedText themeColor="textSecondary" style={styles.sm}>No runs yet. Your first one will show up here.</ThemedText>
            </CardContent>
          </Card>
        ) : (
          items.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              testID={`activity-${a.id}`}
              onPress={() => router.push(`/activities/${a.id}` as never)}>
              <Card>
                <View style={styles.row}>
                  <RoutePreview points={a.preview} />
                  <View style={styles.info}>
                    <ThemedText numberOfLines={1} style={styles.title}>{a.title ?? kindLabel[a.kind]}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      {formatDate(a.startedAt)} · {kindLabel[a.kind]} · {audienceLabel[a.audience]}
                    </ThemedText>
                    <View style={styles.figures}>
                      <ThemedText style={styles.figure}>{formatDistance(a.distanceM)} km</ThemedText>
                      <ThemedText style={styles.figure}>{formatDuration(a.movingTimeS)}</ThemedText>
                      <ThemedText style={styles.figure}>{formatPace(a.avgPaceSPerKm)} /km</ThemedText>
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 12, paddingVertical: 16, paddingBottom: 48 },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  startText: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, padding: 12 },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  figures: { flexDirection: 'row', gap: 12, marginTop: 2 },
  figure: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
