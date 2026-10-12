import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Play, X } from 'lucide-react-native';

import { VoicePlayer } from '@/components/messages/voice-player';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { FormattedText } from '@/lib/chat-format';
import type { DirectMessage, MessageAttachment, Receipt } from '@/lib/messages';

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

export function MessageBubble({
  message: m,
  now,
  onEdit,
}: {
  message: DirectMessage;
  // The clock, ticking once a second while an edit window is open.
  now: number;
  onEdit: (message: DirectMessage) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [viewing, setViewing] = useState<number | null>(null);
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

  return (
    <View testID="message" style={[styles.msg, m.mine ? styles.mine : styles.theirs]}>
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
        {content}
      </View>
      <View style={styles.meta}>
        <ThemedText themeColor="textSecondary" style={styles.xs}>
          {clock(m.createdAt)}
        </ThemedText>
        {live && m.editedAt && (
          <ThemedText themeColor="textSecondary" style={styles.xs} testID="message-edited">
            Edited
          </ThemedText>
        )}
        {canEdit && (
          <Pressable accessibilityRole="button" testID="message-edit" onPress={() => onEdit(m)}>
            <ThemedText themeColor="textSecondary" style={styles.xs}>
              Edit
            </ThemedText>
          </Pressable>
        )}
        {live && m.mine && m.receipt && <Ticks receipt={m.receipt} />}
        {live && !m.mine && (
          <Pressable accessibilityRole="button" testID="message-report" onPress={() => router.push(`/report/DIRECT_MESSAGE/${m.id}`)}>
            <ThemedText themeColor="textSecondary" style={styles.xs}>
              Report
            </ThemedText>
          </Pressable>
        )}
      </View>
      <Viewer files={media} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  msg: { gap: 2, maxWidth: '85%' },
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
