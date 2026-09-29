import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/feed/app-header';
import { Composer, WelcomeCard } from '@/components/feed/composer';
import { FeedCard } from '@/components/feed/feed-card';
import { KennelStrip } from '@/components/feed/kennel-strip';
import { PullToRefresh } from '@/components/feed/pull-to-refresh';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { FeedEntry, FeedScope, Page, PublicKennel } from '@/lib/types';

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'FOLLOWING', label: 'Following' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [scope, setScope] = useState<FeedScope>('ALL');
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [kennels, setKennels] = useState<PublicKennel[]>([]);
  const [loading, setLoading] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A ref rather than `kennels.length` in the deps: the strip is fetched once
  // and reused across every scope switch and refresh, not refetched with the feed.
  const kennelsLoaded = useRef(false);

  const load = useCallback(async (nextScope: FeedScope) => {
    setError(null);
    try {
      const [feed, kennelPage] = await Promise.all([
        api<Page<FeedEntry>>(`/feed?limit=20&scope=${nextScope}`),
        kennelsLoaded.current ? Promise.resolve(null) : api<Page<PublicKennel>>('/kennels?limit=20'),
      ]);
      setItems(feed.items);
      if (kennelPage) {
        kennelsLoaded.current = true;
        setKennels(kennelPage.items);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not load the feed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(scope);
  }, [load, scope, user]);

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.card }]} edges={['top']}>
        <AppHeader onSearch={() => router.push('/kennels')} />

        {user && (
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {SCOPES.map((s) => (
              <Pressable
                key={s.value}
                accessibilityRole="button"
                accessibilityState={{ selected: scope === s.value }}
                onPress={() => setScope(s.value)}
                style={[styles.segmentItem, scope === s.value && { backgroundColor: theme.card }]}>
                <ThemedText type="smallBold" themeColor={scope === s.value ? 'text' : 'textSecondary'}>{s.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.flex, { backgroundColor: theme.canvas }]}>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={styles.center} />
          ) : error ? (
            <View style={styles.center}>
              <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setLoading(true); load(scope).finally(() => setLoading(false)); }}
                style={styles.retry}>
                <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Try again</ThemedText>
              </Pressable>
            </View>
          ) : (
            <PullToRefresh atTop={atTop} onRefresh={() => load(scope)}>
              <FlatList
                onScroll={(event) => setAtTop(event.nativeEvent.contentOffset.y <= 2)}
                scrollEventThrottle={16}
                data={items}
                keyExtractor={(item) => `${item.kind}-${item.id}`}
                renderItem={({ item }) => <FeedCard item={item} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListHeaderComponent={
                  <View style={styles.headerStack}>
                    {user ? <Composer name={user.displayName} onPosted={() => load(scope)} /> : <WelcomeCard onLogin={() => router.push('/account')} />}
                    {kennels.length > 0 && (
                      <View style={{ backgroundColor: theme.card }}>
                        <KennelStrip kennels={kennels} />
                      </View>
                    )}
                  </View>
                }
                ListEmptyComponent={
                  <ThemedText themeColor="textSecondary" style={styles.empty}>
                    {scope === 'FOLLOWING' ? 'Follow a hasher or kennel to see their trail here.' : 'Nothing on trail yet.'}
                  </ThemedText>
                }
                contentContainerStyle={styles.list}
              />
            </PullToRefresh>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  segment: { flexDirection: 'row', gap: Spacing.one, padding: Spacing.one, marginHorizontal: Spacing.three, marginBottom: Spacing.two, borderRadius: Spacing.three },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Spacing.two },
  headerStack: { gap: Spacing.two, marginBottom: Spacing.two },
  separator: { height: Spacing.two },
  list: { paddingBottom: BottomTabInset + Spacing.four, paddingHorizontal: Spacing.two },
  empty: { textAlign: 'center', padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
