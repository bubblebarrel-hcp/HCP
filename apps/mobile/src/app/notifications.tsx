import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { MentionsList } from '@/components/social/mentions-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge, Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { routeFor } from '@/lib/push';
import type { NotificationItem, Page } from '@/lib/types';

// Notifications as the web app lays it out on a phone
// (app/notifications/page.tsx): a header card with the settings cog and the
// All / Unread / Mentions filters, then one bordered list with unread rows
// tinted and a dot in front.

const LIMIT = 20;

const categoryLabel: Record<string, string> = {
  MEMBERSHIP: 'Membership',
  RUN: 'Runs',
  TRAIL_RELEASE: 'Trail release',
  REMINDER: 'Reminders',
  REPORT: 'Trail reports',
  ANNOUNCEMENT: 'Announcements',
  GOVERNANCE: 'Governance',
  EVENT: 'Events',
  MEDIA: 'Photos',
  SAFETY: 'Safety',
  SOCIAL: 'Likes, replies and follows',
  SYSTEM: 'System',
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Listing = Page<NotificationItem> & { unread: number };

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  // The mentions inbox (D60): everything that has mentioned you, kept.
  const [mentions, setMentions] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const fetchPage = useCallback(
    (nextPage: number) =>
      api<Listing>(`/me/notifications?limit=${LIMIT}&page=${nextPage}${unreadOnly ? '&unread=true' : ''}`),
    [unreadOnly],
  );

  const reload = useCallback(async () => {
    try {
      const data = await fetchPage(1);
      setError(null);
      setItems(data.items);
      setTotal(data.total);
      setUnread(data.unread);
      setPage(1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your notifications'));
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [user, reload]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setTotal(data.total);
      setUnread(data.unread);
      setPage(page + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  }

  function open(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      api(`/me/notifications/${item.id}/read`, { method: 'POST' }).catch(() => undefined);
    }
    const path = routeFor({ contextType: item.contextType, contextId: item.contextId });
    if (path && path !== '/notifications') router.push(path as never);
  }

  async function markAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    try {
      await api('/me/notifications/read-all', { method: 'POST' });
    } catch {
      void reload();
    }
  }

  if (!user) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <View style={styles.safe}>
          <View style={styles.page}>
            <Skeleton height={384} />
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.primary}
              onRefresh={() => {
                setRefreshing(true);
                reload().finally(() => setRefreshing(false));
              }}
            />
          }>
          <Card style={styles.intro}>
            <View style={styles.introTop}>
              <View style={styles.introText}>
                <ThemedText accessibilityRole="header" style={styles.h1}>Notifications</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.lead}>
                  Likes, comments, follows, runs and everything else for you.
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Notification settings"
                onPress={() => router.push('/settings/notifications' as never)}
                style={styles.cog}>
                <Settings size={20} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.filters}>
              <Button
                size="sm"
                variant={!mentions && !unreadOnly ? 'default' : 'outline'}
                testID="notifications-filter-all"
                onPress={() => {
                  setItems(null);
                  setMentions(false);
                  setUnreadOnly(false);
                }}>
                All
              </Button>
              <Button
                size="sm"
                variant={!mentions && unreadOnly ? 'default' : 'outline'}
                testID="notifications-filter-unread"
                onPress={() => {
                  setItems(null);
                  setMentions(false);
                  setUnreadOnly(true);
                }}>
                {`Unread${unread > 0 ? ` (${unread})` : ''}`}
              </Button>
              <Button
                size="sm"
                variant={mentions ? 'default' : 'outline'}
                testID="notifications-filter-mentions"
                onPress={() => setMentions(true)}>
                Mentions
              </Button>
              {unread > 0 && !mentions && (
                <Button size="sm" variant="ghost" testID="notifications-read-all" style={styles.readAll} onPress={() => void markAllRead()}>
                  Mark all read
                </Button>
              )}
            </View>
          </Card>

          <Card style={styles.list}>
            {mentions ? (
              <MentionsList />
            ) : error ? (
              <ThemedText style={[styles.message, { color: theme.danger }]}>{error}</ThemedText>
            ) : items === null ? (
              <View style={styles.skeletons}>
                {[0, 1, 2, 3].map((n) => (
                  <View key={n} style={[styles.skeletonRow, { backgroundColor: theme.backgroundElement }]} />
                ))}
              </View>
            ) : items.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.empty} testID="notifications-empty">
                {unreadOnly ? 'You are all caught up. On On!' : 'Nothing yet. Likes, comments, follows and run news land here.'}
              </ThemedText>
            ) : (
              items.map((item, index) => (
                <Pressable
                  key={item.id}
                  testID="notification-row"
                  accessibilityRole="button"
                  onPress={() => open(item)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    !item.readAt && { backgroundColor: theme.primary + '0d' },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={[styles.dot, { backgroundColor: item.readAt ? 'transparent' : theme.primary }]} />
                  <View style={styles.rowMain}>
                    <View style={styles.titleRow}>
                      <ThemedText style={styles.title}>{item.title}</ThemedText>
                      {item.priority === 'CRITICAL' && <Badge tone="danger">Safety</Badge>}
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>{item.body}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      {categoryLabel[item.category] ?? item.category} · {timeAgo(item.createdAt)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            )}
            {!mentions && items && items.length < total && (
              <View style={[styles.more, { borderTopColor: theme.border }]}>
                <Button variant="outline" size="sm" disabled={loadingMore} testID="notifications-load-more" onPress={() => void loadMore()}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </View>
            )}
          </Card>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  intro: { padding: 20 },
  introTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  introText: { flex: 1 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cog: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filters: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  readAll: { marginLeft: 'auto' },
  list: { overflow: 'hidden' },
  message: { padding: 32, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  empty: { padding: 40, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  skeletons: { padding: 12, gap: 8 },
  skeletonRow: { height: 64, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 12, padding: 16 },
  dot: { marginTop: 8, width: 8, height: 8, borderRadius: 4 },
  rowMain: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  more: { borderTopWidth: 1, padding: 12, alignItems: 'center' },
});
