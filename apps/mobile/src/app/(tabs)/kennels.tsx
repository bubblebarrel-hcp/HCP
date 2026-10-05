import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KennelCard } from '@/components/kennel-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import type { Page, PublicKennel } from '@/lib/types';

// Find a kennel, as the web app lays it out on a phone (app/kennels/page.tsx):
// a header card with the count, a search box and "Start a kennel", then the
// kennels twelve to a page with Previous / Next underneath. The web's map card
// has no native twin yet.

const PAGE_SIZE = 12;

export default function KennelsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  // The term that was actually searched: web submits a form rather than
  // searching on every keystroke.
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<PublicKennel> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), ...(q ? { q } : {}) });
      setData(await api<Page<PublicKennel>>(`/kennels?${params}`));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load kennels'));
    }
  }, [page, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  function search() {
    setData(null);
    setPage(1);
    setQ(draft.trim());
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={[]}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.primary}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
            />
          }>
          <Card style={styles.intro}>
            <View>
              <ThemedText accessibilityRole="header" style={styles.h1}>Find a kennel</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.lead}>
                {data?.total ?? 0} {data?.total === 1 ? 'kennel' : 'kennels'} welcoming hashers and visitors.
              </ThemedText>
            </View>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="Search kennels"
                placeholder="Name or city"
                placeholderTextColor={theme.textSecondary}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={search}
                returnKeyType="search"
                autoCorrect={false}
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />
              <Button variant="outline" onPress={search}>Search</Button>
            </View>
            {user && (
              <Button variant="outline" onPress={() => Linking.openURL(`${WEB_URL}/kennels/new`)} testID="start-kennel" style={styles.start}>
                <Plus size={16} color={theme.text} />
                <ThemedText style={[styles.startText]}>Start a kennel</ThemedText>
              </Button>
            )}
          </Card>

          {error ? (
            <Card style={styles.errorCard}>
              <ThemedText style={styles.bold}>{error}</ThemedText>
              <Button variant="outline" style={styles.retry} onPress={() => { setError(null); void load(); }}>
                Try again
              </Button>
            </Card>
          ) : !data ? (
            <Skeleton height={160} />
          ) : data.items.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No kennels match{q ? ` “${q}”` : ''} yet.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.list} testID="kennel-list">
              {data.items.map((k) => (
                <KennelCard key={k.id} kennel={k} />
              ))}
            </View>
          )}

          {totalPages > 1 && (
            <View style={styles.pager} accessibilityLabel="Pagination">
              {page > 1 && (
                <Button variant="outline" size="sm" onPress={() => { setData(null); setPage(page - 1); }}>
                  Previous
                </Button>
              )}
              <ThemedText themeColor="textSecondary" style={styles.pageText}>
                Page {page} of {totalPages}
              </ThemedText>
              {page < totalPages && (
                <Button variant="outline" size="sm" onPress={() => { setData(null); setPage(page + 1); }}>
                  Next
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  // mb-4 flex flex-col gap-4 rounded-none border-x-0 p-5
  intro: { padding: 20, gap: 16 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 14 },
  start: { alignSelf: 'flex-start' },
  startText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  list: { gap: 16 },
  errorCard: { padding: 32, alignItems: 'center' },
  bold: { fontWeight: '600' },
  retry: { marginTop: 16 },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  pageText: { paddingHorizontal: 8, fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
