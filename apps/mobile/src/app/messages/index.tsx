import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Card, Segmented, Skeleton, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { isRealtimeConnected, useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime';
import { listConversations, shortTime, unreadCounts, type Box, type ConversationSummary } from '@/lib/messages';

// Direct messages (D71), as the web lays it out (app/messages/page.tsx): people
// you know in one list, requests from people you do not in another, which stay
// out of the inbox until you say yes.

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

  return (
    <Subpage back="Back" onBack={() => router.back()}>
      <View testID="messages-page" style={styles.gap}>
        <ThemedText style={styles.title}>Messages</ThemedText>
        <Segmented
          value={box}
          onChange={(next) => {
            setItems(null);
            setBox(next);
          }}
          options={[
            { value: 'inbox', label: counts.unread > 0 ? `Messages (${counts.unread})` : 'Messages' },
            { value: 'requests', label: counts.requests > 0 ? `Requests (${counts.requests})` : 'Requests' },
          ]}
        />
        {box === 'requests' && (
          <ThemedText themeColor="textSecondary" style={styles.sm}>
            People you do not follow and share no kennel with start here. Nothing tells them you have seen it until you accept.
          </ThemedText>
        )}
        {items === null ? (
          <Skeleton height={192} />
        ) : items.length === 0 ? (
          <Card bleed={false}>
            <ThemedText themeColor="textSecondary" style={styles.empty} testID="messages-empty">
              {box === 'inbox' ? 'No conversations yet. Open a hasher’s page and choose Message to start one.' : 'No message requests.'}
            </ThemedText>
          </Card>
        ) : (
          <Card bleed={false}>
            {items.map((c, index) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                testID="conversation-item"
                onPress={() => router.push(`/messages/${c.id}`)}
                style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                <Avatar name={c.other?.displayName ?? 'Hasher'} size={44} src={c.other?.avatarUrl} />
                <View style={styles.main}>
                  <View style={styles.top}>
                    <ThemedText numberOfLines={1} style={[styles.name, c.unreadCount > 0 && styles.bold]}>
                      {c.other?.displayName ?? 'Deleted hasher'}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      {shortTime(c.lastMessageAt)}
                    </ThemedText>
                  </View>
                  <ThemedText numberOfLines={1} themeColor={c.unreadCount > 0 ? 'text' : 'textSecondary'} style={styles.sm}>
                    {c.status === 'REQUESTED' && !c.isRequest ? 'Waiting for them · ' : ''}
                    {preview(c)}
                  </ThemedText>
                </View>
                {c.unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.badgeText, { color: theme.onPrimary }]}>{c.unreadCount}</ThemedText>
                  </View>
                )}
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  empty: { padding: 32, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bold: { fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
