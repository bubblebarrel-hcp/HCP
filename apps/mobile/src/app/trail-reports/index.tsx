import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDate, formatRunDate, reportStatusLabel } from '@/lib/format';
import type { Page, TrailReport } from '@/lib/types';

// The trail reports archive, as the web app's phone view lays it out
// (app/reports/page.tsx): a header card, then one bleed card per report.
// A report is listed to whoever could see its run, so a visitor sees the
// public ones (D29).
export default function TrailReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<TrailReport[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await api<Page<TrailReport>>('/reports');
      setItems(page.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={[]}>
        <ScrollView
          contentContainerStyle={styles.page}
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
          <Card>
            <CardHeader>
              <View style={styles.titleRow}>
                <BookOpen size={20} color={theme.text} />
                <CardTitle>Trail reports</CardTitle>
              </View>
              <CardDescription>What the pack did, written down by the people who were there.</CardDescription>
            </CardHeader>
          </Card>

          {items === null && <Skeleton />}

          {items?.length === 0 && (
            <Card style={styles.empty}>
              <ThemedText style={styles.emptyTitle}>No trail reports yet.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                After a run reaches reporting, its Scribe writes it up here.
              </ThemedText>
            </Card>
          )}

          {items?.map((report) => (
            <Card key={report.id}>
              <CardContent style={styles.row}>
                <View style={styles.kennelRow}>
                  <Avatar name={report.run.kennel.shortName} size={32} />
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${report.run.kennel.slug}`)}>
                    <ThemedText type="smallBold">{report.run.kennel.name}</ThemedText>
                  </Pressable>
                  {report.status === 'ARCHIVED' && <Badge tone="muted">{reportStatusLabel[report.status]}</Badge>}
                </View>
                <Pressable
                  accessibilityRole="link"
                  testID="report-link"
                  onPress={() => router.push(`/trail-reports/${report.id}` as never)}>
                  <ThemedText style={styles.reportTitle}>
                    #{report.run.runNumber} · {report.title}
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                  {formatRunDate(report.run.startsAt, report.run.timeZone)} · Written by {report.scribe}
                  {report.publishedAt && ` · Published ${formatDate(report.publishedAt)}`}
                </ThemedText>
              </CardContent>
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontWeight: '600' },
  emptyText: { marginTop: 4, textAlign: 'center' },
  row: { padding: 20, paddingTop: 20, gap: 8 },
  kennelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  reportTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  meta: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
