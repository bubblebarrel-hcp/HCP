import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer, WelcomeCard } from '@/components/feed/composer';
import { FeedCard } from '@/components/feed/feed-card';
import { PullToRefresh } from '@/components/feed/pull-to-refresh';
import { ReelStrip } from '@/components/feed/reel-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { onFeedRefresh } from '@/lib/feed-refresh';
import type { FeedEntry, FeedScope, Page } from '@/lib/types';

// Home, as the web app lays it out on a phone (app/page.tsx): the composer (or
// the welcome card), the reels strip, "Everything / Following" tabs, then the
// feed, every block running edge to edge with 16pt between them.

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: 'ALL', label: 'Everything' },
  { value: 'FOLLOWING', label: 'Following' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [scope, setScope] = useState<FeedScope>('ALL');
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every feed load so the reels strip refreshes with a pull (D46).
  const [railKey, setRailKey] = useState(0);

  const load = useCallback(async (nextScope: FeedScope) => {
    setError(null);
    try {
      const feed = await api<Page<FeedEntry>>(`/feed?limit=12&scope=${nextScope}`);
      setItems(feed.items);
      setRailKey((k) => k + 1);
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

  // Something was posted from the + in the bottom bar.
  useEffect(() => onFeedRefresh(() => void load(scope)), [load, scope]);

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.canvas }]} edges={[]}>
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
                    {user ? <Composer
                        name={user.displayName}
                        avatarUrl={user.avatarUrl}
                        avatarPosition={user.avatarPosition}
                        onPosted={() => load(scope)}
                      /> : <WelcomeCard onLogin={() => router.push('/account')} />}
                    <ReelStrip refreshKey={railKey} />
                    {user && (
                      <View
                        accessibilityRole="tablist"
                        style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {SCOPES.map((s) => {
                          const active = scope === s.value;
                          return (
                            <Pressable
                              key={s.value}
                              accessibilityRole="tab"
                              accessibilityState={{ selected: active }}
                              testID={`feed-tab-${s.value === 'ALL' ? 'all' : 'following'}`}
                              onPress={() => setScope(s.value)}
                              style={[styles.tab, { borderBottomColor: active ? theme.primary : 'transparent' }]}>
                              <ThemedText type="smallBold" style={{ color: active ? theme.primaryStrong : theme.textSecondary }}>
                                {s.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                }
                ListEmptyComponent={
                  <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <ThemedText type="smallBold" style={styles.emptyText}>
                      {scope === 'FOLLOWING' ? 'Nothing from the hashers you follow yet.' : 'Nothing has been posted yet.'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                      {scope === 'FOLLOWING'
                        ? 'Follow a few hashers and kennels and this fills up.'
                        : 'Trail reports and photos from every kennel land here. Find a kennel to hash with, and it starts filling up.'}
                    </ThemedText>
                    <Pressable accessibilityRole="link" onPress={() => router.push('/kennels')} style={styles.retry}>
                      <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Find a kennel</ThemedText>
                    </Pressable>
                  </View>
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
  // space-y-4 between every block.
  headerStack: { gap: Spacing.three, marginBottom: Spacing.three },
  separator: { height: Spacing.three },
  list: { paddingTop: Spacing.three, paddingBottom: Spacing.four },
  // flex rounded-none border-y bg-card, two equal tabs with a 2pt underline.
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center', gap: Spacing.one },
  emptyText: { textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
