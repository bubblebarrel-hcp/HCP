import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { KennelCard } from '@/components/kennel-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { Page, PublicKennel } from '@/lib/types';

export default function KennelsScreen() {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [kennels, setKennels] = useState<PublicKennel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100', ...(query.trim() ? { q: query.trim() } : {}) });
      const data = await api<Page<PublicKennel>>(`/kennels?${params}`);
      setKennels(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load kennels'));
    }
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      load(q).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.heading} accessibilityRole="header">Kennels</ThemedText>
          <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} color={theme.textSecondary} />
            <TextInput
              accessibilityLabel="Search kennels"
              placeholder="Search by name or city"
              placeholderTextColor={theme.textSecondary}
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={styles.center} />
        ) : error ? (
          <View style={styles.center}>
            <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => { setLoading(true); load(q).finally(() => setLoading(false)); }}
              style={styles.retry}>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Try again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={kennels}
            keyExtractor={(k) => k.id}
            renderItem={({ item }) => <KennelCard kennel={item} />}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {q.trim() ? `No kennels match “${q.trim()}” yet.` : 'No kennels yet.'}
              </ThemedText>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={theme.primary}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load(q);
                  setRefreshing(false);
                }}
              />
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.two },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  list: { gap: Spacing.two, padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  empty: { textAlign: 'center', padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retry: { padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
