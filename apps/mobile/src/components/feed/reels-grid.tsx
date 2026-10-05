import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Video } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { brandColor } from '@/lib/format';
import type { Reel } from '@/lib/types';

// The list of reels on /reels and under a hashtag (web components/feed/ReelsGrid.tsx):
// two across with 12pt between, each a rounded bordered card with a 3:4 cover, the
// author, how many are in it, the caption and the kennel.
export function ReelsGrid({ reels, emptyText }: { reels: Reel[]; emptyText?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const card = (Math.min(width, MaxContentWidth) - 32 - 12) / 2;

  if (reels.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]} testID="reels-empty">
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {emptyText ?? 'No public reels yet. Sign in and follow hashers to fill this with theirs.'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.grid} testID="reels-grid">
      {reels.map((reel) => {
        const first = reel.items[0];
        const cover = first?.kind === 'PHOTO' ? first.url : (first?.posterUrl ?? null);
        return (
          <Pressable
            key={reel.id}
            accessibilityRole="link"
            onPress={() => router.push(`/reels/${reel.id}`)}
            style={[styles.card, { width: card, borderColor: theme.border, backgroundColor: theme.card }]}>
            <View
              style={[
                styles.cover,
                { width: card, height: (card * 4) / 3, backgroundColor: first ? '#000000' : (brandColor(reel.kennel?.primaryColor) ?? theme.backgroundElement) },
              ]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.image} resizeMode="cover" accessibilityLabel={reel.caption ?? `Reel by ${reel.author.name}`} />
              ) : (
                <Video size={24} color={theme.textSecondary} />
              )}
            </View>
            <View style={styles.info}>
              <View style={styles.authorRow}>
                <Avatar name={reel.author.name} size={24} src={reel.author.avatarUrl} />
                <ThemedText numberOfLines={1} style={styles.author}>{reel.author.name}</ThemedText>
              </View>
              {reel.itemCount > 1 && (
                <ThemedText themeColor="textSecondary" style={styles.xs}>{reel.itemCount} in this one</ThemedText>
              )}
              {reel.caption ? (
                <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.sm}>{reel.caption}</ThemedText>
              ) : null}
              {reel.kennel ? (
                <ThemedText numberOfLines={1} style={[styles.kennel, { color: theme.primaryStrong }]}>{reel.kennel.shortName}</ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '400' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  card: { overflow: 'hidden', borderWidth: 1, borderRadius: 12 },
  cover: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  info: { padding: 12, gap: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  kennel: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
