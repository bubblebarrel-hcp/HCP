import { Pressable, StyleSheet, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, formatRunDay, runHeading, runStatusLabel, runTypeLabel, runVisibilityLabel } from '@/lib/runs';
import type { RunStatus, RunSummary } from '@/lib/types';

// One run in a list, as the web app draws it (components/runs/RunCard.tsx): a
// 56x64 date block, the title with its badges, time and place, lead hare, how
// many are going.

function statusTone(status: RunStatus) {
  if (status === 'LIVE' || status === 'CHECK_IN_OPEN' || status === 'CIRCLE') return 'soft-primary' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'DRAFT') return 'soft-accent' as const;
  if (status === 'ARCHIVED' || status === 'REPORTING') return 'muted' as const;
  return 'plain' as const;
}

export function RunCard({
  run,
  showKennel = true,
  variant = 'card',
}: {
  run: RunSummary;
  showKennel?: boolean;
  // 'row' is the bordered, rounded box used inside another card (web variant="row").
  variant?: 'card' | 'row';
}) {
  const theme = useTheme();
  const router = useRouter();
  const day = formatRunDay(run.startsAt, run.timeZone);
  const lead = run.hares?.find((h) => h.isLead) ?? run.hares?.[0];
  const cancelled = run.status === 'CANCELLED';

  const body = (
      <View style={styles.body}>
        <View
          accessibilityElementsHidden
          style={[styles.date, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, cancelled && { opacity: 0.6 }]}>
          <ThemedText style={[styles.month, { color: theme.primaryStrong }]}>{day.month}</ThemedText>
          <ThemedText style={styles.day}>{day.day}</ThemedText>
        </View>
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Pressable accessibilityRole="link" testID="run-card-link" onPress={() => router.push(`/run/${run.id}`)}>
              <ThemedText style={[styles.title, cancelled && styles.struck]}>{runHeading(run)}</ThemedText>
            </Pressable>
            {run.status !== 'SCHEDULED' && <Badge tone={statusTone(run.status)}>{runStatusLabel[run.status]}</Badge>}
            {run.visibility && run.visibility !== 'PUBLIC' && <Badge>{runVisibilityLabel[run.visibility]}</Badge>}
            {run.runType && run.runType !== 'REGULAR' && <Badge>{runTypeLabel[run.runType]}</Badge>}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.sub}>
            {showKennel && `${run.kennel.shortName} · `}
            {formatClock(run.startsAt, run.timeZone)}
            {run.meetingPointName ? ` · ${run.meetingPointName}` : ''}
          </ThemedText>
          <View style={styles.metaRow}>
            {lead && (
              <ThemedText themeColor="textSecondary" style={styles.sub}>
                Hare: {lead.displayName}
                {run.hares && run.hares.length > 1 && ` +${run.hares.length - 1}`}
              </ThemedText>
            )}
            <View style={styles.going}>
              <Users size={14} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.sub}>
                {run.goingCount} going{run.capacity ? ` of ${run.capacity}` : ''}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
  );

  if (variant === 'row') {
    return (
      <View testID="run-card" style={[styles.row, { borderColor: theme.border }]}>
        {body}
      </View>
    );
  }
  return (
    <Card style={styles.card}>
      <View testID="run-card">{body}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  row: { borderWidth: 1, borderRadius: 8, padding: 12 },
  body: { flexDirection: 'row', gap: 16 },
  date: { width: 56, height: 64, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  day: { fontSize: 24, lineHeight: 24, fontWeight: '700' },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  struck: { textDecorationLine: 'line-through' },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, marginTop: 4 },
  going: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
