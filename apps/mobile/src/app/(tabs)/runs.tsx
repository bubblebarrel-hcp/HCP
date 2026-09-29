import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { Page, RunSummary } from '@/lib/types';

// Runs on a phone: see what is coming, then push into the full run for RSVP,
// check-in and everything else. The desk work (planning, trails, reports)
// stays on the web.

function runWhen(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export default function RunsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Page<RunSummary>>('/runs?scope=upcoming&limit=50');
      setRuns(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load runs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, user]);

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.heading} accessibilityRole="header">
            Runs
          </ThemedText>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={styles.center} />
        ) : error ? (
          <View style={styles.center}>
            <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                load().finally(() => setLoading(false));
              }}
              style={styles.retry}>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
                Try again
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={runs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load().finally(() => setRefreshing(false));
                }}
                tintColor={theme.primary}
              />
            }
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.center}>
                No runs coming up. Join a kennel to see theirs.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/run/${item.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
                  {item.kennel.shortName}
                </ThemedText>
                <ThemedText type="subtitle">
                  #{item.runNumber} · {item.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary">{runWhen(item.startsAt, item.timeZone)}</ThemedText>
                {item.meetingPointName ? (
                  <ThemedText themeColor="textSecondary">{item.meetingPointName}</ThemedText>
                ) : null}
                <ThemedText themeColor="textSecondary">{item.goingCount} going</ThemedText>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  heading: { fontSize: 24, fontWeight: '800' },
  center: { padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two },
  list: { padding: Spacing.two, gap: Spacing.two, paddingBottom: BottomTabInset, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: 2, minHeight: 44 },
});
