import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { HareWanted, RunList } from '@/components/runs/run-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { WEB_URL } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import type { Page, RunSummary } from '@/lib/types';

// A kennel's runs, as the web lays it out (app/kennels/[slug]/runs/page.tsx): a
// header card with the way back and, for a planner, "Plan a run"; the dates that
// need a hare; then the list.
type KennelRunsPage = Page<RunSummary> & { kennel?: { name: string }; canPlan?: boolean };

export default function KennelRunsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [meta, setMeta] = useState<KennelRunsPage | null>(null);
  const onMeta = useCallback((data: Page<RunSummary>) => setMeta(data as KennelRunsPage), []);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <Card style={styles.intro}>
            <View style={styles.introMain}>
              <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.backLink}>
                <ArrowLeft size={16} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.backText}>{meta?.kennel?.name ?? 'Back to kennel'}</ThemedText>
              </Pressable>
              <ThemedText accessibilityRole="header" style={styles.h1}>Runs</ThemedText>
            </View>
            {meta?.canPlan && (
              <Button testID="plan-run" onPress={() => Linking.openURL(`${WEB_URL}/kennels/${slug}/runs/new`)}>
                <Plus size={16} color={theme.onPrimary} />
                <ThemedText style={[styles.planText, { color: theme.onPrimary }]}>Plan a run</ThemedText>
              </Button>
            )}
          </Card>
          <HareWanted kennelSlug={slug} />
          <RunList
            path={`/kennels/${encodeURIComponent(slug)}/runs`}
            allowDrafts={meta?.canPlan ?? false}
            showKennel={false}
            onMeta={onMeta}
          />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  intro: { padding: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  introMain: { flexShrink: 1 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  planText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
