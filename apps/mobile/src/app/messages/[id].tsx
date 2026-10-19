import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Forward, Pin, X } from 'lucide-react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { Composer } from '@/components/messages/composer';
import { ForwardSheet } from '@/components/messages/forward-sheet';
import { MessageBubble } from '@/components/messages/message-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { clearConversationNotifications } from '@/lib/push';
import { isRealtimeConnected, useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime';
import {
  acceptRequest,
  archiveConversation,
  copyableText,
  declineRequest,
  getConversation,
  getMessages,
  markConversationRead,
  pinMessage,
  setConversationActive,
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
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  // Non-null while choosing messages to copy or forward.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [forwardIds, setForwardIds] = useState<string[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pinAt, setPinAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<ScrollView>(null);
  // Where each message sits in the list, for jumping to a quote or a pin.
  const rows = useRef(new Map<string, number>());
  // Stops the list jumping to the bottom while we scroll to a quoted message.
  const holdScroll = useRef(false);
  const first = useRef(true);
  const insets = useSafeAreaInsets();
  // The screen's bottom edge is the top of the keyboard. `height` is the keyboard's
  // live height, negative, straight from the system's window insets frame by frame, so
  // nothing here depends on measuring where this view sits on the screen (the
  // measuring avoider left the box under the keyboard on some phones). With the
  // keyboard down the bottom edge is the system bar, so that is the floor.
  const keyboard = useReanimatedKeyboardAnimation();
  const bottomInset = insets.bottom;
  const rise = useAnimatedStyle(() => ({ paddingBottom: Math.max(bottomInset, -keyboard.height.get()) }));

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  // The first read of a conversation is the screen opening it; later ones are polls,
  // which must not say "open" (they also run while the app is in the background).
  const openedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const opening = openedFor.current !== id;
      openedFor.current = id;
      const [d, page] = await Promise.all([getConversation(id, opening), getMessages(id)]);
      // An API that predates pins answers without the field.
      setDetail({ ...d, pins: d.pins ?? [] });
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
    if (!e.message.mine) {
      markConversationRead(id).catch(() => undefined);
      // A push that raced this message to the tray has nothing left to say.
      void clearConversationNotifications(id);
    }
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

  // While this screen is in view the conversation is "open": its new messages count
  // on the Messages icon and stay out of the bell. A heartbeat, because the socket
  // only listens; it lapses on its own if the app dies or goes to the background.
  useEffect(() => {
    if (!user) return;
    const say = (on: boolean) => void setConversationActive(id, on).catch(() => undefined);
    const beat = () => {
      const active = AppState.currentState === 'active';
      say(active);
      // Back in front of this conversation: whatever the tray still says about it is stale.
      if (active) void clearConversationNotifications(id);
    };
    beat();
    const timer = setInterval(beat, 15_000);
    const sub = AppState.addEventListener('change', beat);
    return () => {
      clearInterval(timer);
      sub.remove();
      say(false);
    };
  }, [user, id]);

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

  // Takes the view to a message, loading earlier pages until it turns up.
  async function jumpTo(messageId: string) {
    const show = () => {
      const y = rows.current.get(messageId);
      if (y === undefined) return false;
      holdScroll.current = true;
      scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      setFlashId(messageId);
      setTimeout(() => {
        holdScroll.current = false;
        setFlashId((current) => (current === messageId ? null : current));
      }, 1600);
      return true;
    };
    if (show()) return;
    let before = messages[0]?.id;
    for (let i = 0; before && i < 8; i++) {
      try {
        const page = await getMessages(id, { before });
        setMessages((current) => merge(current, page.items));
        setHasMore(page.hasMore);
        if (page.items.some((m) => m.id === messageId)) {
          // Wait for the rows to be laid out before asking where one is.
          setTimeout(() => void show(), 250);
          return;
        }
        if (!page.hasMore || page.items.length === 0) break;
        before = page.items[page.items.length - 1].id;
      } catch {
        break;
      }
    }
    Alert.alert('Further back', 'That message is further back than we could load.');
  }

  async function togglePin(m: DirectMessage) {
    try {
      const next = await pinMessage(m.id, !m.pinnedAt);
      setMessages((current) => merge(current, [next]));
      void refresh();
    } catch (err) {
      Alert.alert('Could not pin that', errorMessage(err, 'Try again'));
    }
  }

  function toggleSelected(m: DirectMessage) {
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  const chosen = messages.filter((m) => selected?.has(m.id) && m.status === 'SENT');
  async function copyChosen() {
    const text = chosen.map(copyableText).filter(Boolean).join('\n');
    if (!text) {
      Alert.alert('Nothing to copy', 'Only words can be copied.');
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      setSelected(null);
    } catch {
      Alert.alert('Could not copy that');
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
      {/* The whole screen is padded by the keyboard's height as it rises, so the
          message box sits on the keyboard's top edge and the list shrinks above it. */}
      <Animated.View style={[styles.screen, rise]}>
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

        {detail.pins.length > 0 && (
          <Pressable
            accessibilityRole="button"
            testID="pinned-bar"
            onPress={() => {
              const pin = detail.pins[pinAt % detail.pins.length];
              setPinAt((n) => n + 1);
              void jumpTo(pin.id);
            }}
            style={[styles.pinBar, { borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <Pin size={16} color={theme.primaryStrong} />
            <ThemedText numberOfLines={1} style={styles.pinText}>
              <ThemedText style={[styles.pinText, { fontWeight: '600' }]}>
                Pinned{detail.pins.length > 1 ? ` · ${(pinAt % detail.pins.length) + 1} of ${detail.pins.length}` : ''}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.pinText}>
                {'  '}
                {detail.pins[pinAt % detail.pins.length].preview}
              </ThemedText>
            </ThemedText>
          </Pressable>
        )}

        <ScrollView
          ref={scroller}
          testID="message-list"
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // Scrolling the conversation lowers the keyboard, as in every chat.
          keyboardDismissMode="on-drag"
          // The newest message stays in view as the keyboard changes the height.
          onLayout={() => !holdScroll.current && scroller.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => !holdScroll.current && scroller.current?.scrollToEnd({ animated: false })}>
          {hasMore && (
            <Button variant="ghost" size="sm" onPress={() => void older()}>
              Earlier messages
            </Button>
          )}
          {messages.map((m) => (
            <View key={m.id} onLayout={(e) => rows.current.set(m.id, e.nativeEvent.layout.y)}>
              <MessageBubble
                message={m}
                now={now}
                onEdit={(message) => {
                  setReplyingTo(null);
                  setEditing(message);
                }}
                onReply={(message) => {
                  setEditing(null);
                  setReplyingTo(message);
                }}
                onForward={(message) => setForwardIds([message.id])}
                onPin={(message) => void togglePin(message)}
                onSelect={(message) => setSelected(new Set([message.id]))}
                onJump={(mid) => void jumpTo(mid)}
                canReply={detail.canReply && !detail.isRequest}
                canPin={detail.status === 'ACTIVE' && !detail.isRequest}
                selecting={selected !== null}
                selected={selected?.has(m.id) ?? false}
                onToggle={toggleSelected}
                flash={flashId === m.id}
              />
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
        ) : selected !== null ? (
          <View testID="selection-bar" style={[styles.selectBar, { borderTopColor: theme.border, backgroundColor: theme.canvas }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Stop selecting" onPress={() => setSelected(null)} hitSlop={8}>
              <X size={22} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.selectCount} testID="selection-count">
              {chosen.length} selected
            </ThemedText>
            <Button variant="outline" size="sm" testID="selection-copy" disabled={chosen.length === 0} onPress={() => void copyChosen()}>
              <Copy size={16} color={theme.text} /> Copy
            </Button>
            <Button size="sm" testID="selection-forward" disabled={chosen.length === 0} onPress={() => setForwardIds(chosen.map((m) => m.id))}>
              <Forward size={16} color={theme.onPrimary} /> Forward
            </Button>
          </View>
        ) : detail.canReply ? (
          <View style={{ backgroundColor: theme.canvas }}>
          <Composer
            conversationId={id}
            canShareFiles={detail.canShareFiles}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onSent={({ message, status }) => {
              setReplyingTo(null);
              setMessages((current) => merge(current, [message]));
              setDetail((d) => (d ? { ...d, status, isRequest: false } : d));
              void refresh();
            }}
            onEdited={(message) => setMessages((current) => merge(current, [message]))}
          />
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

        <ForwardSheet
          fromId={id}
          messageIds={forwardIds}
          onClose={() => setForwardIds([])}
          onDone={() => {
            setForwardIds([]);
            setSelected(null);
          }}
        />
      </Animated.View>
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
  pinBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  pinText: { flex: 1, fontSize: 13, lineHeight: 18 },
  selectBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1 },
  selectCount: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
