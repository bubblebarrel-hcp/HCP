import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Camera, Check, ImageOff, ShieldAlert, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { PhotoTags } from '@/components/social/photo-tags';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, fileSize, uploadAssetFull, type MediaTarget } from '@/lib/media';
import type { MediaAsset } from '@/lib/types';

// Photos on a run, as the web has them (components/runs/RunMedia.tsx). Who may add them,
// and who sees what is still pending, is decided by the API (D28); this only reflects
// what it says. A three-up grid, an "Add photos" button, and a viewer with the caption,
// who is in it, and Approve / Hide for moderators.
export function RunMedia({ target, canContribute, title = 'Photos' }: { target: MediaTarget; canContribute: boolean; title?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(0);
  const [open, setOpen] = useState<MediaAsset | null>(null);

  // p-6 inside the card, gap-2 between three tiles.
  const tile = Math.floor((Math.min(width, MaxContentWidth) - 48 - 16) / 3);

  useEffect(() => {
    let alive = true;
    api<{ items: MediaAsset[]; canModerate: boolean }>(`/media?targetType=${target.type}&targetId=${target.id}`)
      .then((data) => {
        if (!alive) return;
        setItems(data.items);
        setCanModerate(data.canModerate);
        setLoaded(true);
      })
      // A target with no visible media simply shows nothing.
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [target.type, target.id]);

  async function addPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9 });
    if (result.canceled) return;
    const assets = result.assets;
    const tooBig = assets.find((a) => a.fileSize !== undefined && a.fileSize > MAX_UPLOAD_BYTES);
    if (tooBig) {
      Alert.alert(`That photo is ${fileSize(tooBig.fileSize ?? 0)}. Photos must be 25MB or smaller.`);
      return;
    }

    setBusy((n) => n + assets.length);
    let added = 0;
    const stamp = Date.now();
    for (const [index, asset] of assets.entries()) {
      try {
        const { media } = await uploadAssetFull(asset, target, stamp + index);
        setItems((current) => [media, ...current.filter((m) => m.id !== media.id)]);
        added++;
      } catch (err) {
        Alert.alert('A photo did not upload', errorMessage(err, 'A photo did not upload'));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added > 0) Alert.alert(added === 1 ? 'Photo added' : `${added} photos added`);
  }

  async function moderate(media: MediaAsset, approve: boolean) {
    try {
      const data = await api<{ media: MediaAsset }>(`/media/${media.id}/moderate`, { method: 'POST', body: { approve } });
      const updated = data.media;
      setItems((current) => (approve ? current.map((m) => (m.id === updated.id ? updated : m)) : current.filter((m) => m.id !== updated.id)));
      setOpen(null);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    }
  }

  if (!loaded) return null;
  if (items.length === 0 && !canContribute) return null;

  return (
    <Card>
      <View testID="run-media">
        <CardHeader style={styles.header}>
          <View style={styles.flex}>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {items.length === 0 ? 'No photos yet. Be the first.' : `${items.length} photo${items.length === 1 ? '' : 's'} from this run.`}
            </CardDescription>
          </View>
          {canContribute ? (
            <Button variant="outline" disabled={busy > 0} busy={busy > 0} testID="run-photo-add" onPress={() => void addPhotos()}>
              <Camera size={16} color={theme.text} />
              <ThemedText style={styles.buttonText}>{busy > 0 ? `Uploading ${busy}` : 'Add photos'}</ThemedText>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>Anything you add is credited to you and stays with the run.</ThemedText>
          ) : (
            <View style={styles.grid}>
              {items.map((media) => (
                <Pressable
                  key={media.id}
                  accessibilityRole="button"
                  accessibilityLabel={media.caption ?? `Photo by ${media.uploadedBy ?? 'a hasher'}`}
                  testID="run-photo"
                  onPress={() => setOpen(media)}
                  style={[styles.tile, { width: tile, height: tile, backgroundColor: theme.backgroundElement }]}>
                  {media.url ? (
                    <Image source={{ uri: media.thumbnailUrl ?? media.url }} style={styles.tileImage} resizeMode="cover" />
                  ) : (
                    <ImageOff size={20} color={theme.textSecondary} />
                  )}
                  {media.moderationState === 'PENDING' ? (
                    <View style={styles.pending}>
                      <Badge tone="accent">Awaiting review</Badge>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </CardContent>
      </View>

      <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} accessibilityLabel="Close" />
          {open ? (
            <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ScrollView contentContainerStyle={styles.dialogBody}>
                <View style={styles.dialogHead}>
                  <ThemedText accessibilityRole="header" style={[styles.dialogTitle, styles.flex]}>{open.caption ?? 'Photo from this run'}</ThemedText>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setOpen(null)}>
                    <X size={20} color={theme.text} />
                  </Pressable>
                </View>
                {open.url ? (
                  <Image
                    source={{ uri: open.url }}
                    accessibilityLabel={open.caption ?? `Photo by ${open.uploadedBy ?? 'a hasher'}`}
                    style={[styles.full, { backgroundColor: theme.backgroundElement }]}
                    resizeMode="contain"
                  />
                ) : null}
                <ThemedText themeColor="textSecondary" style={styles.sm}>
                  Added by {open.uploadedBy ?? 'a hasher'}
                  {open.moderationState === 'PENDING' ? ' · awaiting review' : ''}
                </ThemedText>
                {canModerate ? (
                  <View style={styles.modRow}>
                    {open.moderationState !== 'APPROVED' ? (
                      <Button size="sm" onPress={() => void moderate(open, true)}>
                        <Check size={16} color={theme.onPrimary} />
                        <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>Approve</ThemedText>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onPress={() => void moderate(open, false)}>
                      <X size={16} color={theme.text} />
                      <ThemedText style={styles.buttonText}>Hide</ThemedText>
                    </Button>
                  </View>
                ) : null}
                {/* Who is in it, and asking somebody to be tagged (D60). */}
                {open.moderationState === 'APPROVED' ? <PhotoTags mediaId={open.id} /> : null}
                {user && open.moderationState === 'APPROVED' ? (
                  <Pressable
                    accessibilityRole="link"
                    testID="photo-report"
                    onPress={() => {
                      const id = open.id;
                      setOpen(null);
                      router.push({ pathname: '/report/[type]/[id]', params: { type: 'MEDIA_ASSET', id } });
                    }}>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>Report this photo</ThemedText>
                  </Pressable>
                ) : null}
                {canModerate && open.moderationState === 'PENDING' ? (
                  <View style={styles.note}>
                    <ShieldAlert size={16} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary" style={[styles.sm, styles.flex]}>Only officers can see this until it is approved.</ThemedText>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 12 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileImage: { width: '100%', height: '100%' },
  pending: { position: 'absolute', left: 6, top: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 768, maxHeight: '92%', borderWidth: 1, borderRadius: 12 },
  dialogBody: { padding: 24, gap: 12 },
  dialogHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dialogTitle: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  full: { width: '100%', height: 360, borderRadius: 8 },
  modRow: { flexDirection: 'row', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
