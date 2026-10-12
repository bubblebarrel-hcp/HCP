import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreHorizontal, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Avatar } from '@/components/feed/avatar';
import { AudienceChips } from '@/components/profile/audience-chips';
import { EngagementBar } from '@/components/social/engagement-bar';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { countView } from '@/lib/social';
import type { Audience, Reel, ReelItem } from '@/lib/types';

// One reel (D41, D48), watched the way Instagram shows a story: the picture or
// clip fills the whole screen, a row of bars across the top shows which item of
// the reel you are on, and nothing else competes with the media. Tap the right
// of the screen for the next item, the left for the previous one, hold to pause,
// swipe down to leave. Who posted it is a slim line over the top and the rest
// (likes, comments, and for the author pin, delete and audience) sits behind the
// "..." button.
//
// Fetched with the signed-in session, so a followers-only reel opens for a
// follower and answers "not available" for anybody else (D57), the same as the
// web page. The API says 404 for "private" and "never existed" alike.

const PHOTO_MS = 5000;
const TICK_MS = 50;

// How long a reel has left (D58), in the unit a person would say it in.
function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

// A clip reports how far through it is and when it ends; the screen turns that
// into the bar and the move to the next item.
function VideoItem({
  item,
  paused,
  onProgress,
  onEnd,
}: {
  item: ReelItem;
  paused: boolean;
  onProgress: (p: number) => void;
  onEnd: () => void;
}) {
  const player = useVideoPlayer(item.url, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (player.duration > 0) onProgress(Math.min(1, player.currentTime / player.duration));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [player, onProgress]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} accessibilityLabel="Reel video" />;
}

export default function ReelScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reel, setReel] = useState<Reel | null>(null);
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [saving, setSaving] = useState(false);
  // Pin and delete are the author's own acts on a reel (D58).
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ reel: Reel }>(`/reels/${id}`);
      setReel(data.reel);
      setAudience(data.reel.visibility);
      setState('ready');
      // Opening it is what turns the ring grey in the rail.
      void countView('reels', id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState('unavailable');
      else {
        setError(errorMessage(err, 'Could not load this reel'));
        setState('error');
      }
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // The photo clock resumes from where a hold stopped it.
  const progressRef = useRef(0);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const count = reel?.items.length ?? 0;
  const current = reel?.items[index];
  const paused = holding || menu;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) {
        setProgress(0);
        return;
      }
      if (next >= count) {
        close();
        return;
      }
      setIndex(next);
      setProgress(0);
    },
    [count, close],
  );
  const advance = useCallback(() => goTo(index + 1), [goTo, index]);

  // A photo has no length of its own, so it is given five seconds. Held or with
  // the menu open, the clock stops.
  useEffect(() => {
    if (state !== 'ready' || current?.kind !== 'PHOTO' || paused) return;
    let elapsed = progressRef.current * PHOTO_MS;
    const timer = setInterval(() => {
      elapsed += TICK_MS;
      if (elapsed >= PHOTO_MS) {
        clearInterval(timer);
        advance();
        return;
      }
      setProgress(elapsed / PHOTO_MS);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state, current, paused, advance]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 90) close();
        },
      }),
    [close],
  );

  async function changeAudience(next: Audience) {
    const before = audience;
    setAudience(next);
    setSaving(true);
    setNote(null);
    try {
      await api(`/reels/${id}`, { method: 'PATCH', body: { visibility: next } });
      setNote('Who can see this reel is updated.');
    } catch (err) {
      setAudience(before);
      setNote(errorMessage(err, 'Could not change who can see it'));
    } finally {
      setSaving(false);
    }
  }

  // A reel lasts 24 hours unless it is pinned to the profile, where it stays and
  // shows nowhere else (D58). Unpinning one that is already a day old ends it.
  async function setPinned(next: boolean) {
    setWorking(true);
    setNote(null);
    try {
      const data = await api<{ reel: Reel }>(`/reels/${id}/pin`, { method: next ? 'POST' : 'DELETE' });
      const spent = !data.reel.pinned && data.reel.expiresAt !== null && new Date(data.reel.expiresAt).getTime() <= Date.now();
      if (spent) {
        setMenu(false);
        setState('unavailable');
        return;
      }
      setReel(data.reel);
      setNote(next ? 'Pinned to your profile. It will not show in the reel rail.' : 'Unpinned.');
    } catch (err) {
      setNote(errorMessage(err, next ? 'Could not pin that reel' : 'Could not unpin that reel'));
    } finally {
      setWorking(false);
    }
  }

  function confirmUnpin() {
    if (!reel?.publishedAt || Date.now() - new Date(reel.publishedAt).getTime() <= 24 * 60 * 60 * 1000) {
      void setPinned(false);
      return;
    }
    Alert.alert(
      'Unpin this reel?',
      'It was posted more than 24 hours ago. Once unpinned it expires and disappears for everyone.',
      [
        { text: 'Keep it pinned', style: 'cancel' },
        { text: 'Unpin and expire', style: 'destructive', onPress: () => void setPinned(false) },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this reel?',
      'It disappears for everyone, along with its likes and comments. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete reel',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await api(`/reels/${id}`, { method: 'DELETE' });
              setMenu(false);
              close();
            } catch (err) {
              setWorking(false);
              Alert.alert('Could not delete that reel', errorMessage(err, 'Try again in a moment.'));
            }
          },
        },
      ],
    );
  }

  if (state === 'loading') {
    return (
      <View style={styles.black}>
        <StatusBar style="light" />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (state === 'unavailable' || state === 'error' || !reel || !current) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText type="subtitle" style={styles.centerText}>
          {state === 'error' ? 'Could not load this reel' : 'Not available'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {state === 'error'
            ? error
            : 'It may belong to a private profile you do not follow yet, or it may not exist.'}
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={close} style={[styles.back, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const where = reel.run
    ? { label: `Run #${reel.run.runNumber ?? '—'}${reel.run.title ? ` · ${reel.run.title}` : ''}`, onPress: () => router.push(`/run/${reel.run!.id}`) }
    : reel.kennel
      ? { label: reel.kennel.shortName, onPress: () => router.push(`/kennels/${reel.kennel!.slug}`) }
      : null;

  return (
    <View style={styles.black} testID="reel-page" {...pan.panHandlers}>
      <StatusBar style="light" />

      {/* The media, edge to edge. Keyed by item so a clip never carries over. */}
      {current.kind === 'VIDEO' ? (
        <VideoItem key={current.id} item={current} paused={paused} onProgress={setProgress} onEnd={advance} />
      ) : (
        <Image
          source={{ uri: current.url }}
          style={{ width, height }}
          resizeMode="cover"
          accessibilityLabel={reel.caption ?? `Reel by ${reel.author.name}`}
          accessibilityIgnoresInvertColors
        />
      )}

      {/* Tap zones: left third back, the rest forward; holding pauses. */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.zones}>
          <Pressable
            testID="reel-prev"
            accessibilityLabel="Previous"
            style={styles.zoneBack}
            onPress={() => goTo(index - 1)}
            onPressIn={() => setHolding(true)}
            onPressOut={() => setHolding(false)}
          />
          <Pressable
            testID="reel-next"
            accessibilityLabel="Next"
            style={styles.zoneForward}
            onPress={advance}
            onPressIn={() => setHolding(true)}
            onPressOut={() => setHolding(false)}
          />
        </View>
      </View>

      {/* Top: the bars, then who posted, then close. Fades out while held. */}
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8, opacity: holding ? 0 : 1 }]}>
        <View style={styles.bars} accessibilityLabel={`Item ${index + 1} of ${count}`}>
          {reel.items.map((item, i) => (
            <View key={item.id} style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(i < index ? 1 : i === index ? Math.min(1, progress) : 0) * 100}%` }]} />
            </View>
          ))}
        </View>
        <View pointerEvents="box-none" style={styles.who}>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/hashers/${reel.author.id}`)} style={styles.whoMain}>
            <Avatar name={reel.author.name} size={32} src={reel.author.avatarUrl} />
            <ThemedText numberOfLines={1} style={styles.whoText}>
              {reel.author.name}
              {reel.publishedAt ? <ThemedText style={styles.whoDim}> · {formatDate(reel.publishedAt)}</ThemedText> : null}
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More" testID="reel-more" hitSlop={10} onPress={() => setMenu(true)}>
            <MoreHorizontal size={26} color="#ffffff" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="reel-close" hitSlop={10} onPress={close}>
            <X size={28} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {reel.caption ? (
        <View pointerEvents="none" style={[styles.bottom, { paddingBottom: insets.bottom + 16, opacity: holding ? 0 : 1 }]}>
          <RichText text={reel.caption} style={styles.caption} />
        </View>
      ) : null}

      {/* Everything that is not the media: where it was, likes and comments,
          and the author's own controls. */}
      <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenu(false)} accessibilityLabel="Close menu" />
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {where ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  setMenu(false);
                  where.onPress();
                }}>
                <ThemedText style={{ color: theme.primaryStrong }}>{where.label}</ThemedText>
              </Pressable>
            ) : null}
            <EngagementBar segment="reels" id={reel.id} initial={reel.engagement} authorId={reel.author.id} />

            {reel.isMine && (
              <View style={styles.owner}>
                <ThemedText type="small" style={{ color: reel.pinned ? theme.primaryStrong : theme.textSecondary }}>
                  {reel.pinned
                    ? 'Pinned to your profile. It stays up and shows only there.'
                    : reel.expiresAt
                      ? `Disappears in ${timeLeft(reel.expiresAt)}. Pin it to keep it on your profile.`
                      : ''}
                </ThemedText>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={reel.pinned ? 'Unpin from profile' : 'Pin to profile'}
                    accessibilityState={{ disabled: working }}
                    disabled={working}
                    onPress={() => (reel.pinned ? confirmUnpin() : void setPinned(true))}
                    style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card, opacity: working ? 0.6 : 1 }]}>
                    <ThemedText type="smallBold">{reel.pinned ? 'Unpin' : 'Pin to profile'}</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete reel"
                    accessibilityState={{ disabled: working }}
                    disabled={working}
                    onPress={confirmDelete}
                    style={[styles.action, { borderColor: theme.danger, backgroundColor: theme.card, opacity: working ? 0.6 : 1 }]}>
                    <ThemedText type="smallBold" style={{ color: theme.danger }}>Delete</ThemedText>
                  </Pressable>
                </View>
                <AudienceChips what="reel" value={audience} onChange={(next) => void changeAudience(next)} disabled={saving} />
                {note && <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  centerText: { textAlign: 'center' },
  back: { marginTop: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.four, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  zones: { flex: 1, flexDirection: 'row' },
  zoneBack: { flex: 1 },
  zoneForward: { flex: 2 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 8, gap: 10, backgroundColor: 'rgba(0,0,0,0.18)' },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#ffffff' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 8 },
  whoMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  whoText: { flex: 1, color: '#ffffff', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  whoDim: { color: 'rgba(255,255,255,0.75)', fontWeight: '400' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.3)' },
  caption: { color: '#ffffff', fontSize: 15, lineHeight: 21, fontWeight: '400' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
  sheetBody: { padding: 16, gap: 16 },
  owner: { gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
