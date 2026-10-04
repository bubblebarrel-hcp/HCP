import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { TARGET_WORDS, type ReportTargetType } from '@/lib/moderation';

// What you have reported, and what we said back (D61). Never who was spoken to or
// what was done to anybody: only whether it was looked at and whether we acted.
interface MyReport {
  id: string;
  targetType: ReportTargetType;
  reasonLabel: string;
  status: 'OPEN' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED';
  outcome: string;
  createdAt: string;
}

export default function MyReportsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ items: MyReport[] }>('/me/reports')
      .then((data) => alive && setItems(data.items))
      .catch((err) => alive && setError(errorMessage(err, 'Could not load your reports')));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ThemedView type="canvas" style={styles.flex}>
      {items === null && !error ? (
        <ActivityIndicator color={theme.primary} style={styles.center} />
      ) : error ? (
        <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
              Only you can see these. The hasher you reported is never told it was you, and you are never told what was done to them.
            </ThemedText>
          }
          ListEmptyComponent={<ThemedText themeColor="textSecondary" style={styles.empty}>You have not reported anything.</ThemedText>}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <ThemedText type="smallBold">{item.reasonLabel} · {TARGET_WORDS[item.targetType]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.status === 'ACTIONED' ? 'Action taken' : item.status === 'DISMISSED' ? 'Reviewed' : 'With us'} · {item.outcome}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{formatDate(item.createdAt)}</ThemedText>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  list: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  intro: { padding: Spacing.three },
  row: { padding: Spacing.three, gap: 2 },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', padding: Spacing.five },
});
