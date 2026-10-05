import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/web-ui';
import { verificationLabels } from '@/lib/format';
import type { PublicKennel } from '@/lib/types';

// The kennel card from the web app (components/KennelCard.tsx): the short name
// and, once verified, a soft-primary badge; city, country and meeting day; the
// motto, three lines of description and the active member count.
export function KennelCard({ kennel }: { kennel: PublicKennel }) {
  const router = useRouter();
  const verified = verificationLabels[kennel.verificationLevel];
  return (
    <Pressable
      accessibilityRole="button"
      testID="kennel-card"
      onPress={() => router.push(`/kennels/${kennel.slug}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card>
        <CardHeader>
          <View style={styles.titleRow}>
            <CardTitle style={styles.title}>{kennel.shortName}</CardTitle>
            {verified && <Badge tone="soft-primary">{verified}</Badge>}
          </View>
          <CardDescription>
            {kennel.city}, {kennel.country}
            {kennel.meetingDay ? ` · ${kennel.meetingDay}s` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.content}>
          {kennel.motto ? <ThemedText style={styles.motto}>“{kennel.motto}”</ThemedText> : null}
          <ThemedText themeColor="textSecondary" numberOfLines={3} style={styles.small}>
            {kennel.description}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.xs}>
            {kennel.activeMemberCount} active {kennel.activeMemberCount === 1 ? 'member' : 'members'}
          </ThemedText>
        </CardContent>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  content: { gap: 12 },
  motto: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', fontWeight: '400' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
});
