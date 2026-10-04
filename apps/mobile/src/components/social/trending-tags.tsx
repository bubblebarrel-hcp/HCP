import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// What hashers have been tagging this week (D59). Counts are of public posts and
// reels only. Renders nothing until there is something to show.
export function TrendingTags() {
  const theme = useTheme();
  const router = useRouter();
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    let alive = true;
    api<{ items: { tag: string; count: number }[] }>('/tags/trending?limit=8')
      .then((data) => alive && setTags(data.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (tags.length === 0) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: theme.card }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>Trending on trail</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tags.map(({ tag, count }) => (
          <Pressable
            key={tag}
            accessibilityRole="link"
            accessibilityLabel={`#${tag}, ${count} tagged this week`}
            onPress={() => router.push(`/tags/${encodeURIComponent(tag)}`)}
            style={[styles.chip, { borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>#{tag}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{count}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: Spacing.two },
  heading: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
  row: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 36, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: 18 },
});
