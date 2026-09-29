import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { routeFor } from '@/lib/push';
import type { NotificationItem, Page } from '@/lib/types';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Page<NotificationItem> & { unread: number }>('/me/notifications?limit=50');
      setItems(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load notifications'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)) ?? prev);
      api(`/me/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {});
    }
    const path = routeFor({ contextType: item.contextType, contextId: item.contextId });
    if (path && path !== '/notifications') router.push(path as Parameters<typeof router.push>[0]);
  }

  async function markAllRead() {
    setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    try {
      await api('/me/notifications/read-all', { method: 'POST' });
    } catch {
      load();
    }
  }

  const hasUnread = items?.some((n) => !n.readAt) ?? false;

  return (
    <ThemedView type="canvas" style={styles.flex}>
      {items === null ? (
        <ActivityIndicator color={theme.primary} style={styles.center} />
      ) : error ? (
        <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor={theme.primary}
            />
          }
          ListHeaderComponent={
            hasUnread ? (
              <Pressable accessibilityRole="button" onPress={markAllRead} style={styles.markAll}>
                <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Mark all as read</ThemedText>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Nothing yet. On On!
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
              ]}>
              {!item.readAt ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : <View style={styles.dotSpacer} />}
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText themeColor="textSecondary" numberOfLines={2}>{item.body}</ThemedText>
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
  list: { padding: Spacing.two, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  markAll: { alignItems: 'flex-end', padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two, borderWidth: 1, borderRadius: 12, padding: Spacing.three },
  rowText: { flex: 1, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  dotSpacer: { width: 8, height: 8, marginTop: 6 },
});
