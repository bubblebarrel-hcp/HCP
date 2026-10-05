import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { RunCard } from '@/components/runs/run-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatRunWhen } from '@/lib/runs';
import type { Page, RunNeedingHare, RunSummary } from '@/lib/types';

// Upcoming / past (/ drafts for planners) run lists and the dates still needing a
// hare, as the web draws them (components/runs/RunList.tsx, HareWanted.tsx).

type Scope = 'upcoming' | 'past' | 'drafts';

const SCOPES: { value: Scope; label: string; empty: string }[] = [
  { value: 'upcoming', label: 'Upcoming', empty: 'No upcoming runs you can see yet.' },
  { value: 'past', label: 'Past', empty: 'No past runs yet.' },
  { value: 'drafts', label: 'Drafts', empty: 'No draft runs.' },
];

async function fetchRuns(path: string, scope: Scope, page: number) {
  return api<Page<RunSummary>>(`${path}?scope=${scope}&page=${page}&limit=20`);
}

// The dates a kennel has set and nobody is haring yet (D44). Readable signed out
// on purpose: a hasher weighing up a kennel should be able to see it needs hares.
export function HareWanted({ kennelSlug, title = 'Runs looking for a hare' }: { kennelSlug?: string; title?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [runs, setRuns] = useState<RunNeedingHare[] | null>(null);

  useEffect(() => {
    let alive = true;
    const query = `limit=8${kennelSlug ? `&kennelSlug=${encodeURIComponent(kennelSlug)}` : ''}`;
    api<Page<RunNeedingHare>>(`/runs/needing-hares?${query}`)
      .then((page) => alive && setRuns(page.items))
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [kennelSlug]);

  if (!runs || runs.length === 0) return null;

  return (
    <Card>
      <View testID="hare-wanted">
        <CardHeader style={styles.hareHeader}>
          <View style={styles.titleRow}>
            <Footprints size={20} color={theme.text} />
            <CardTitle>{title}</CardTitle>
          </View>
          <CardDescription>Pick one that suits you. The mismanagement answers.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.map((run, index) => (
            <Pressable
              key={run.id}
              accessibilityRole="link"
              onPress={() => router.push(`/run/${run.id}`)}
              style={[
                styles.hareRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                index === 0 && { paddingTop: 0 },
                index === runs.length - 1 && { paddingBottom: 0 },
              ]}>
              <ThemedText style={styles.hareName}>{run.runNumber ? `Run #${run.runNumber}` : 'A run'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.hareWhen}>
                {formatRunWhen(run.startsAt, run.timeZone)}
                {!kennelSlug && run.kennel ? ` · ${run.kennel.shortName}` : ''}
              </ThemedText>
              {run.offerCount > 0 && (
                <View style={[styles.offers, { backgroundColor: theme.accent }]}>
                  <ThemedText style={styles.offersText}>
                    {run.offerCount} {run.offerCount === 1 ? 'offer' : 'offers'} in
                  </ThemedText>
                </View>
              )}
            </Pressable>
          ))}
        </CardContent>
      </View>
    </Card>
  );
}

export function RunList({
  path,
  allowDrafts = false,
  showKennel = true,
  onMeta,
}: {
  path: string;
  allowDrafts?: boolean;
  showKennel?: boolean;
  onMeta?: (data: Page<RunSummary>) => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [data, setData] = useState<Page<RunSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchRuns(path, scope, 1);
      setData(next);
      setError(null);
      onMeta?.(next);
    } catch (err) {
      setError(errorMessage(err, 'Could not load runs'));
    }
  }, [path, scope, onMeta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, user]);

  async function loadMore() {
    if (!data) return;
    setLoadingMore(true);
    try {
      const next = await fetchRuns(path, scope, data.page + 1);
      setData({ ...next, items: [...data.items, ...next.items] });
    } catch (err) {
      setError(errorMessage(err, 'Could not load more runs'));
    } finally {
      setLoadingMore(false);
    }
  }

  const visible = SCOPES.filter((s) => s.value !== 'drafts' || allowDrafts);
  const current = SCOPES.find((s) => s.value === scope) ?? SCOPES[0];

  return (
    <View>
      {/* nav: flex overflow-x-auto border-y bg-card px-2; each tab min-h-11 px-4 py-3 */}
      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {visible.map((s) => {
          const active = s.value === scope;
          return (
            <Pressable
              key={s.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`runs-tab-${s.value}`}
              onPress={() => {
                if (active) return;
                setScope(s.value);
                setData(null);
                setError(null);
              }}
              style={styles.tab}>
              <ThemedText style={[styles.tabText, { color: active ? theme.primaryStrong : theme.textSecondary }]}>{s.label}</ThemedText>
              {active && <View style={[styles.tabBar, { backgroundColor: theme.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {error ? (
          <Card style={styles.errorCard}>
            <ThemedText style={styles.bold}>{error}</ThemedText>
            <Button
              variant="outline"
              style={styles.retry}
              onPress={() => {
                setError(null);
                setData(null);
                void load();
              }}>
              Try again
            </Button>
          </Card>
        ) : !data ? (
          <View style={styles.skeletons}>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </View>
        ) : data.items.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]} testID="runs-empty">
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>{current.empty}</ThemedText>
          </View>
        ) : (
          <View style={styles.items} testID="run-list">
            {data.items.map((run) => (
              <RunCard key={run.id} run={run} showKennel={showKennel} />
            ))}
          </View>
        )}
      </View>

      {data && data.items.length < data.total && (
        <View style={styles.more}>
          <Button variant="outline" disabled={loadingMore} onPress={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Show more runs'}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hareHeader: { paddingBottom: 12 },
  hareRow: { paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8, rowGap: 4 },
  hareName: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  hareWhen: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  offers: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  offersText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: '#171717' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  tabBar: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderRadius: 999 },
  list: { marginTop: 16 },
  items: { gap: 12 },
  skeletons: { gap: 12 },
  errorCard: { padding: 32, alignItems: 'center' },
  bold: { fontWeight: '600' },
  retry: { marginTop: 16 },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  more: { marginTop: 16, alignItems: 'center' },
});
