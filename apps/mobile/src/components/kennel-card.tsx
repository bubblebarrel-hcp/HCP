import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { verificationLabels } from '@/lib/format';
import type { PublicKennel } from '@/lib/types';

export function KennelCard({ kennel }: { kennel: PublicKennel }) {
  const theme = useTheme();
  const router = useRouter();
  const verified = verificationLabels[kennel.verificationLevel];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/kennels/${kennel.slug}`)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold" style={styles.cardTitle}>{kennel.shortName}</ThemedText>
        {verified && (
          <ThemedText type="small" style={[styles.badge, { color: theme.primaryStrong, borderColor: theme.primary }]}>
            {verified}
          </ThemedText>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {kennel.city}, {kennel.country}
        {kennel.meetingDay ? ` · ${kennel.meetingDay}s` : ''}
      </ThemedText>
      {kennel.motto && <ThemedText type="small" style={styles.motto}>“{kennel.motto}”</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">
        {kennel.activeMemberCount} active {kennel.activeMemberCount === 1 ? 'member' : 'members'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 18, lineHeight: 24, flexShrink: 1 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two, fontSize: 12, lineHeight: 18 },
  motto: { fontStyle: 'italic' },
});
