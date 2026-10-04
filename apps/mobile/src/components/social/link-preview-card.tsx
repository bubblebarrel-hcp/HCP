import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LinkPreview } from '@/lib/types';

// What a pasted link looks like (D60). The server read the page once; this only
// draws it, and opens the link outside Shiggy Trails.
export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const theme = useTheme();
  let host = preview.siteName ?? '';
  try {
    host = host || new URL(preview.url).hostname.replace(/^www\./, '');
  } catch {
    // Keep what we have.
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open link: ${preview.title ?? host}`}
      onPress={() => void Linking.openURL(preview.url)}
      style={[styles.card, { borderColor: theme.border }]}>
      {preview.imageUrl ? <Image source={{ uri: preview.imageUrl }} style={styles.image} /> : null}
      <View style={styles.pad}>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.host}>{host}</ThemedText>
        {preview.title ? <ThemedText type="smallBold" numberOfLines={2}>{preview.title}</ThemedText> : null}
        {preview.description ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{preview.description}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: Spacing.two },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0000000a' },
  pad: { padding: Spacing.three, gap: 2 },
  host: { textTransform: 'uppercase' },
});
