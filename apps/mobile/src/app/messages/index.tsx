import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, SquarePen } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Skeleton, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { listConversations, shortTime, unreadCounts, type Box, type ConversationSummary } from '@/lib/messages';
import { isRealtimeConnected, useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime';

// Direct messages (D71), laid out like the web inbox (app/messages/layout.tsx):
// a title with a compose pencil, Messages and Requests tabs, a search box, then
// big-avatar rows with the last words and a dot when something is unread.
// Requests are people you do not follow and share no kennel with; they stay out
// of the first list until you say yes.

const POLL_MS = 15_000;

function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return 'No messages yet';
  const words = m.status === 'SENT' ? m.body : m.status === 'DELETED' ? 'Message deleted' : 'Removed by moderators';
  return `${m.mine ? 'You: ' : ''}${words ?? ''}`;
}

export default function MessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [box, setBox] = useState<Box>('inbox');
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [counts, setCounts] = useState({ unread: 0, requests: 0 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  // The list is live while it is open (D72): anything the socket says about a
  // conversation, or a reconnect, reloads it.
  useRealtimeConnection(Boolean(user));
  const [nudge, setNudge] = useState(0);
  useRealtimeEvent(['dm:message', 'dm:message-updated', 'dm:conversation', 'dm:read', 'dm:refresh', 'resync'], () => setNudge((n) => n + 1));

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let count = 0;
    const tick = async () => {
      try {
        const [page, c] = await Promise.all([listConversations(box), unreadCounts()]);
        if (!alive) return;
        setItems(page.items);
        setCounts(c);
      } catch {
        if (alive) setItems((current) => current ?? []);
      }
    };
    void tick();
    const timer = setInterval(() => {
      if (!isRealtimeConnected() || ++count % 4 === 0) void tick();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user, box, nudge]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !items) return items;
    return items.filter((c) => (c.other?.displayName ?? 'deleted hasher').toLowerCase().includes(q));
  }, [items, search]);

  const tab = (value: Box, label: string, extra?: string) => {
    const active = box === value;
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        testID={`tab-${value}`}
        onPress={() => {
          if (value === box) return;
          setItems(null);
          setBox(value);
        }}
        style={[styles.tab, { borderBottomColor: active ? theme.text : 'transparent' }]}>
        <ThemedText themeColor={active ? 'text' : 'textSecondary'} style={styles.tabText}>
          {label}
          {extra ? <ThemedText style={{ color: theme.primaryStrong }}>{extra}</ThemedText> : null}
        </ThemedText>
        {value === 'inbox' && counts.unread > 0 && <View style={[styles.dotSmall, { backgroundColor: theme.primary }]} />}
      </Pressable>
    );
  };

  return (
    <Subpage back="Back" onBack={() => router.back()}>
      <View testID="messages-page" style={styles.page}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>Messages</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="New message" testID="new-message-open" onPress={() => router.push('/messages/compose')} hitSlop={8}>
            <SquarePen size={24} color={theme.text} />
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {tab('inbox', 'Messages')}
          {tab('requests', 'Requests', counts.requests > 0 ? ` (${counts.requests})` : undefined)}
        </View>

        <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
          <Search size={16} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Search your conversations"
            testID="conversation-search"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {box === 'requests' && (
          <ThemedText themeColor="textSecondary" style={styles.xs}>
            People you do not follow and share no kennel with start here. Nothing tells them you have seen it until you accept.
          </ThemedText>
        )}

        {shown === null ? (
          <Skeleton height={192} />
        ) : shown.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty} testID="messages-empty">
            {search ? 'No conversations match.' : box === 'inbox' ? 'No conversations yet. Use the pencil to start one.' : 'No message requests.'}
          </ThemedText>
        ) : (
          <View testID="conversation-list">
            {shown.map((c) => {
              const unread = c.unreadCount > 0;
              return (
                <Pressable key={c.id} accessibilityRole="button" testID="conversation-item" onPress={() => router.push(`/messages/${c.id}`)} style={styles.row}>
                  <Avatar name={c.other?.displayName ?? 'Hasher'} size={56} src={c.other?.avatarUrl} />
                  <View style={styles.main}>
                    <ThemedText numberOfLines={1} style={[styles.name, unread && styles.bold]}>
                      {c.other?.displayName ?? 'Deleted hasher'}
                    </ThemedText>
                    <ThemedText numberOfLines={1} themeColor={unread ? 'text' : 'textSecondary'} style={[styles.sm, unread && styles.bold]}>
                      {c.status === 'REQUESTED' && !c.isRequest ? 'Waiting for them · ' : ''}
                      {c.unreadCount > 1 ? `${c.unreadCount} new messages` : preview(c)}
                      <ThemedText themeColor="textSecondary" style={styles.sm}>
                        {' '}
                        · {shortTime(c.lastMessageAt)}
                      </ThemedText>
                    </ThemedText>
                  </View>
                  {unread && <View testID="conversation-unread" style={[styles.dot, { backgroundColor: theme.primary }]} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, marginBottom: -1 },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 16, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  empty: { padding: 32, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, lineHeight: 21 },
  bold: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
});
