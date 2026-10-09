import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Camera, ImagePlus, Play, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '@/components/feed/avatar';
import { AudienceChips } from '@/components/profile/audience-chips';
import { MentionInput } from '@/components/social/mention-input';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { emitFeedRefresh } from '@/lib/feed-refresh';
import { MAX_POST_MEDIA, VIDEO_PICK_OPTIONS, assetKind, mergePostMedia, uploadAsset } from '@/lib/media';
import type { Audience } from '@/lib/types';

// Post photos or a video, from the + in the bottom bar. A hasher's own post (D51):
// create the draft, put each file straight into storage against it, then publish,
// so a post that is half uploaded never reaches the feed. The same three steps as
// the web composer (components/feed/Composer.tsx): up to four, one of them at most
// a video, words optional.
const MAX_BODY = 5000;
// A clip filmed here is kept short: the upload cap is 25MB (D41).
const CAMERA_SECONDS = 30;

export function PhotoPostComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAssets([]);
    setBody('');
    setAudience('PUBLIC');
    setBusy(null);
    setError(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  // Added rather than replacing: a post is built up a few at a time. Four in all,
  // and at most one of them a video.
  function add(picked: ImagePicker.ImagePickerAsset[]) {
    const merged = mergePostMedia(assets, picked);
    setError(merged.error);
    setAssets(merged.assets);
  }

  const hasVideo = assets.some((a) => assetKind(a) === 'VIDEO');

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: hasVideo ? ['images'] : ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_POST_MEDIA - assets.length),
      quality: 0.85,
      ...VIDEO_PICK_OPTIONS,
    });
    if (!result.canceled) add(result.assets);
  }

  async function fromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Allow camera access in Settings to record here, or pick from your library instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: hasVideo ? ['images'] : ['images', 'videos'],
      videoMaxDuration: CAMERA_SECONDS,
      quality: 0.85,
      ...VIDEO_PICK_OPTIONS,
    });
    if (!result.canceled) add(result.assets);
  }

  async function post() {
    if (assets.length === 0) {
      setError('Add a photo or a video first.');
      return;
    }
    setError(null);
    try {
      setBusy('Creating your post…');
      const draft = await api<{ post: { id: string } }>('/posts', {
        method: 'POST',
        body: { body: body.trim(), visibility: audience },
      });
      for (const [index, asset] of assets.entries()) {
        const label = (fraction: number) =>
          `${assets.length === 1 ? 'Uploading' : `Uploading ${index + 1} of ${assets.length}`}… ${Math.round(fraction * 100)}%`;
        setBusy(assets.length === 1 ? 'Uploading…' : `Uploading ${index + 1} of ${assets.length}…`);
        await uploadAsset(asset, { type: 'POST', id: draft.post.id }, index, (fraction) => setBusy(label(fraction)));
      }
      setBusy('Posting…');
      await api(`/posts/${draft.post.id}/publish`, { method: 'POST' });

      reset();
      onClose();
      emitFeedRefresh();
      router.navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'That did not post.'));
      setBusy(null);
    }
  }

  const ready = assets.length > 0 && !busy;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.modal, { backgroundColor: theme.canvas }]}>
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <Pressable accessibilityRole="button" onPress={close} disabled={Boolean(busy)} style={styles.headerButton}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">New post</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post"
            testID="composer-post"
            disabled={!ready}
            onPress={() => void post()}
            style={styles.headerButton}>
            {busy ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <ThemedText type="smallBold" style={{ color: ready ? theme.primaryStrong : theme.textSecondary }}>Post</ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.who}>
            <Avatar name={user?.displayName ?? 'Me'} size={40} src={user?.avatarUrl} position={user?.avatarPosition} />
            <ThemedText type="smallBold">{user?.displayName}</ThemedText>
          </View>

          {assets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {assets.map((asset, index) => (
                <View key={`${asset.uri}-${index}`}>
                  {assetKind(asset) === 'VIDEO' ? (
                    // A clip's file is not an image the Image view can draw on
                    // every phone, so it is a dark tile with a play mark.
                    <View style={[styles.thumb, styles.videoThumb, { borderColor: theme.border }]}>
                      <Play size={24} color="#fff" fill="#fff" />
                    </View>
                  ) : (
                    <Image source={{ uri: asset.uri }} style={[styles.thumb, { borderColor: theme.border }]} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={assetKind(asset) === 'VIDEO' ? 'Remove video' : 'Remove photo'}
                    disabled={Boolean(busy)}
                    onPress={() => setAssets((current) => current.filter((_, i) => i !== index))}
                    style={[styles.remove, { backgroundColor: theme.text }]}>
                    <X size={14} color={theme.card} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.pickRow}>
            <Button variant="outline" size="sm" disabled={Boolean(busy) || assets.length >= MAX_POST_MEDIA} testID="composer-add-photo" onPress={() => void fromLibrary()}>
              <ImagePlus size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Photos / video</ThemedText>
            </Button>
            <Button variant="outline" size="sm" disabled={Boolean(busy) || assets.length >= MAX_POST_MEDIA} onPress={() => void fromCamera()}>
              <Camera size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Camera</ThemedText>
            </Button>
            <ThemedText themeColor="textSecondary" style={styles.count}>{assets.length} of {MAX_POST_MEDIA}</ThemedText>
          </View>

          <MentionInput
            value={body}
            onChangeText={(next) => setBody(next.slice(0, MAX_BODY))}
            placeholder="Say something about them (optional). Use # for a tag, @ for a hasher."
            placeholderTextColor={theme.textSecondary}
            multiline
            editable={!busy}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          <AudienceChips value={audience} onChange={setAudience} disabled={Boolean(busy)} what="post" />

          {busy ? <ThemedText themeColor="textSecondary" style={styles.sm}>{busy}</ThemedText> : null}
          {error ? <ThemedText accessibilityRole="alert" style={[styles.sm, { color: theme.danger }]}>{error}</ThemedText> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8, borderBottomWidth: 1 },
  headerButton: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  body: { padding: 16, gap: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbs: { gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 8, borderWidth: 1 },
  videoThumb: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  count: { marginLeft: 'auto', fontSize: 12, lineHeight: 16, fontWeight: '400' },
  input: { minHeight: 96, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
