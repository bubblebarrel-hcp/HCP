import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Bold, Camera, Check, Code, Image as ImageIcon, Italic, Mic, Send, Smile, Strikethrough, Sticker as StickerIcon, X } from 'lucide-react-native';

import { CameraCapture } from '@/components/camera-capture';
import { EmojiPanel } from '@/components/messages/emoji-panel';
import { StickerPanel } from '@/components/messages/sticker-panel';
import { VoiceRecorder } from '@/components/messages/voice-recorder';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { toggleMark } from '@/lib/chat-format';
import { assetKind, assetMimeType, VIDEO_PICK_OPTIONS } from '@/lib/media';
import {
  clientKey,
  editMessage,
  MAX_ATTACHMENTS,
  MAX_CAPTION,
  MAX_MESSAGE,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  sendMessage,
  uploadAttachment,
  type ConversationStatus,
  type DirectMessage,
  type SendInput,
  type Sticker,
} from '@/lib/messages';

// The message box (D71, D73): words with light formatting, emoji, stickers, photos
// and clips, a voice note, and, for two minutes after sending, editing.

type Panel = 'emoji' | 'sticker' | null;
type Picked = ImagePicker.ImagePickerAsset;

// A line standing in for the message being answered.
function replyPreview(m: DirectMessage) {
  const words = (m.body ?? '').trim();
  if (m.kind === 'STICKER') return 'Sticker';
  if (m.kind === 'VOICE') return 'Voice message';
  if (m.kind === 'MEDIA') return words || (m.attachments.length === 1 ? (m.attachments[0].kind === 'VIDEO' ? 'Video' : 'Photo') : `${m.attachments.length} items`);
  return words;
}

export function Composer({
  conversationId,
  canShareFiles,
  editing,
  onCancelEdit,
  replyingTo,
  onCancelReply,
  onSent,
  onEdited,
}: {
  conversationId: string;
  canShareFiles: boolean;
  editing: DirectMessage | null;
  onCancelEdit: () => void;
  // The message being answered; it rides along with whatever is sent next.
  replyingTo: DirectMessage | null;
  onCancelReply: () => void;
  onSent: (result: { message: DirectMessage; status: ConversationStatus }) => void;
  onEdited: (message: DirectMessage) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [panel, setPanel] = useState<Panel>(null);
  const [staged, setStaged] = useState<Picked[]>([]);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(clientKey());
  const input = useRef<TextInput>(null);
  const limit = staged.length ? MAX_CAPTION : MAX_MESSAGE;

  // Editing puts the words back in the box.
  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(editing.body ?? '');
      setPanel(null);
      input.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyingTo) input.current?.focus();
  }, [replyingTo]);

  function format(mark: '*' | '_' | '~' | '`') {
    const next = toggleMark(draft, selection.start, selection.end, mark);
    setDraft(next.value);
    setSelection({ start: next.start, end: next.end });
  }

  function insert(text: string) {
    const value = draft.slice(0, selection.start) + text + draft.slice(selection.end);
    if (value.length > limit) return;
    const at = selection.start + text.length;
    setDraft(value);
    setSelection({ start: at, end: at });
  }

  function stage(picked: Picked[]) {
    const next: Picked[] = [];
    for (const asset of picked) {
      const kind = assetKind(asset);
      const max = kind === 'VIDEO' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
      if (asset.fileSize !== undefined && asset.fileSize > max) {
        Alert.alert('That one is too big', 'Pictures can be 10MB and videos 50MB. For a long clip, trim it in your Photos app first.');
        continue;
      }
      next.push(asset);
    }
    setStaged((current) => {
      const room = MAX_ATTACHMENTS - current.length;
      if (next.length > room) Alert.alert('Too many', `${MAX_ATTACHMENTS} is the most you can send at once.`);
      return [...current, ...next.slice(0, Math.max(0, room))];
    });
    setPanel(null);
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS,
      quality: 0.85,
      ...VIDEO_PICK_OPTIONS,
    });
    if (!result.canceled) stage(result.assets);
  }

  // Our own camera, not the phone's: that one has no way back on some handsets.
  function fromCamera() {
    Keyboard.dismiss();
    setPanel(null);
    setCameraOpen(true);
  }

  async function post(body: SendInput) {
    const result = await sendMessage(conversationId, { ...body, ...(replyingTo ? { replyToId: replyingTo.id } : {}) }, key.current);
    key.current = clientKey();
    onSent({ message: result.message, status: result.status });
    return result;
  }

  async function submit() {
    if (busy) return;
    const text = draft.trim();

    if (editing) {
      if (!text) return;
      setBusy(true);
      try {
        const { message } = await editMessage(editing.id, text);
        onEdited(message);
      } catch (err) {
        Alert.alert('Could not edit that', errorMessage(err, 'Try again'));
      } finally {
        setDraft('');
        onCancelEdit();
        setBusy(false);
      }
      return;
    }

    if (staged.length) {
      setBusy(true);
      try {
        const ids: string[] = [];
        for (const [i, asset] of staged.entries()) {
          const kind = assetKind(asset);
          const uploaded = await uploadAttachment(
            conversationId,
            asset.uri,
            {
              kind,
              mimeType: assetMimeType(asset),
              width: asset.width || null,
              height: asset.height || null,
              durationSec: kind === 'VIDEO' && asset.duration ? asset.duration / 1000 : null,
            },
            (p) => setProgress((i + p) / staged.length),
          );
          ids.push(uploaded.id);
        }
        await post({ kind: 'MEDIA', attachmentIds: ids, ...(text ? { body: text } : {}) });
        setStaged([]);
        setDraft('');
      } catch (err) {
        Alert.alert('Could not send those', errorMessage(err, 'Try again'));
      } finally {
        setProgress(0);
        setBusy(false);
      }
      return;
    }

    if (!text) return;
    setBusy(true);
    try {
      await post({ kind: 'TEXT', body: text });
      setDraft('');
    } catch (err) {
      Alert.alert('Could not send that', errorMessage(err, 'Try again'));
    } finally {
      setBusy(false);
    }
  }

  async function sendSticker(sticker: Sticker) {
    if (busy) return;
    setBusy(true);
    try {
      await post({ kind: 'STICKER', stickerId: sticker.id });
      setPanel(null);
    } catch (err) {
      Alert.alert('Could not send that sticker', errorMessage(err, 'Try again'));
    } finally {
      setBusy(false);
    }
  }

  async function sendVoice(uri: string, durationSec: number) {
    if (busy) return;
    setBusy(true);
    try {
      const uploaded = await uploadAttachment(conversationId, uri, { kind: 'AUDIO', mimeType: 'audio/mp4', durationSec });
      await post({ kind: 'VOICE', attachmentIds: [uploaded.id] });
      setRecording(false);
    } catch (err) {
      Alert.alert('Could not send that voice message', errorMessage(err, 'Try again'));
    } finally {
      setBusy(false);
    }
  }

  if (recording) {
    return <VoiceRecorder busy={busy} onCancel={() => setRecording(false)} onSend={(uri, seconds) => void sendVoice(uri, seconds)} />;
  }

  const canSend = (Boolean(draft.trim()) || staged.length > 0) && !busy;
  const tool = (children: React.ReactNode, label: string, onPress: () => void, extra?: { testID?: string; active?: boolean }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={extra?.testID}
      onPress={onPress}
      style={[styles.tool, extra?.active && { backgroundColor: theme.backgroundElement }]}
      hitSlop={4}>
      {children}
    </Pressable>
  );
  const ink = theme.textSecondary;
  const toggle = (next: Exclude<Panel, null>) => {
    Keyboard.dismiss();
    setPanel((current) => (current === next ? null : next));
  };

  return (
    <View testID="composer" style={{ borderTopColor: theme.border, borderTopWidth: 1 }}>
      <CameraCapture visible={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(asset) => stage([asset])} />
      {panel === 'emoji' && <EmojiPanel onPick={insert} />}
      {panel === 'sticker' && <StickerPanel sending={busy} onSend={(s) => void sendSticker(s)} />}

      {replyingTo && !editing && (
        <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderLeftColor: theme.primary, borderLeftWidth: 4 }]} testID="reply-banner">
          <View style={styles.bannerText}>
            <ThemedText style={[styles.small, { fontWeight: '600' }]}>Replying to {replyingTo.mine ? 'yourself' : 'them'}</ThemedText>
            <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.small}>
              {replyPreview(replyingTo)}
            </ThemedText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={onCancelReply} hitSlop={8}>
            <X size={18} color={theme.text} />
          </Pressable>
        </View>
      )}

      {editing && (
        <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]} testID="editing-banner">
          <ThemedText style={styles.small}>
            <ThemedText style={[styles.small, { fontWeight: '600' }]}>Editing</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.small}>
              {' '}
              · two minutes after sending
            </ThemedText>
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop editing"
            onPress={() => {
              setDraft('');
              onCancelEdit();
            }}
            hitSlop={8}>
            <X size={18} color={theme.text} />
          </Pressable>
        </View>
      )}

      {staged.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staged} testID="staged-files">
          {staged.map((asset, i) => (
            <View key={`${asset.uri}-${i}`} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
              <Image source={{ uri: asset.uri }} style={styles.thumbImage} resizeMode="cover" accessibilityIgnoresInvertColors />
              {assetKind(asset) === 'VIDEO' && <View style={styles.videoTag} />}
              {!busy && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                  onPress={() => setStaged((current) => current.filter((_, j) => j !== i))}
                  style={styles.remove}
                  hitSlop={6}>
                  <X size={12} color="#ffffff" />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {busy && staged.length > 0 && (
        <View style={[styles.progress, { backgroundColor: theme.border }]}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 3, backgroundColor: theme.primary }} />
        </View>
      )}

      <View style={styles.tools}>
        {tool(<Bold size={18} color={ink} />, 'Bold', () => format('*'), { testID: 'format-bold' })}
        {tool(<Italic size={18} color={ink} />, 'Italic', () => format('_'), { testID: 'format-italic' })}
        {tool(<Strikethrough size={18} color={ink} />, 'Strikethrough', () => format('~'), { testID: 'format-strike' })}
        {tool(<Code size={18} color={ink} />, 'Monospace', () => format('`'), { testID: 'format-mono' })}
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        {tool(<Smile size={21} color={ink} />, 'Emoji', () => toggle('emoji'), { testID: 'open-emoji', active: panel === 'emoji' })}
        {canShareFiles && !editing && (
          <>
            {tool(<StickerIcon size={21} color={ink} />, 'Stickers', () => toggle('sticker'), { testID: 'open-stickers', active: panel === 'sticker' })}
            {tool(<ImageIcon size={21} color={ink} />, 'Attach photos or videos', () => void fromLibrary(), { testID: 'attach' })}
            {tool(<Camera size={21} color={ink} />, 'Take a photo or video', () => fromCamera(), { testID: 'camera' })}
          </>
        )}
      </View>

      <View style={styles.row}>
        <TextInput
          ref={input}
          testID="message-input"
          value={draft}
          onChangeText={setDraft}
          selection={selection}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          onFocus={() => setPanel(null)}
          maxLength={limit}
          multiline
          placeholder={staged.length ? 'Add a caption' : editing ? 'Edit your message' : 'Write a message'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
        />
        {!canSend && !editing && canShareFiles ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Record a voice message" testID="voice-start" onPress={() => setRecording(true)} style={[styles.round, { borderColor: theme.border, borderWidth: 1 }]}>
            <Mic size={20} color={theme.text} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Save edit' : 'Send'}
            testID="message-send"
            disabled={!canSend}
            onPress={() => void submit()}
            style={[styles.round, { backgroundColor: theme.primary, opacity: canSend ? 1 : 0.5 }]}>
            {busy ? <ActivityIndicator size="small" color={theme.onPrimary} /> : editing ? <Check size={20} color={theme.onPrimary} /> : <Send size={19} color={theme.onPrimary} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  small: { fontSize: 13, lineHeight: 18 },
  bannerText: { flex: 1, minWidth: 0, paddingRight: 12 },
  staged: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  videoTag: { position: 'absolute', left: 4, bottom: 4, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#ffffff' },
  remove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  progress: { height: 3, marginTop: 6 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingTop: 6 },
  tool: { width: 38, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rule: { width: 1, height: 20, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, paddingTop: 6 },
  input: { flex: 1, maxHeight: 120, minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
