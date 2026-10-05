import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Bookmark as BookmarkIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { setBookmarked } from '@/lib/social';
import type { Bookmark, Page, SubjectSegment } from '@/lib/types';

// What this hasher saved (D50), as the web app's /saved page lays it out.
// Private, always: a bookmark is never shown to anybody else and never told
// the author, which is the difference between saving something and applauding it.

const FILTERS: { label: string; segment?: SubjectSegment }[] = [
  { label: 'Everything' },
  { label: 'Reels', segment: 'reels' },
  { label: 'Trail reports', segment: 'reports' },
  { label: 'Photos', segment: 'photos' },
  { label: 'Runs', segment: 'runs' },
  { label: 'Capsules', segment: 'capsules' },
];

const subjectWords: Record<string, string> = {
  REEL: 'Reel',
  TRAIL_REPORT: 'Trail report',
  MEDIA_ASSET: 'Photo',
  RUN: 'Run',
  RUN_CAPSULE: 'Run Capsule',
};

export default function SavedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [segment, setSegment] = useState<SubjectSegment | undefined>();
  const [rows, setRows] = useState<Bookmark[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const page = await api<Page<Bookmark>>(`/me/bookmarks?page=1&limit=30${segment ? `&subject=${segment}` : ''}`);
      setRows(page.items);
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [segment]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [user, load]);

  async function unsave(row: Bookmark) {
    // Optimistic: the row goes now and comes back only if the API refuses.
    setRows((current) => current?.filter((b) => b.id !== row.id) ?? null);
    try {
      await setBookmarked(row.subjectSegment, row.subjectId, false);
    } catch {
      void load();
    }
  }

  function open(row: Bookmark) {
    const id = row.subjectId;
    switch (row.subjectSegment) {
      case 'reels':
        return router.push(`/reels/${id}`);
      case 'posts':
        return router.push(`/posts/${id}`);
      case 'reports':
        return router.push(`/trail-reports/${id}` as never);
      case 'runs':
        return router.push(`/run/${id}`);
      default:
        return undefined;
    }
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <ThemedText accessibilityRole="header" style={styles.h1}>Saved</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lead}>
            Only you can see this. Saving something never tells the hasher who made it.
          </ThemedText>

          <View style={styles.filters}>
            {FILTERS.map((filter) => {
              const active = segment === filter.segment;
              return (
                <Pressable
                  key={filter.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSegment(filter.segment)}
                  style={[
                    styles.pill,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary + '1a' : 'transparent',
                    },
                  ]}>
                  <ThemedText style={[styles.pillText, { color: active ? theme.primaryStrong : theme.text, fontWeight: active ? '500' : '400' }]}>
                    {filter.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.list}>
            {busy && rows === null ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.sm}>Loading…</ThemedText>
              </View>
            ) : (rows?.length ?? 0) === 0 ? (
              <Card bleed={false} style={[styles.empty, { borderStyle: 'dashed' }]}>
                <BookmarkIcon size={32} color={theme.textSecondary} />
                <ThemedText style={styles.emptyTitle}>Nothing saved yet.</ThemedText>
                <ThemedText themeColor="textSecondary" style={[styles.sm, styles.center]}>
                  The bookmark on any card puts it here.{' '}
                  <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={() => router.push('/')}>
                    Back to the feed
                  </ThemedText>
                  .
                </ThemedText>
              </Card>
            ) : (
              rows?.map((row) => (
                <Card key={row.id} bleed={false} style={styles.row} >
                  <View style={styles.rowMain}>
                    <ThemedText themeColor="textSecondary" style={styles.kind}>
                      {`${(subjectWords[row.subjectType] ?? 'Post').toUpperCase()} · SAVED ${formatDate(row.savedAt).toUpperCase()}`}
                    </ThemedText>
                    {row.available && row.href ? (
                      <Pressable accessibilityRole="link" onPress={() => open(row)}>
                        <ThemedText style={styles.label}>{row.label}</ThemedText>
                      </Pressable>
                    ) : (
                      // Kept so it can be unsaved, but it says nothing about
                      // what it was: it may have gone private, not just away.
                      <ThemedText themeColor="textSecondary" style={styles.label}>No longer available to you</ThemedText>
                    )}
                    {row.note ? <ThemedText themeColor="textSecondary" style={[styles.sm, styles.note]}>{row.note}</ThemedText> : null}
                  </View>
                  <Button variant="ghost" size="sm" testID="saved-remove" onPress={() => void unsave(row)}>
                    Remove
                  </Button>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
  h1: { paddingHorizontal: 16, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  lead: { marginTop: 4, paddingHorizontal: 16, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  filters: { marginTop: 16, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  pillText: { fontSize: 14, lineHeight: 20 },
  list: { marginTop: 16, gap: 8 },
  loading: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  center: { textAlign: 'center' },
  empty: { padding: 40, alignItems: 'center', gap: 4, marginHorizontal: 0, borderRadius: 12 },
  emptyTitle: { marginTop: 8, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginHorizontal: 0, borderRadius: 12 },
  rowMain: { flex: 1, minWidth: 0 },
  kind: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.6 },
  label: { marginTop: 2, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  note: { marginTop: 4 },
});
