import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';

// Photos a hasher is in, because they said yes to being tagged (D60), as the web
// shows them (components/profile/TaggedPhotos.tsx): "Tagged in", then three
// across with 4pt between. Only what the viewer could open anyway; nothing at
// all when there are none.
interface Tagged {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
}

export function TaggedPhotos({ hasherId, name }: { hasherId: string; name: string }) {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<Tagged[]>([]);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<Page<Tagged>>(`/hashers/${hasherId}/tagged-photos?limit=12`)
      .then((data) => alive && setItems(data.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [hasherId, user, loading]);

  if (items.length === 0) return null;
  // px-4 each side, gap-1 between three.
  const tile = Math.floor((Math.min(width, MaxContentWidth) - 32 - 8) / 3);
  return (
    <View style={styles.wrap} testID="tagged-photos" accessibilityLabel={`Photos of ${name}`}>
      <ThemedText themeColor="textSecondary" style={styles.heading}>Tagged in</ThemedText>
      <View style={styles.grid}>
        {items.map((photo) => (
          <View key={photo.id} style={[styles.tile, { width: tile, height: tile, backgroundColor: theme.backgroundElement }]}>
            <Image
              source={{ uri: photo.thumbnailUrl ?? photo.url }}
              accessibilityLabel={photo.caption ?? `A photo of ${name}`}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  heading: { paddingBottom: 8, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: { borderRadius: 6, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
