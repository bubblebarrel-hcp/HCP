import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Star, Trash2 } from 'lucide-react-native';

import { StickerEditor } from '@/components/messages/sticker-editor';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { createSticker, deleteSticker, getStickers, setStickerFavorite, type Sticker, type StickerTray } from '@/lib/messages';

// The sticker tray (D73): what I sent lately, what I starred, and what I made.
// A tap sends one; a long press offers the star and, for my own, the bin.
// "Make" turns a picture into a sticker in StickerEditor: move and zoom it into a
// rounded square and, if you like, put words on it. The result is 512 px with
// see-through corners, light enough to send over a poor connection.

type Tab = 'recent' | 'favorites' | 'mine';

const LABEL: Record<Tab, string> = { recent: 'Recent', favorites: 'Favourites', mine: 'Mine' };
const LIMIT = 500 * 1024;

// The editor hands over a 512 px PNG with see-through corners. WebP keeps those
// corners and is far lighter, a little softer each time it is too big, with the PNG
// as the last resort.
async function toSticker(uri: string) {
  const image = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
  for (const compress of [0.92, 0.8, 0.6]) {
    const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.WEBP, compress });
    const bytes = (await (await fetch(saved.uri)).blob()).size;
    if (bytes <= LIMIT) return { uri: saved.uri, mimeType: 'image/webp' };
  }
  const png = await image.saveAsync({ format: ImageManipulator.SaveFormat.PNG });
  if ((await (await fetch(png.uri)).blob()).size > LIMIT) throw new Error('That sticker came out too big. Try a simpler picture.');
  return { uri: png.uri, mimeType: 'image/png' };
}

export function StickerPanel({ onSend, sending }: { onSend: (sticker: Sticker) => void; sending: boolean }) {
  const theme = useTheme();
  const [tray, setTray] = useState<StickerTray | null>(null);
  const [tab, setTab] = useState<Tab>('recent');
  const [making, setMaking] = useState(false);
  const [picture, setPicture] = useState<{ uri: string; width: number; height: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getStickers();
      setTray(next);
      return next;
    } catch (err) {
      Alert.alert('Could not load your stickers', errorMessage(err, 'Try again'));
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getStickers()
      .then((next) => {
        if (!alive) return;
        setTray(next);
        // First time here: nothing recent, so land on what is there.
        if (next.recent.length === 0) setTab(next.favorites.length ? 'favorites' : 'mine');
      })
      .catch(() => alive && setTray({ mine: [], favorites: [], recent: [] }));
    return () => {
      alive = false;
    };
  }, []);

  // Pick a picture, then the editor shapes it. No crop box here: the editor is the crop.
  async function pick() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (asset) setPicture({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  async function make(uri: string) {
    setMaking(true);
    try {
      const sticker = await toSticker(uri);
      await createSticker(sticker.uri, sticker.mimeType, { width: 512, height: 512 });
      setPicture(null);
      setTab('mine');
      await load();
    } catch (err) {
      Alert.alert('Could not make that sticker', errorMessage(err, 'Try again'));
      // Keep the editor open so the work is not lost.
      throw err;
    } finally {
      setMaking(false);
    }
  }

  function options(sticker: Sticker) {
    Alert.alert('Sticker', undefined, [
      { text: sticker.favorite ? 'Remove from favourites' : 'Add to favourites', onPress: () => void toggleStar(sticker) },
      ...(sticker.mine
        ? [{ text: 'Delete my sticker', style: 'destructive' as const, onPress: () => void remove(sticker) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  async function toggleStar(sticker: Sticker) {
    try {
      await setStickerFavorite(sticker.id, !sticker.favorite);
      await load();
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again'));
    }
  }

  async function remove(sticker: Sticker) {
    try {
      await deleteSticker(sticker.id);
      await load();
    } catch (err) {
      Alert.alert('Could not delete that sticker', errorMessage(err, 'Try again'));
    }
  }

  const shown = tray ? tray[tab] : [];

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]} testID="sticker-panel">
      <StickerEditor picture={picture} onCancel={() => setPicture(null)} onDone={make} />
      <View style={styles.head}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(Object.keys(LABEL) as Tab[]).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.tabText, tab === t && { fontWeight: '600' }]}>{LABEL[t]}</ThemedText>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          testID="sticker-new"
          disabled={making}
          onPress={() => void pick()}
          style={[styles.make, { borderColor: theme.border }]}>
          {making ? <ActivityIndicator size="small" color={theme.primary} /> : <Plus size={16} color={theme.text} />}
          <ThemedText style={styles.tabText}>Make</ThemedText>
        </Pressable>
      </View>

      {!tray ? (
        <ActivityIndicator color={theme.primary} style={styles.empty} />
      ) : shown.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={[styles.empty, styles.emptyText]} testID="sticker-empty">
          {tab === 'recent'
            ? 'Stickers you send show up here.'
            : tab === 'favorites'
              ? 'Long-press a sticker you were sent, or one you made, to keep it here.'
              : 'You have not made any yet. Press Make to turn a picture into a sticker.'}
        </ThemedText>
      ) : (
        <ScrollView style={styles.grid} contentContainerStyle={styles.gridInner} keyboardShouldPersistTaps="handled" testID="sticker-grid">
          {shown.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel="Send this sticker"
              accessibilityHint="Long press for more"
              testID="sticker"
              disabled={sending || !s.url}
              onPress={() => onSend(s)}
              onLongPress={() => options(s)}
              style={styles.cell}>
              {s.url ? <Image source={{ uri: s.url }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
              {s.favorite && (
                <View style={styles.star}>
                  <Star size={12} color={theme.accentStrong} fill={theme.accentStrong} />
                </View>
              )}
              {s.mine && tab === 'mine' && (
                <Pressable accessibilityRole="button" accessibilityLabel="Delete this sticker" onPress={() => void remove(s)} style={styles.bin} hitSlop={6}>
                  <Trash2 size={13} color={theme.text} />
                </Pressable>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, padding: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  tabs: { flex: 1, flexDirection: 'row', gap: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tabText: { fontSize: 13, lineHeight: 18 },
  make: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  grid: { maxHeight: 210 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', aspectRatio: 1, padding: 4 },
  image: { width: '100%', height: '100%', borderRadius: 14 },
  star: { position: 'absolute', top: 6, right: 6 },
  bin: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 11, padding: 4 },
  empty: { padding: 24 },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
