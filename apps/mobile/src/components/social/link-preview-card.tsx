import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { LinkPreview } from '@/lib/types';

// What a pasted link looks like (D60), as the web draws it
// (components/social/LinkPreviewCard.tsx). The server read the page once; this only
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
      testID="link-preview"
      onPress={() => void Linking.openURL(preview.url)}
      style={({ pressed }) => [styles.card, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      {preview.imageUrl ? (
        <Image source={{ uri: preview.imageUrl }} style={[styles.image, { backgroundColor: theme.backgroundElement }]} resizeMode="cover" />
      ) : null}
      <View style={styles.pad}>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.host}>{host.toUpperCase()}</ThemedText>
        {preview.title ? <ThemedText style={styles.title}>{preview.title}</ThemedText> : null}
        {preview.description ? (
          <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.description}>{preview.description}</ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // mt-3 overflow-hidden rounded-lg border
  card: { marginTop: 12, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  image: { width: '100%', height: 224 },
  pad: { padding: 12 },
  host: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.6 },
  title: { marginTop: 2, fontSize: 16, lineHeight: 21, fontWeight: '500' },
  description: { marginTop: 2, fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
