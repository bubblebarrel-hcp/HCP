import { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View, Vibration, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Check, CheckCheck, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Copy, Flag, Forward, Pin, PinOff, Play, Reply, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { VoicePlayer } from '@/components/messages/voice-player';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { FormattedText } from '@/lib/chat-format';
import { copyableText, type DirectMessage, type MessageAttachment, type Receipt } from '@/lib/messages';

// One message in the thread (D71, D73): words with their marks, pictures and
// clips in a grid, a sticker on its own, or a voice note with a player. Mine sit
// on the right in the brand colour and carry their ticks.

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function Ticks({ receipt }: { receipt: Receipt }) {
  const theme = useTheme();
  if (receipt === 'SENT') return <Check size={14} color={theme.textSecondary} accessibilityLabel="Sent" />;
  return <CheckCheck size={14} color={receipt === 'SEEN' ? theme.primaryStrong : theme.textSecondary} accessibilityLabel={receipt === 'SEEN' ? 'Seen' : 'Delivered'} />;
}

function ClipPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={styles.full} contentFit="contain" nativeControls />;
}

function Viewer({ files, index, onChange, onClose }: { files: MessageAttachment[]; index: number | null; onChange: (i: number) => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const file = index === null ? null : files[index];
  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer} testID="media-viewer">
        {file?.url &&
          (file.kind === 'VIDEO' ? (
            <ClipPlayer key={file.id} url={file.url} />
          ) : (
            <Image source={{ uri: file.url }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
          ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close} hitSlop={10}>
          <X size={26} color="#ffffff" />
        </Pressable>
        {index !== null && index > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Previous" onPress={() => onChange(index - 1)} style={[styles.nav, { left: 8 }]}>
            <ChevronLeft size={26} color="#ffffff" />
          </Pressable>
        )}
        {index !== null && index < files.length - 1 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={() => onChange(index + 1)} style={[styles.nav, { right: 8 }]}>
            <ChevronRight size={26} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const SWIPE_TO_REPLY = 56;

// What you can do to one message: a sheet from the bottom, opened by the chevron
// beside it or by pressing and holding on it.
function ActionSheet({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: { key: string; label: string; icon: React.ReactNode; onPress: () => void }[];
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} testID="message-actions">
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              testID={`message-${item.key}`}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={styles.sheetRow}>
              {item.icon}
              <ThemedText style={styles.sheetLabel}>{item.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

export function MessageBubble({
  message: m,
  now,
  onEdit,
  onReply,
  onForward,
  onPin,
  onSelect,
  onJump,
  canReply,
  canPin,
  selecting,
  selected,
  onToggle,
  flash,
}: {
  message: DirectMessage;
  // The clock, ticking once a second while an edit window is open.
  now: number;
  onEdit: (message: DirectMessage) => void;
  onReply: (message: DirectMessage) => void;
  onForward: (message: DirectMessage) => void;
  onPin: (message: DirectMessage) => void;
  // Starts selecting with this message ticked.
  onSelect: (message: DirectMessage) => void;
  onJump: (id: string) => void;
  canReply: boolean;
  canPin: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: (message: DirectMessage) => void;
  flash: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const slide = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.get() }] }));
  const hint = useAnimatedStyle(() => ({ opacity: Math.min(1, slide.get() / SWIPE_TO_REPLY) }));
  const live = m.status === 'SENT';
  const canEdit = live && m.mine && m.editableUntil !== null && new Date(m.editableUntil).getTime() > now;
  const media = m.attachments.filter((a) => a.kind !== 'AUDIO');
  const voice = m.attachments.find((a) => a.kind === 'AUDIO');
  const ink = m.mine ? theme.onPrimary : theme.text;
  const bare = live && m.kind === 'STICKER' && Boolean(m.sticker?.url);

  let content: React.ReactNode;
  if (!live) {
    content = (
      <ThemedText themeColor="textSecondary" style={[styles.sm, styles.italic]}>
        {m.status === 'DELETED' ? 'This message was deleted' : 'Removed by moderators'}
      </ThemedText>
    );
  } else if (bare && m.sticker?.url) {
    content = <Image source={{ uri: m.sticker.url }} style={styles.sticker} resizeMode="contain" accessibilityLabel="Sticker" accessibilityIgnoresInvertColors testID="message-sticker" />;
  } else if (m.kind === 'VOICE' && voice?.url) {
    content = <VoicePlayer uri={voice.url} durationSec={voice.durationSec} color={ink} />;
  } else if (m.kind === 'MEDIA') {
    const one = media.length === 1;
    content = (
      <View style={styles.mediaWrap}>
        <View style={[styles.grid, { width: one ? 240 : 242 }]}>
          {media.map((file, i) => (
            <Pressable
              key={file.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={file.kind === 'VIDEO' ? 'Open video' : 'Open picture'}
              testID="message-media"
              onPress={() => setViewing(i)}
              style={one ? styles.tileOne : styles.tile}>
              {file.kind === 'VIDEO' || !file.url ? (
                <View style={[styles.full, styles.clip]}>
                  <View style={styles.play}>
                    <Play size={20} color="#ffffff" />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: file.url }} style={styles.full} resizeMode="cover" accessibilityIgnoresInvertColors />
              )}
            </Pressable>
          ))}
        </View>
        {m.body ? <FormattedText text={m.body} style={[styles.sm, { color: ink }, styles.caption]} /> : null}
      </View>
    );
  } else {
    content = <FormattedText text={m.body ?? ''} style={[styles.sm, { color: ink }]} />;
  }

  const text = copyableText(m);
  const iconColor = theme.textSecondary;
  const items = [
    ...(live && canReply ? [{ key: 'reply', label: 'Reply', icon: <Reply size={20} color={iconColor} />, onPress: () => onReply(m) }] : []),
    ...(text
      ? [
          {
            key: 'copy',
            label: 'Copy',
            icon: <Copy size={20} color={iconColor} />,
            onPress: () => void Clipboard.setStringAsync(text).catch(() => Alert.alert('Could not copy that')),
          },
        ]
      : []),
    ...(live ? [{ key: 'forward', label: 'Forward', icon: <Forward size={20} color={iconColor} />, onPress: () => onForward(m) }] : []),
    ...(live && canPin
      ? [
          {
            key: 'pin',
            label: m.pinnedAt ? 'Unpin' : 'Pin',
            icon: m.pinnedAt ? <PinOff size={20} color={iconColor} /> : <Pin size={20} color={iconColor} />,
            onPress: () => onPin(m),
          },
        ]
      : []),
    { key: 'select', label: 'Select', icon: <CheckSquare size={20} color={iconColor} />, onPress: () => onSelect(m) },
    ...(live && !m.mine
      ? [{ key: 'report', label: 'Report', icon: <Flag size={20} color={iconColor} />, onPress: () => router.push(`/report/DIRECT_MESSAGE/${m.id}`) }]
      : []),
  ];

  // Swipe to reply: drag the message to the right and let go. Vertical drags stay
  // scrolling the thread.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .enabled(live && canReply && !selecting)
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((e) => slide.set(Math.max(0, Math.min(e.translationX, 84))))
    .onEnd((e) => {
      if (e.translationX >= SWIPE_TO_REPLY) {
        Vibration.vibrate(10);
        onReply(m);
      }
    })
    .onFinalize(() => slide.set(withTiming(0, { duration: 160 })));

  const bubble = (
    <View
      style={[
        bare ? null : styles.bubble,
        bare
          ? null
          : !live
            ? { borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border }
            : m.kind === 'MEDIA'
              ? [styles.mediaBubble, { backgroundColor: m.mine ? theme.primary : theme.backgroundElement }]
              : { backgroundColor: m.mine ? theme.primary : theme.backgroundElement },
      ]}>
      {live && m.forwarded && (
        <View style={styles.forwarded} testID="message-forwarded">
          <Forward size={12} color={ink} />
          <ThemedText style={[styles.xs, styles.italic, { color: ink }]}>Forwarded</ThemedText>
        </View>
      )}
      {live && m.replyTo && (
        <Pressable
          accessibilityRole="button"
          testID="message-quote"
          onPress={() => onJump(m.replyTo!.id)}
          style={[styles.quote, { borderLeftColor: m.mine ? theme.onPrimary : theme.primary, backgroundColor: m.mine ? 'rgba(255,255,255,0.18)' : theme.card }]}>
          <ThemedText style={[styles.xs, { color: ink, fontWeight: '600' }]}>{m.replyTo.mine ? 'You' : 'Them'}</ThemedText>
          <ThemedText numberOfLines={2} style={[styles.xs, { color: ink }]}>
            {m.replyTo.preview || 'Message'}
          </ThemedText>
        </Pressable>
      )}
      {content}
    </View>
  );

  return (
    <Pressable
      testID="message"
      onPress={selecting ? () => onToggle(m) : undefined}
      disabled={!selecting}
      style={[styles.row, flash && { backgroundColor: theme.backgroundElement }, selected && { backgroundColor: theme.backgroundElement }]}>
      {selecting && (
        <View style={[styles.check, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : 'transparent' }]} testID="message-checkbox">
          {selected && <Check size={14} color={theme.onPrimary} />}
        </View>
      )}
      <View style={styles.slot}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.msg, m.mine ? styles.mine : styles.theirs, slideStyle]}>
          <Animated.View style={[styles.replyHint, hint]} pointerEvents="none">
            <Reply size={16} color={theme.textSecondary} />
          </Animated.View>
          <View style={[styles.line, m.mine && styles.lineMine]}>
            <Pressable
              onLongPress={selecting ? undefined : () => setMenu(true)}
              delayLongPress={280}
              disabled={selecting}
              accessibilityHint="Press and hold for actions"
              style={styles.bubbleWrap}>
              {bubble}
            </Pressable>
            {!selecting && (
              <Pressable accessibilityRole="button" accessibilityLabel="Message actions" testID="message-menu" onPress={() => setMenu(true)} hitSlop={8} style={styles.chevron}>
                <ChevronDown size={16} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
          <View style={styles.meta}>
            <ThemedText themeColor="textSecondary" style={styles.xs}>
              {clock(m.createdAt)}
            </ThemedText>
            {live && m.pinnedAt && (
              <View style={styles.pinned} testID="message-pinned">
                <Pin size={11} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.xs}>
                  Pinned
                </ThemedText>
              </View>
            )}
            {live && m.editedAt && (
              <ThemedText themeColor="textSecondary" style={styles.xs} testID="message-edited">
                Edited
              </ThemedText>
            )}
            {canEdit && !selecting && (
              <Pressable accessibilityRole="button" testID="message-edit" onPress={() => onEdit(m)}>
                <ThemedText themeColor="textSecondary" style={styles.xs}>
                  Edit
                </ThemedText>
              </Pressable>
            )}
            {live && m.mine && m.receipt && <Ticks receipt={m.receipt} />}
          </View>
        </Animated.View>
      </GestureDetector>
      </View>
      <ActionSheet visible={menu} items={items} onClose={() => setMenu(false)} />
      <Viewer files={media} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12 },
  slot: { flex: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  lineMine: { flexDirection: 'row-reverse' },
  bubbleWrap: { flexShrink: 1 },
  chevron: { paddingTop: 6, opacity: 0.7 },
  replyHint: { position: 'absolute', left: -32, top: 8 },
  quote: { borderLeftWidth: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6, gap: 1 },
  forwarded: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingVertical: 8, paddingBottom: 28 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 14 },
  sheetLabel: { fontSize: 16, lineHeight: 22 },
  msg: { gap: 2, flexShrink: 1, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mediaBubble: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  mediaWrap: { gap: 0 },
  caption: { paddingHorizontal: 12, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tileOne: { width: 240, height: 240 },
  tile: { width: 120, height: 120 },
  full: { width: '100%', height: '100%' },
  clip: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  sticker: { width: 144, height: 144, borderRadius: 24 },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  italic: { fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewer: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 44, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  nav: { position: 'absolute', top: '50%', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
