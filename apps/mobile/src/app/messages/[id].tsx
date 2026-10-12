import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { Composer } from '@/components/messages/composer';
import { MessageBubble } from '@/components/messages/message-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { isRealtimeConnected, useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime';
import {
  acceptRequest,
  archiveConversation,
  declineRequest,
  getConversation,
  getMessages,
  markConversationRead,
  setConversationMuted,
  type ConversationDetail,
  type DirectMessage,
  type Receipt,
} from '@/lib/messages';

// One conversation (D71, D73), as the web has it (app/messages/[id]/page.tsx). The
// socket delivers what happens in it (D72); the newest page is also re-read every
// few seconds as the net and merged by id, which picks up an edit, a removal and
// the ticks on what I sent.

const POLL_MS = 4_000;

const merge = (current: DirectMessage[], incoming: DirectMessage[]) => {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

// A receipt only ever moves forward: a late, stale answer cannot take a "seen" back.
const RANK: Record<Receipt, number> = { SENT: 0, DELIVERED: 1, SEEN: 2 };

function applyReceipt(messages: DirectMessage[], at: { deliveredAt: string | null; seenAt: string | null }) {
  return messages.map((m) => {
    if (!m.mine || !m.receipt || m.status !== 'SENT') return m;
    const next: Receipt =
      at.seenAt && m.createdAt <= at.seenAt ? 'SEEN' : at.deliveredAt && m.createdAt <= at.deliveredAt ? 'DELIVERED' : m.receipt;
    return RANK[next] > RANK[m.receipt] ? { ...m, receipt: next } : m;
  });
}

export default function ConversationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [editing, setEditing] = useState<DirectMessage | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<ScrollView>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const refresh = useCallback(async () => {
    try {
      const [d, page] = await Promise.all([getConversation(id), getMessages(id)]);
      setDetail(d);
      setMessages((current) => merge(current, page.items));
      if (first.current) {
        setHasMore(page.hasMore);
        first.current = false;
      }
      return page.items;
    } catch (err) {
      if ((err as { status?: number })?.status === 404) setMissing(true);
      return null;
    }
  }, [id]);

  // Pushed by the socket (D72). A message for this conversation is merged and, if
  // it is theirs, read. Anything else about it, or a reconnect, re-reads it.
  useRealtimeConnection(Boolean(user));
  useRealtimeEvent(['dm:message'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId !== id) return;
    setMessages((current) => merge(current, [e.message]));
    if (!e.message.mine) markConversationRead(id).catch(() => undefined);
  });
  useRealtimeEvent(['dm:message-updated'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId !== id) return;
    setMessages((current) => merge(current, [e.message]));
    // Someone removed the message I was editing.
    setEditing((open) => (open?.id === e.message.id && e.message.status !== 'SENT' ? null : open));
  });
  // The other person's device received, or read, what I sent (D73).
  useRealtimeEvent(['dm:receipt'], (e: { conversationId: string; deliveredAt: string | null; seenAt: string | null }) => {
    if (e.conversationId === id) setMessages((current) => applyReceipt(current, e));
  });
  useRealtimeEvent(['dm:conversation', 'dm:refresh', 'resync'], (e?: { conversationId?: string }) => {
    if (!e?.conversationId || e.conversationId === id) void refresh();
  });

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      const items = await refresh();
      if (alive && items?.some((m) => !m.mine)) markConversationRead(id).catch(() => undefined);
    };
    void tick();
    let count = 0;
    const timer = setInterval(() => {
      if (!isRealtimeConnected() || ++count % 15 === 0) void tick();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user, id, refresh]);

  // The edit window shuts by itself: a clock ticks only while a message of mine
  // can still be edited, so a quiet screen does no work.
  const anyEditable = messages.some((m) => m.editableUntil && new Date(m.editableUntil).getTime() > now);
  useEffect(() => {
    if (!anyEditable) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyEditable]);
  // An edit that ran out while open stops being an edit.
  useEffect(() => {
    if (editing?.editableUntil && new Date(editing.editableUntil).getTime() <= now) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(null);
      Alert.alert('Too late to edit', 'The two minutes for editing that message are up.');
    }
  }, [now, editing]);

  async function older() {
    const oldest = messages[0];
    if (!oldest) return;
    try {
      const page = await getMessages(id, { before: oldest.id });
      setMessages((current) => merge(current, page.items));
      setHasMore(page.hasMore);
    } catch (err) {
      Alert.alert('Could not load earlier messages', errorMessage(err, 'Try again'));
    }
  }

  async function answer(accept: boolean) {
    try {
      if (accept) {
        await acceptRequest(id);
        await refresh();
      } else {
        await declineRequest(id);
        router.replace('/messages');
      }
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again'));
    }
  }

  async function toggleMute() {
    if (!detail) return;
    const next = !detail.muted;
    try {
      await setConversationMuted(id, next);
      setDetail({ ...detail, muted: next });
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again'));
    }
  }

  async function archive() {
    try {
      await archiveConversation(id);
      router.replace('/messages');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again'));
    }
  }

  if (missing) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText themeColor="textSecondary" testID="conversation-missing">
          This conversation is not available.
        </ThemedText>
        <Button variant="outline" size="sm" onPress={() => router.replace('/messages')}>
          Back to messages
        </Button>
      </ThemedView>
    );
  }
  if (loading || !user || !detail) return <ThemedView type="canvas" style={styles.center} />;

  const other = detail.other;
  const name = other?.displayName ?? 'Deleted hasher';

  return (
    <ThemedView type="canvas" style={styles.screen}>
      {/* Padding on Android as well as iOS: with edge-to-edge drawing the window no
          longer resizes for the keyboard, so without it the keyboard sat on top of the
          box being typed in. Here the message box is pinned to the bottom, which is
          why this screen needs it and a scrolling form does not. */}
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View testID="conversation" style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" onPress={() => router.back()}>
            <ThemedText style={styles.back}>←</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            disabled={!other || other.deleted}
            onPress={() => other && router.push(`/hashers/${other.id}`)}
            style={styles.who}>
            <Avatar name={name} size={36} src={other?.avatarUrl} />
            <ThemedText numberOfLines={1} style={styles.name} testID="conversation-name">
              {name}
            </ThemedText>
          </Pressable>
          <Button variant="ghost" size="sm" testID="conversation-mute" onPress={() => void toggleMute()}>
            {detail.muted ? 'Unmute' : 'Mute'}
          </Button>
          <ActionDialog
            title="Remove from your list?"
            description="It leaves your list until something new arrives. The other person keeps their copy."
            confirmLabel="Remove"
            onConfirm={archive}
            trigger={(open) => (
              <Button variant="ghost" size="sm" testID="conversation-archive" onPress={open}>
                Remove
              </Button>
            )}
          />
        </View>

        <ScrollView
          ref={scroller}
          testID="message-list"
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
          {hasMore && (
            <Button variant="ghost" size="sm" onPress={() => void older()}>
              Earlier messages
            </Button>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} now={now} onEdit={setEditing} />
          ))}
        </ScrollView>

        {detail.isRequest ? (
          <View testID="request-banner" style={[styles.footer, { borderTopColor: theme.border }]}>
            <ThemedText style={styles.sm}>
              {name} is not someone you follow or share a kennel with. They cannot send more until you accept. Declining does
              not tell them.
            </ThemedText>
            <View style={styles.actions}>
              <Button testID="request-accept" onPress={() => void answer(true)}>
                Accept
              </Button>
              <Button variant="outline" testID="request-decline" onPress={() => void answer(false)}>
                Decline
              </Button>
              {other && !other.deleted && (
                <Button variant="ghost" onPress={() => router.push(`/hashers/${other.id}`)}>
                  Block or report
                </Button>
              )}
            </View>
          </View>
        ) : detail.canReply ? (
          <Composer
            conversationId={id}
            canShareFiles={detail.canShareFiles}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSent={({ message, status }) => {
              setMessages((current) => merge(current, [message]));
              setDetail((d) => (d ? { ...d, status, isRequest: false } : d));
              void refresh();
            }}
            onEdited={(message) => setMessages((current) => merge(current, [message]))}
          />
        ) : (
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.sm} testID="cannot-reply">
              {detail.status === 'REQUESTED'
                ? 'Waiting for them to accept. You can send more once they do.'
                : other?.deleted
                  ? 'This hasher has deleted their account.'
                  : 'You cannot reply to this conversation.'}
            </ThemedText>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  back: { fontSize: 22, lineHeight: 28, paddingHorizontal: 4 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  name: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  sm: { fontSize: 14, lineHeight: 20 },
  footer: { padding: 16, gap: 12, borderTopWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
