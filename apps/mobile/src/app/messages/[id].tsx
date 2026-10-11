import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
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
  clientKey,
  declineRequest,
  getConversation,
  getMessages,
  markConversationRead,
  MAX_MESSAGE,
  sendMessage,
  setConversationMuted,
  unsendMessage,
  type ConversationDetail,
  type DirectMessage,
} from '@/lib/messages';

// One conversation (D71), as the web has it (app/messages/[id]/page.tsx). There
// is no socket: while it is open the newest page is re-read every few seconds
// and merged by id, which also picks up a message the other person unsent.

const POLL_MS = 4_000;

const merge = (current: DirectMessage[], incoming: DirectMessage[]) => {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function ConversationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const key = useRef(clientKey());
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
    if (e.conversationId === id) setMessages((current) => merge(current, [e.message]));
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

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(id, text, key.current);
      key.current = clientKey();
      setDraft('');
      setMessages((current) => merge(current, [sent.message]));
      setDetail((d) => (d ? { ...d, status: sent.status, isRequest: false } : d));
      void refresh();
    } catch (err) {
      Alert.alert('Could not send that', errorMessage(err, 'Try again'));
    } finally {
      setSending(false);
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

  async function unsend(message: DirectMessage) {
    try {
      await unsendMessage(message.id);
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, body: null, status: 'DELETED' } : m)));
    } catch (err) {
      Alert.alert('Could not unsend that', errorMessage(err, 'Try again'));
      throw err;
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
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
          {hasMore && (
            <Button variant="ghost" size="sm" onPress={() => void older()}>
              Earlier messages
            </Button>
          )}
          {messages.map((m) => (
            <View key={m.id} testID="message" style={[styles.msg, m.mine ? styles.mine : styles.theirs]}>
              <View
                style={[
                  styles.bubble,
                  m.status !== 'SENT'
                    ? { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border }
                    : { backgroundColor: m.mine ? theme.primary : theme.backgroundElement },
                ]}>
                <ThemedText
                  style={m.status !== 'SENT' ? [styles.sm, styles.italic] : m.mine ? [styles.sm, { color: theme.onPrimary }] : styles.sm}
                  themeColor={m.status !== 'SENT' ? 'textSecondary' : undefined}>
                  {m.status === 'SENT'
                    ? m.body
                    : m.status === 'DELETED'
                      ? m.mine
                        ? 'You unsent this message'
                        : 'This message was unsent'
                      : 'Removed by moderators'}
                </ThemedText>
              </View>
              <View style={styles.meta}>
                <ThemedText themeColor="textSecondary" style={styles.xs}>
                  {clock(m.createdAt)}
                </ThemedText>
                {m.status === 'SENT' && m.mine && (
                  <ActionDialog
                    title="Unsend this message?"
                    description="It disappears for both of you. They may already have read it."
                    confirmLabel="Unsend"
                    destructive
                    onConfirm={() => unsend(m)}
                    trigger={(open) => (
                      <Pressable accessibilityRole="button" testID="message-unsend" onPress={open}>
                        <ThemedText themeColor="textSecondary" style={styles.xs}>
                          Unsend
                        </ThemedText>
                      </Pressable>
                    )}
                  />
                )}
                {m.status === 'SENT' && !m.mine && (
                  <Pressable accessibilityRole="button" testID="message-report" onPress={() => router.push(`/report/DIRECT_MESSAGE/${m.id}`)}>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      Report
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
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
          <View style={[styles.composer, { borderTopColor: theme.border }]}>
            <TextInput
              testID="message-input"
              value={draft}
              onChangeText={setDraft}
              maxLength={MAX_MESSAGE}
              multiline
              placeholder="Write a message"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
            />
            <Button testID="message-send" disabled={!draft.trim() || sending} onPress={() => void send()}>
              Send
            </Button>
          </View>
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
  msg: { gap: 2, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  italic: { fontStyle: 'italic' },
  meta: { flexDirection: 'row', gap: 8 },
  footer: { padding: 16, gap: 12, borderTopWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, minHeight: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
});
