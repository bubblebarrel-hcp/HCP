import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { TARGET_WORDS, type ReportTargetType } from '@/lib/moderation';

// What you have reported, and what we said back (D61), as the web has it
// (app/account/reports/page.tsx). Never who was spoken to or what was done to
// anybody: only whether it was looked at and whether we acted.
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
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<MyReport[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ items: MyReport[] }>('/me/reports')
      .then((data) => alive && setItems(data.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <Subpage back="Back to privacy" onBack={() => router.replace('/privacy')}>
      <Card bleed={false}>
        <View testID="my-reports">
          <CardHeader>
            <CardTitle style={styles.title}>My reports</CardTitle>
            <CardDescription>
              Only you can see these. The hasher you reported is never told it was you, and you are never told what was done to
              them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items === null ? (
              <View style={[styles.pulse, { backgroundColor: theme.backgroundElement }]} />
            ) : items.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm} testID="my-reports-empty">
                You have not reported anything.
              </ThemedText>
            ) : (
              items.map((r, index) => (
                <View
                  key={r.id}
                  testID="my-report"
                  style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }, index === 0 && { paddingTop: 0 }, index === items.length - 1 && { paddingBottom: 0 }]}>
                  <View style={styles.head}>
                    <ThemedText style={[styles.sm, styles.medium]}>
                      {r.reasonLabel} · {TARGET_WORDS[r.targetType]}
                    </ThemedText>
                    <Badge>{r.status === 'ACTIONED' ? 'Action taken' : r.status === 'DISMISSED' ? 'Reviewed' : 'With us'}</Badge>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>{r.outcome}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.xs}>{formatDate(r.createdAt)}</ThemedText>
                </View>
              ))
            )}
          </CardContent>
        </View>
      </Card>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 32 },
  pulse: { height: 96, borderRadius: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  medium: { fontWeight: '500' },
  row: { gap: 4, paddingVertical: 12 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
