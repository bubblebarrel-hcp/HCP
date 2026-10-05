import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { HasherPhoto } from '@/lib/types';

// The photo grid on a hasher's page (D57), as the web draws it
// (components/profile/ProfilePhotoGrid.tsx): square tiles, three across, 2pt
// apart. Each tile opens what the picture is on: the post, the reel or the run,
// since a photo has no page of its own.
const WHERE: Record<HasherPhoto['source']['type'], string> = { POST: 'a post', REEL: 'a reel', RUN: 'a run' };

export function ProfilePhotoGrid({
  photos,
  total,
  loading,
  onMore,
  name,
}: {
  photos: HasherPhoto[];
  total: number;
  loading: boolean;
  onMore: () => void;
  name: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, MaxContentWidth) - 4) / 3);

  function open(photo: HasherPhoto) {
    if (photo.source.type === 'RUN') router.push(`/run/${photo.source.id}`);
    else if (photo.source.type === 'POST') router.push(`/posts/${photo.source.id}`);
    else router.push(`/reels/${photo.source.id}`);
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]} testID="photo-grid-empty">
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          {loading ? 'Loading photos…' : `${name} has not posted any photos yet.`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View testID="photo-grid">
      <View style={styles.grid}>
        {photos.map((photo) => (
          <Pressable
            key={photo.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${photo.caption ?? 'A photo'}, on ${WHERE[photo.source.type]}`}
            testID="photo-tile"
            onPress={() => open(photo)}
            style={[styles.tile, { width: tile, height: tile, backgroundColor: theme.backgroundElement }]}>
            <Image
              source={{ uri: photo.thumbnailUrl ?? photo.url }}
              style={styles.image}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </View>
      {photos.length < total && (
        <View style={styles.more}>
          <Button variant="outline" size="sm" disabled={loading} busy={loading} testID="photo-grid-more" onPress={onMore}>
            Show more
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tile: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  more: { padding: 16, alignItems: 'center' },
});
