import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage, WEB_URL } from '@/lib/api';
import type { MentionItem, Page } from '@/lib/types';

// Everywhere somebody has mentioned you (D60), as far as you can still open it. A
// notification can be missed or muted; this stays, and only ever holds what you
// could read anyway.

const WHERE: Record<MentionItem['in'], string> = {
  POST: 'in a post',
  REEL: 'in a reel',
  COMMENT: 'in a comment',
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function MentionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<MentionItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Page<MentionItem>>('/me/mentions?limit=50');
      setItems(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your mentions'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // What has a screen of its own opens there; the rest still reads on the web.
  function open(item: MentionItem) {
    if (item.segment === 'posts') router.push(`/posts/${item.targetId}`);
    else if (item.segment === 'reels') router.push(`/reels/${item.targetId}`);
    else if (item.segment === 'runs') router.push(`/run/${item.targetId}`);
    else void Linking.openURL(`${WEB_URL}/${item.segment}/${item.targetId}`);
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nobody has mentioned you yet. When they do, it is kept here.
            </ThemedText>
          }
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${item.by.name} mentioned you ${WHERE[item.in]}`}
              onPress={() => open(item)}
              style={styles.row}>
              <Avatar name={item.by.name} src={item.by.avatarUrl} size={36} />
              <View style={styles.flex}>
                <ThemedText>
                  <ThemedText type="smallBold">{item.by.name}</ThemedText> mentioned you {WHERE[item.in]}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{item.excerpt}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{timeAgo(item.createdAt)}</ThemedText>
              </View>
            </Pressable>
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
  row: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, minHeight: 64 },
  sep: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', padding: Spacing.five },
});
