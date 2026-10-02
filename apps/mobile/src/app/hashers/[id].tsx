import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { followHasher, hasherPhotos, hasherProfile } from '@/lib/social';
import type { HasherPhoto, HasherProfile } from '@/lib/types';

// The public face of a hasher (D11/D50): handle, picture, words, kennels, a
// follow button, and the photos they have made (D57). Never biodata — that stays
// private (D5).
//
// A locked profile shows who it belongs to and nothing it has made: the photos
// are for the followers the hasher has approved. Following one sends a request.

const PAGE = 24;
const GAP = 2;

export default function HasherProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hasher, setHasher] = useState<HasherProfile | null>(null);
  const [photos, setPhotos] = useState<HasherPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Three square tiles across, inside the same padding the rest of the screen uses.
  const gridWidth = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  const tile = Math.floor((gridWidth - GAP * 2) / 3);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await hasherProfile(id);
      setHasher(data.hasher);
      if (data.hasher.canSeeContent) {
        const grid = await hasherPhotos(id, 1, PAGE);
        setPhotos(grid.locked ? [] : grid.items);
        setTotal(grid.locked ? 0 : grid.total);
        setPageNo(1);
      } else {
        setPhotos([]);
        setTotal(0);
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not load this hasher'));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleFollow() {
    if (!hasher) return;
    // Whether this is a follow, a request, or taking either back is the
    // server's to say, so this waits for the answer instead of guessing.
    const wantsOn = hasher.relation === 'NONE';
    setBusy(true);
    try {
      await followHasher(hasher.id, wantsOn);
      await load();
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function more() {
    setLoadingMore(true);
    try {
      const next = pageNo + 1;
      const grid = await hasherPhotos(id, next, PAGE);
      setPhotos((current) => [...current, ...grid.items]);
      setTotal(grid.total);
      setPageNo(next);
    } catch {
      // Pressing it again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  function openPhoto(photo: HasherPhoto) {
    // A run has a screen of its own here; a post or a reel opens on the web,
    // which is where they are read until mobile has pages for them.
    if (photo.source.type === 'RUN') router.push(`/run/${photo.source.id}`);
    else Linking.openURL(`${WEB_URL}/${photo.source.type === 'POST' ? 'posts' : 'reels'}/${photo.source.id}`);
  }

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!hasher) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  const following = hasher.relation === 'FOLLOWING';
  const requested = hasher.relation === 'REQUESTED';
  const closed = hasher.profileVisibility === 'ONLY_ME' && !hasher.isMe;
  const label = following ? 'Following' : requested ? 'Requested' : 'Follow';

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hasher.bannerUrl ? (
          <Image source={{ uri: hasher.bannerUrl }} style={styles.banner} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : null}
        <View style={styles.header}>
          <Avatar name={hasher.name} size={72} src={hasher.avatarUrl} />
          <ThemedText type="title">{hasher.name}</ThemedText>
          {!hasher.isNamed && <ThemedText themeColor="textSecondary">Not yet named by a kennel</ThemedText>}
          {hasher.bio ? <ThemedText style={styles.bio}>{hasher.bio}</ThemedText> : null}
          <ThemedText themeColor="textSecondary">Hashing since {formatDate(hasher.joinedAt)}</ThemedText>

          <View style={styles.statsRow}>
            <ThemedText type="smallBold">{hasher.followers} followers</ThemedText>
            <ThemedText type="smallBold">{hasher.following} following</ThemedText>
          </View>

          {!hasher.isMe && !user && (
            <ThemedText type="small" themeColor="textSecondary">Log in to follow.</ThemedText>
          )}

          {!hasher.isMe && user && (closed && !following && !requested ? (
            <View style={[styles.followButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">Not taking followers</ThemedText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={requested ? 'Requested. Press to withdraw your request.' : label}
              accessibilityState={{ selected: following || requested }}
              disabled={busy}
              onPress={toggleFollow}
              style={({ pressed }) => [
                styles.followButton,
                {
                  backgroundColor: following || requested ? theme.backgroundElement : theme.primary,
                  opacity: pressed || busy ? 0.8 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: following || requested ? theme.text : theme.onPrimary }}>
                {label}
              </ThemedText>
            </Pressable>
          ))}

          {hasher.isMe && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/privacy')}
              style={({ pressed }) => [styles.followButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
              <ThemedText type="smallBold">Privacy and account</ThemedText>
            </Pressable>
          )}
        </View>

        {hasher.homeKennel && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Home kennel</ThemedText>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/kennels/${hasher.homeKennel!.slug}`)}
              style={({ pressed }) => [styles.kennelRow, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
              <Avatar name={hasher.homeKennel.shortName} color={brandColor(hasher.homeKennel.primaryColor)} size={32} />
              <ThemedText type="smallBold">{hasher.homeKennel.shortName}</ThemedText>
            </Pressable>
          </View>
        )}

        {hasher.kennels.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Kennels</ThemedText>
            {hasher.kennels.map((k) => (
              <Pressable
                key={k.slug}
                accessibilityRole="link"
                onPress={() => router.push(`/kennels/${k.slug}`)}
                style={({ pressed }) => [styles.kennelRow, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
                <Avatar name={k.shortName} color={brandColor(k.primaryColor)} size={32} />
                <ThemedText type="smallBold">{k.name}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {hasher.canSeeContent ? (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Photos</ThemedText>
            {photos.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {hasher.name} has not posted any photos yet.
              </ThemedText>
            ) : (
              <View style={styles.grid} accessibilityLabel="Photos">
                {photos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={photo.caption ?? 'A photo'}
                    onPress={() => openPhoto(photo)}
                    style={({ pressed }) => [
                      { width: tile, height: tile, backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
                    ]}>
                    <Image
                      source={{ uri: photo.thumbnailUrl ?? photo.url }}
                      style={{ width: tile, height: tile }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  </Pressable>
                ))}
              </View>
            )}
            {photos.length < total && (
              <Pressable
                accessibilityRole="button"
                disabled={loadingMore}
                onPress={more}
                style={({ pressed }) => [styles.moreButton, { backgroundColor: theme.backgroundElement, opacity: pressed || loadingMore ? 0.7 : 1 }]}>
                {loadingMore ? <ActivityIndicator color={theme.primary} /> : <ThemedText type="smallBold">Show more</ThemedText>}
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[styles.lock, { backgroundColor: theme.card }]} accessibilityRole="summary">
            <ThemedText type="subtitle" style={styles.lockTitle}>
              {closed ? `${hasher.name} keeps this profile to themself` : 'This profile is private'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lockText}>
              {closed
                ? 'Their photos, posts and reels are only for them.'
                : requested
                  ? `Your request is waiting for ${hasher.name} to approve it. You will see their photos, posts and reels once they do.`
                  : user
                    ? `Follow ${hasher.name} to ask to see their photos, posts and reels.`
                    : `Log in and follow ${hasher.name} to ask to see their photos, posts and reels.`}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The wide picture across the top of their page (D56); the avatar sits below it.
  banner: { width: '100%', height: 120, borderRadius: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  header: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
  bio: { textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
  followButton: { marginTop: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.five, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  kennelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, minHeight: 56 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  moreButton: { minHeight: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  lock: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
  lockTitle: { textAlign: 'center', fontSize: 20, lineHeight: 26 },
  lockText: { textAlign: 'center' },
});
