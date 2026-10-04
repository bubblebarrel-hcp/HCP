import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import type { Page } from '@/lib/types';

// Photos a hasher is in, because they said yes to being tagged (D60). Only what
// the viewer could open anyway; nothing at all when there are none.
interface Tagged {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
}

export function TaggedPhotos({ hasherId, name }: { hasherId: string; name: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Tagged[]>([]);

  useEffect(() => {
    let alive = true;
    api<Page<Tagged>>(`/hashers/${hasherId}/tagged-photos?limit=12`)
      .then((data) => alive && setItems(data.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [hasherId, user]);

  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary">Tagged in</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((photo) => (
          <Image
            key={photo.id}
            source={{ uri: photo.thumbnailUrl ?? photo.url }}
            accessibilityLabel={photo.caption ?? `A photo of ${name}`}
            style={styles.photo}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { gap: Spacing.one },
  photo: { width: 96, height: 96, borderRadius: 8, backgroundColor: '#0000000a' },
});
