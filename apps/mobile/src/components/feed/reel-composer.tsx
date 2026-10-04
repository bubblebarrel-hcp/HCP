import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { MentionInput } from '@/components/social/mention-input';
import { ThemedText } from '@/components/themed-text';
import { AudienceChips } from '@/components/profile/audience-chips';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, assetKind, fileSize, uploadAsset } from '@/lib/media';
import type { Audience, MyMembership, Page, Reel } from '@/lib/types';

// Posting a reel (D41), in the order the API expects: a draft carries the
// caption, the photos and videos go straight to storage against that draft, and
// publishing is the last step, so an upload that fails leaves a draft nobody sees
// rather than an empty reel in everyone's rail. The same road as the web composer.
//
// A reel lasts 24 hours unless it is "only on my profile", which pins it from the
// start so it never reaches the rail and never expires (D58).

// A post, not an album: enough for a Circle, short of a slideshow.
const MAX_ITEMS = 10;
// The camera stops here, the same as the recorder on the web.
const CAMERA_SECONDS = 30;

export function ReelComposer({
  visible,
  onClose,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [profileOnly, setProfileOnly] = useState(false);
  // Which kennel it was shot with, if any. Null is first-class: a reel shot at
  // home belongs to no kennel, and only a member can post to one.
  const [kennelId, setKennelId] = useState<string | null>(null);
  const [kennels, setKennels] = useState<MyMembership[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api<Page<MyMembership>>('/me/memberships')
      .then((data) => {
        if (!cancelled) setKennels(data.items.filter((m) => m.status === 'ACTIVE'));
      })
      .catch(() => {
        // Posting without a kennel is a first-class case, so a failure here
        // costs the chooser and nothing else.
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function reset() {
    setAssets([]);
    setCaption('');
    setAudience('PUBLIC');
    setProfileOnly(false);
    setKennelId(null);
    setBusy(null);
    setError(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  // Added rather than replacing: a post is built up a few at a time.
  function add(picked: ImagePicker.ImagePickerAsset[]) {
    const tooBig = picked.find((a) => a.fileSize !== undefined && a.fileSize > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setError(`${tooBig.fileName ?? 'That file'} is ${fileSize(tooBig.fileSize ?? 0)}. Each one must be 25MB or smaller.`);
      return;
    }
    setError(null);
    setAssets((current) => [...current, ...picked].slice(0, MAX_ITEMS));
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_ITEMS - assets.length),
      quality: 0.85,
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
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: CAMERA_SECONDS,
      quality: 0.85,
    });
    if (!result.canceled) add(result.assets);
  }

  async function post() {
    if (assets.length === 0) {
      setError('Add a video or a photo first.');
      return;
    }
    setError(null);
    try {
      setBusy('Creating the reel…');
      const draft = await api<{ reel: Reel }>('/reels', {
        method: 'POST',
        body: { caption: caption.trim() || null, kennelId, visibility: audience, pinned: profileOnly },
      });
      const reel = draft.reel;

      // In order, because the order they were added is the order they are
      // watched in, and MediaLink.createdAt is what carries that.
      for (const [index, asset] of assets.entries()) {
        setBusy(assets.length === 1 ? 'Uploading…' : `Uploading ${index + 1} of ${assets.length}…`);
        await uploadAsset(asset, { type: 'REEL', id: reel.id }, index);
      }

      setBusy('Posting…');
      await api(`/reels/${reel.id}/publish`, { method: 'POST' });

      reset();
      onClose();
      onPosted();
      router.push(`/reels/${reel.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not post that reel'));
      setBusy(null);
    }
  }

  const ready = assets.length > 0 && !busy;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.modal, { backgroundColor: theme.canvas }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={close} disabled={Boolean(busy)} style={styles.headerButton}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">New reel</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post the reel"
            disabled={!ready}
            onPress={() => void post()}
            style={styles.headerButton}>
            {busy ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <ThemedText type="smallBold" style={{ color: ready ? theme.primaryStrong : theme.textSecondary }}>
                Post
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {assets.length === 0 ? (
            <View style={styles.pickRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use the camera"
                onPress={() => void fromCamera()}
                style={[styles.pick, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ThemedText type="smallBold">Use the camera</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Up to {CAMERA_SECONDS} seconds</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick videos or photos"
                onPress={() => void fromLibrary()}
                style={[styles.pick, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ThemedText type="smallBold">Videos or photos</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Up to {MAX_ITEMS} · 25MB each</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.items}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {assets.map((asset, index) => (
                  <View key={`${asset.uri}:${index}`} style={styles.thumbWrap}>
                    {assetKind(asset) === 'PHOTO' ? (
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.thumb}
                        accessibilityLabel={`Item ${index + 1}`}
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <View style={[styles.thumb, styles.video]} accessibilityLabel={`Item ${index + 1}, a video`}>
                        <ThemedText type="smallBold" style={{ color: '#ffffff' }}>Video</ThemedText>
                      </View>
                    )}
                    <View style={styles.badge}>
                      <ThemedText type="small" style={{ color: '#ffffff' }}>{index + 1}</ThemedText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove item ${index + 1}`}
                      disabled={Boolean(busy)}
                      onPress={() => setAssets((current) => current.filter((_, i) => i !== index))}
                      style={[styles.remove, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <ThemedText type="smallBold">×</ThemedText>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              {assets.length < MAX_ITEMS && (
                <View style={styles.addRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(busy)}
                    onPress={() => void fromLibrary()}
                    style={[styles.addButton, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <ThemedText type="smallBold">Add more</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(busy)}
                    onPress={() => void fromCamera()}
                    style={[styles.addButton, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <ThemedText type="smallBold">Record</ThemedText>
                  </Pressable>
                </View>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {assets.length === 1
                  ? 'One in this post. Add more and they swipe like a gallery.'
                  : `${assets.length} in this post, in this order. The first is the cover.`}
              </ThemedText>
            </View>
          )}

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="textSecondary">Caption (optional)</ThemedText>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Beer check at the top of the hill #beercheck"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              editable={!busy}
              accessibilityLabel="Caption"
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            />
          </View>

          {kennels.length > 0 && (
            <View style={styles.field} accessibilityRole="radiogroup">
              <ThemedText type="smallBold" themeColor="textSecondary">Kennel (optional)</ThemedText>
              <View style={styles.kennels}>
                {[{ id: null, label: 'On On, no kennel' }, ...kennels.map((m) => ({ id: m.kennel.id, label: m.kennel.shortName }))].map(
                  (option) => {
                    const selected = kennelId === option.id;
                    return (
                      <Pressable
                        key={option.id ?? 'none'}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected, disabled: Boolean(busy) }}
                        disabled={Boolean(busy)}
                        onPress={() => setKennelId(option.id)}
                        style={[
                          styles.chip,
                          { borderColor: selected ? theme.primary : theme.border, backgroundColor: theme.card },
                        ]}>
                        <ThemedText type="smallBold" style={{ color: selected ? theme.primaryStrong : theme.textSecondary }}>
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  },
                )}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Leave it as On On if this is just you, wherever you are.
              </ThemedText>
            </View>
          )}

          <AudienceChips what="reel" value={audience} onChange={setAudience} disabled={Boolean(busy)} />
          <ThemedText type="small" themeColor="textSecondary">
            A locked profile narrows this further: only its followers see anything it posts.
          </ThemedText>

          <View style={[styles.profileOnly, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={styles.profileOnlyText}>
              <ThemedText type="smallBold">Only on my profile</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {profileOnly
                  ? 'Pinned to your profile. It stays up, and it never shows in the reel rail or a feed.'
                  : 'Otherwise it shows in the reel rail for 24 hours, then disappears.'}
              </ThemedText>
            </View>
            <Switch
              value={profileOnly}
              onValueChange={setProfileOnly}
              disabled={Boolean(busy)}
              accessibilityLabel="Only on my profile"
              trackColor={{ true: theme.primary }}
            />
          </View>

          {busy && (
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">{busy}</ThemedText>
          )}
          {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.two },
  headerButton: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  pickRow: { flexDirection: 'row', gap: Spacing.two },
  pick: { flex: 1, minHeight: 120, borderRadius: Spacing.three, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: Spacing.one, padding: Spacing.two },
  items: { gap: Spacing.two },
  thumbs: { gap: Spacing.two, paddingTop: 8, paddingRight: 8 },
  thumbWrap: { width: 88, height: 88 },
  thumb: { width: 88, height: 88, borderRadius: Spacing.two, backgroundColor: '#000000' },
  video: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 4, top: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 5 },
  remove: { position: 'absolute', right: -8, top: -8, width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: Spacing.two },
  addButton: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  field: { gap: Spacing.one },
  kennels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 72, borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.two, fontSize: 16, textAlignVertical: 'top' },
  profileOnly: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three },
  profileOnlyText: { flex: 1, gap: 2 },
});
