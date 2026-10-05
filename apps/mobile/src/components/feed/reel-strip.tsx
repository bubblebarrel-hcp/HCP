import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Pin, Plus, Video } from 'lucide-react-native';
import { Circle, Svg } from 'react-native-svg';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ReelComposer } from '@/components/feed/reel-composer';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { brandColor } from '@/lib/format';
import type { Page, Reel } from '@/lib/types';

// Reels (D41): the rail across the top of the feed, as on the web app
// (components/feed/ReelStrip.tsx). A card with a "Reels / See all" header,
// a dashed "Post a reel" circle for a signed-in hasher, then one 96pt tile per
// reel. The ring around a tile is its media count: one arc per item, so a
// single photo is an unbroken circle and a seven-photo reel is seven arcs.

const TILE = 96;
const INSET = 6;

function CountRing({ count, color }: { count: number; color: string }) {
  const r = 47;
  const circumference = 2 * Math.PI * r;
  const segments = Math.max(1, count);
  // A long reel would be all gap and no arc, so the gap shrinks as the count grows.
  const gap = segments === 1 ? 0 : Math.min(5, circumference / (segments * 3));
  const arc = (circumference - gap * segments) / segments;

  return (
    <Svg viewBox="0 0 100 100" style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]} pointerEvents="none">
      {Array.from({ length: segments }, (_, i) => (
        <Circle
          key={i}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap={segments === 1 ? 'butt' : 'round'}
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeDashoffset={-(i * (arc + gap))}
        />
      ))}
    </Svg>
  );
}

function Tile({ reel, onOpen }: { reel: Reel; onOpen: () => void }) {
  const theme = useTheme();
  // A photo is its own cover; a video's is the frame grabbed when it was posted
  // (D41). Failing both, borrow the first photo in the reel, then the play icon.
  const first = reel.items[0];
  const cover =
    first?.kind === 'PHOTO' ? first.url : (first?.posterUrl ?? reel.items.find((item) => item.kind === 'PHOTO')?.url ?? null);
  const where = reel.run ? `Run #${reel.run.runNumber ?? '—'}` : reel.event ? reel.event.title : (reel.kennel?.shortName ?? 'On On');
  const tint = brandColor(reel.kennel?.primaryColor);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${reel.author.name}, ${where}, ${reel.itemCount} ${reel.itemCount === 1 ? 'item' : 'items'}`}
      testID="reel-tile"
      onPress={onOpen}
      style={styles.tileWrap}>
      <View style={styles.tile}>
        <CountRing count={reel.itemCount} color={theme.primary} />
        {/* On a profile, the reels the hasher pinned (D58) say so. */}
        {reel.pinned && (
          <View style={[styles.pinned, { backgroundColor: theme.primary, borderColor: theme.card }]}>
            <Pin size={14} color={theme.onPrimary} />
          </View>
        )}
        <View style={[styles.cover, { backgroundColor: tint ?? theme.backgroundElement }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Video size={24} color={theme.onPrimary} />
          )}
        </View>
      </View>
      <View style={styles.author}>
        <Avatar name={reel.author.name} size={20} src={reel.author.avatarUrl} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.authorName}>
          {reel.author.name}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.where}>
        {where}
      </ThemedText>
    </Pressable>
  );
}

// `refreshKey` bumps when the feed is pulled, so the rail reloads with it (D46).
export function ReelStrip({ refreshKey = 0, authorId }: { refreshKey?: number; authorId?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Reel>>(authorId ? `/reels?limit=15&authorId=${authorId}` : '/reels?limit=15');
      setReels(page.items);
    } catch {
      // A failed refresh is not worth an error; the rail stays as it was.
    }
  }, [authorId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, user, refreshKey]);

  if (reels.length === 0 && !user) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} testID="reel-strip">
      <View style={styles.header}>
        <ThemedText type="smallBold" accessibilityRole="header">Reels</ThemedText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/reels' as never)} hitSlop={8}>
          <ThemedText type="small" style={{ color: theme.primaryStrong }}>See all</ThemedText>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {user && (
          <Pressable accessibilityRole="button" testID="reel-create" onPress={() => setComposing(true)} style={styles.tileWrap}>
            <View style={[styles.create, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <Plus size={28} color={theme.primaryStrong} />
            </View>
            <ThemedText type="smallBold" style={styles.createLabel}>Post a reel</ThemedText>
          </Pressable>
        )}
        {reels.map((reel) => (
          <Tile key={reel.id} reel={reel} onOpen={() => router.push(`/reels/${reel.id}`)} />
        ))}
        {reels.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No reels yet. Yours would be the first.
          </ThemedText>
        )}
      </ScrollView>
      <ReelComposer visible={composing} onClose={() => setComposing(false)} onPosted={load} />
    </View>
  );
}

const styles = StyleSheet.create({
  // border-y bg-card p-3: edge to edge on a phone.
  card: { borderTopWidth: 1, borderBottomWidth: 1, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 8 },
  row: { gap: 12, paddingBottom: 4 },
  tileWrap: { width: TILE, alignItems: 'center', gap: 6 },
  tile: { width: TILE, height: TILE },
  cover: { position: 'absolute', top: INSET, left: INSET, right: INSET, bottom: INSET, borderRadius: TILE, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: '100%', height: '100%' },
  pinned: { position: 'absolute', right: -2, top: 4, zIndex: 1, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%' },
  authorName: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  where: { fontSize: 11, lineHeight: 15, width: '100%', textAlign: 'center' },
  create: { width: TILE, height: TILE, borderRadius: TILE / 2, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontSize: 12, lineHeight: 16 },
  empty: { alignSelf: 'center', paddingHorizontal: 8 },
});
