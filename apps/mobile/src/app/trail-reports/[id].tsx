import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EngagementBar } from '@/components/social/engagement-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import { formatDate, formatRunDate, reportStatusLabel } from '@/lib/format';
import { EMPTY_ENGAGEMENT } from '@/lib/reactions';
import type { TrailReport } from '@/lib/types';

// A trail report, read on a phone (web app/reports/[id]/ReportDetailPage.tsx,
// reader branch). Writing, review and publishing are desk work and stay on the
// web (D29): a Scribe gets a link out rather than an editor.
export default function TrailReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [report, setReport] = useState<TrailReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    api<{ report: TrailReport }>(`/reports/${id}`)
      .then((data) => alive && setReport(data.report))
      .catch((err) => alive && setError(errorMessage(err, 'Trail Report not found')));
    return () => {
      alive = false;
    };
  }, [id, authLoading]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={[]}>
        <ScrollView contentContainerStyle={styles.page}>
          {error ? (
            <Card style={styles.notFound}>
              <ThemedText style={styles.bold}>{error}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Drafts are private to the Scribe and their reviewers until they are published.
              </ThemedText>
              <Button variant="outline" onPress={() => router.replace('/trail-reports' as never)} style={styles.back}>
                Back to trail reports
              </Button>
            </Card>
          ) : !report ? (
            <Skeleton height={384} />
          ) : (
            <Card>
              <CardHeader style={styles.headerPad}>
                <View style={styles.statusRow}>
                  <Badge tone={report.status === 'PUBLISHED' ? 'primary' : report.status === 'REVIEW' ? 'accent' : 'plain'}>
                    {reportStatusLabel[report.status]}
                  </Badge>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${report.runId}`)}>
                    <ThemedText type="smallBold">
                      #{report.run.runNumber} · {report.run.kennel.shortName}
                    </ThemedText>
                  </Pressable>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.light}>
                    {formatRunDate(report.run.startsAt, report.run.timeZone)}
                  </ThemedText>
                </View>
                <CardTitle style={styles.reportTitle}>{report.title}</CardTitle>
                <CardDescription>
                  Scribe: {report.scribe}
                  {report.reviewers.length > 0 && ` · Reviewers: ${report.reviewers.join(', ')}`}
                  {report.publishedAt && ` · Published ${formatDate(report.publishedAt)}`}
                </CardDescription>
              </CardHeader>

              {report.run.posterUrl ? (
                <Image
                  source={{ uri: report.run.posterUrl }}
                  style={[styles.poster, { backgroundColor: theme.backgroundElement }]}
                  resizeMode="contain"
                  accessibilityLabel={`Flyer for ${report.run.kennel.shortName} run #${report.run.runNumber}`}
                />
              ) : null}

              <CardContent style={styles.article}>
                {(report.body ?? '').split(/\n{2,}/).map((para, i) => (
                  <ThemedText key={i} style={styles.para}>
                    {para}
                  </ThemedText>
                ))}
                {report.citation && (
                  <ThemedText type="small" themeColor="textSecondary" style={[styles.citation, { borderTopColor: theme.border }]}>
                    {report.citation}
                  </ThemedText>
                )}
                {report.viewer.canEdit && (
                  <Button variant="outline" onPress={() => Linking.openURL(`${WEB_URL}/reports/${report.id}`)}>
                    Edit this report on the web
                  </Button>
                )}
              </CardContent>

              <EngagementBar segment="reports" id={report.id} initial={EMPTY_ENGAGEMENT} authorId={null} />
            </Card>
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
  notFound: { padding: 32, alignItems: 'center', gap: 4 },
  bold: { fontWeight: '600' },
  center: { textAlign: 'center' },
  back: { marginTop: 16 },
  headerPad: { paddingBottom: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  light: { fontWeight: '400' },
  reportTitle: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  poster: { width: '100%', height: 360 },
  article: { gap: 16, paddingTop: 16 },
  para: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  citation: { borderTopWidth: 1, paddingTop: 16, fontWeight: '400' },
});
