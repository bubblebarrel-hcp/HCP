import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Avatar } from '@/components/feed/avatar';
import { AudienceChips } from '@/components/profile/audience-chips';
import { EngagementBar } from '@/components/social/engagement-bar';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { countView } from '@/lib/social';
import type { Audience, Reel, ReelItem } from '@/lib/types';

// One reel (D41, D48), at its own screen. A reel is a post of videos and photos
// in the order they were added, so this is a pager: swipe between the items, the
// dots show where you are, and only the item on screen plays.
//
// Fetched with the signed-in session, so a followers-only reel opens for a
// follower and answers "not available" for anybody else (D57), the same as the
// web page. The API says 404 for "private" and "never existed" alike.

// How long a reel has left (D58), in the unit a person would say it in.
function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

function VideoItem({ item, size, active }: { item: ReelItem; size: { width: number; height: number }; active: boolean }) {
  const player = useVideoPlayer(item.url, (p) => {
    p.loop = false;
  });

  // Swiping away from a clip stops it, so two never play over each other.
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={size}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      accessibilityLabel="Reel video"
    />
  );
}

export default function ReelScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reel, setReel] = useState<Reel | null>(null);
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [saving, setSaving] = useState(false);
  // Pin and delete are the author's own acts on a reel (D58).
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const page = Math.min(width, MaxContentWidth);
  const size = { width: page, height: Math.round(page * 1.25) };

  const load = useCallback(async () => {
    try {
      const data = await api<{ reel: Reel }>(`/reels/${id}`);
      setReel(data.reel);
      setAudience(data.reel.visibility);
      setState('ready');
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

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / page));
  }

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
              if (router.canGoBack()) router.back();
              else router.replace('/');
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
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (state === 'unavailable' || state === 'error' || !reel) {
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
      </ThemedView>
    );
  }

  const where = reel.run
    ? { label: `Run #${reel.run.runNumber ?? '—'}${reel.run.title ? ` · ${reel.run.title}` : ''}`, onPress: () => router.push(`/run/${reel.run!.id}`) }
    : reel.kennel
      ? { label: reel.kennel.shortName, onPress: () => router.push(`/kennels/${reel.kennel!.slug}`) }
      : null;

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} testID="reel-page">
          <View style={styles.header}>
            <Avatar
              name={reel.author.name}
              size={40}
              src={reel.author.avatarUrl}
              color={brandColor(reel.kennel?.primaryColor)}
            />
            <View style={styles.authorText}>
              <ThemedText style={styles.sm}>
                <ThemedText style={[styles.sm, styles.medium]} onPress={() => router.push(`/hashers/${reel.author.id}`)}>
                  {reel.author.name}
                </ThemedText>
                {where ? (
                  <>
                    {' · '}
                    <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={where.onPress}>
                      {where.label}
                    </ThemedText>
                  </>
                ) : null}
              </ThemedText>
              {reel.publishedAt ? (
                <ThemedText themeColor="textSecondary" style={styles.sm}>{formatDate(reel.publishedAt)}</ThemedText>
              ) : null}
            </View>
          </View>

          {reel.caption ? <RichText text={reel.caption} style={styles.caption} /> : null}

          {/* The pager: one item per page, in the order they were added. */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            style={{ width: page, alignSelf: 'center' }}
            accessibilityLabel={`Reel, ${reel.items.length} ${reel.items.length === 1 ? 'item' : 'items'}`}>
            {reel.items.map((item, i) =>
              item.kind === 'VIDEO' ? (
                <View key={item.id} style={[size, styles.black]}>
                  <VideoItem item={item} size={size} active={i === index} />
                </View>
              ) : (
                <View key={item.id} style={[size, styles.black]}>
                  <Image
                    source={{ uri: item.url }}
                    style={size}
                    resizeMode="contain"
                    accessibilityLabel={reel.caption ?? `Reel by ${reel.author.name}`}
                    accessibilityIgnoresInvertColors
                  />
                </View>
              ),
            )}
          </ScrollView>

          {reel.items.length > 1 && (
            <View style={styles.dots} accessibilityLabel={`Item ${index + 1} of ${reel.items.length}`}>
              {reel.items.map((item, i) => (
                <View
                  key={item.id}
                  style={[styles.dot, { backgroundColor: i === index ? theme.primary : theme.border }]}
                />
              ))}
            </View>
          )}

          <EngagementBar segment="reels" id={reel.id} initial={reel.engagement} authorId={reel.author.id} />
        </View>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  centerText: { textAlign: 'center' },
  scroll: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingVertical: 16, paddingBottom: 32, gap: 16 },
  // overflow-hidden rounded-none border-x-0: edge to edge, a line above and below.
  card: { overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  authorText: { flex: 1, minWidth: 0 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  medium: { fontWeight: '500' },
  caption: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  black: { backgroundColor: '#000000' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  owner: { gap: Spacing.two, paddingHorizontal: 16 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
