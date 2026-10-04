import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { PendingPhotoTag } from '@/lib/types';

// Photos hashers want to tag you in (D60). A tag is a request: it shows on the
// photo and on your profile only once you say yes, and a no is final.
export default function PhotoTagsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<PendingPhotoTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: PendingPhotoTag[] }>('/me/photo-tags/pending');
      setItems(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your tag requests'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function answer(item: PendingPhotoTag, approve: boolean) {
    try {
      await api(`/photo-tags/${item.id}/${approve ? 'approve' : 'decline'}`, { method: 'POST' });
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? current);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again.'));
    }
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      {items === null && !error ? (
        <ActivityIndicator color={theme.primary} style={styles.center} />
      ) : error ? (
        <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
              Nothing shows until you say yes. A no is final: they cannot ask again about the same photo.
            </ThemedText>
          }
          ListEmptyComponent={<ThemedText themeColor="textSecondary" style={styles.empty}>No tag requests right now.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Image source={{ uri: item.photo.thumbnailUrl ?? item.photo.url }} style={styles.thumb} />
              <View style={styles.flex}>
                <ThemedText><ThemedText type="smallBold">{item.by.name}</ThemedText> tagged you.</ThemedText>
                {item.photo.caption ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{item.photo.caption}</ThemedText> : null}
                <View style={styles.buttons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void answer(item, true)}
                    style={[styles.button, { backgroundColor: theme.primary }]}>
                    <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Yes, that is me</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void answer(item, false)}
                    style={[styles.button, { borderWidth: 1, borderColor: theme.border }]}>
                    <ThemedText type="smallBold">No</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  list: { padding: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  intro: { padding: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: 12 },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#0000000a' },
  buttons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  button: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, justifyContent: 'center' },
  empty: { textAlign: 'center', padding: Spacing.five },
});
