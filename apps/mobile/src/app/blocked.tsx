import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { BlockedHasher } from '@/lib/types';

// Hashers you have blocked or muted (D60). A block works both ways and ends any
// follow; a mute is quiet and one-way. Neither tells the other person, and this is
// where either is undone.
export default function BlockedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<BlockedHasher[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: BlockedHasher[] }>('/me/blocks');
      setItems(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this list'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function undo(item: BlockedHasher) {
    try {
      await api(`/hashers/${item.id}/${item.kind === 'BLOCK' ? 'block' : 'mute'}`, { method: 'DELETE' });
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
              Blocked hashers cannot see your posts, reels or photos, follow you, or reach you; you cannot see theirs.
              Muted hashers just disappear from your feed and notifications, and are not told.
            </ThemedText>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>You have not blocked or muted anybody.</ThemedText>
          }
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.who} accessibilityRole="link" onPress={() => router.push(`/hashers/${item.id}`)}>
                <Avatar name={item.name} src={item.avatarUrl} size={36} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.kind === 'BLOCK' ? 'Blocked' : 'Muted'} {new Date(item.since).toLocaleDateString()}
                  </ThemedText>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void undo(item)}
                style={[styles.button, { borderColor: theme.border }]}>
                <ThemedText type="smallBold">{item.kind === 'BLOCK' ? 'Unblock' : 'Unmute'}</ThemedText>
              </Pressable>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  list: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  intro: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  button: { minHeight: 40, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Spacing.two, justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', padding: Spacing.five },
});
