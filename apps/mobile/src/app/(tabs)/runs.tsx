import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HareWanted, RunList } from '@/components/runs/run-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Runs page as the web app lays it out on a phone (app/runs/page.tsx): a
// header card, the dates still needing a hare, then the Upcoming / Past list.
export default function RunsScreen() {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  // Remounting the sections is the simplest honest "reload everything".
  const [round, setRound] = useState(0);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setRound((n) => n + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={[]}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.primary} onRefresh={refresh} />}>
          <Card style={styles.intro}>
            <ThemedText accessibilityRole="header" style={styles.h1}>Runs</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lead}>
              Runs you can join, from every kennel you can see. Visitors welcome where the kennel allows it.
            </ThemedText>
          </Card>
          <HareWanted key={`hare-${round}`} />
          <RunList key={`list-${round}`} path="/runs" />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  intro: { padding: 20 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400' },
});
