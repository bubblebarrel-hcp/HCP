import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { SafetyMenu } from '@/components/profile/safety-menu';
import { TaggedPhotos } from '@/components/profile/tagged-photos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import {
  followHasher,
  hasherPhotos,
  hasherProfile,
  listHasherFollowers,
  listHasherFollowing,
  removeFollower,
} from '@/lib/social';
import type { FollowerRow, FollowingEntry, HasherPhoto, HasherProfile } from '@/lib/types';

// The public face of a hasher (D11/D50): handle, picture, words, kennels, a
// follow button, and the photos they have made (D57). Never biodata — that stays
// private (D5).
//
// A locked profile shows who it belongs to and nothing it has made: the photos
// are for the followers the hasher has approved. Following one sends a request.

const PAGE = 24;
const GAP = 2;

type Tab = 'photos' | 'followers' | 'following';

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
  // Photos, Followers and Following, one list at a time (D57). The two lists load
  // when first opened, not with the page.
  const [tab, setTab] = useState<Tab>('photos');
  const [followers, setFollowers] = useState<FollowerRow[] | null>(null);
  const [followingList, setFollowingList] = useState<FollowingEntry[] | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);

  // Three square tiles across, inside the same padding the rest of the screen uses.
  const gridWidth = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  const tile = Math.floor((gridWidth - GAP * 2) / 3);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await hasherProfile(id);
      setHasher(data.hasher);
      setCounts({ followers: data.hasher.followers, following: data.hasher.following });
      // Following or being approved changes who may see the lists.
      setFollowers(null);
      setFollowingList(null);
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

  // Open on first view, so a profile that is only looked at does not pay for lists
  // nobody opened. A locked profile's lists come back empty, and the lock card is
  // what is shown instead.
  useEffect(() => {
    if (!hasher?.canSeeContent) return;
    let alive = true;
    if (tab === 'followers' && followers === null) {
      listHasherFollowers(id)
        .then((page) => {
          if (alive) setFollowers(page.items);
        })
        .catch(() => {
          if (alive) setFollowers([]);
        });
    }
    if (tab === 'following' && followingList === null) {
      listHasherFollowing(id)
        .then((page) => {
          if (alive) setFollowingList(page.items);
        })
        .catch(() => {
          if (alive) setFollowingList([]);
        });
    }
    return () => {
      alive = false;
    };
  }, [tab, hasher?.canSeeContent, followers, followingList, id]);

  function confirmRemove(follower: FollowerRow) {
    Alert.alert(
      `Remove ${follower.name}?`,
      'They stop following you and, if your profile is locked, lose access to your photos, posts and reels. They are not told, and they can ask again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove follower',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFollower(follower.id);
              setFollowers((current) => (current ?? []).filter((row) => row.id !== follower.id));
              setCounts((current) => (current ? { ...current, followers: Math.max(0, current.followers - 1) } : current));
            } catch (err) {
              Alert.alert('Could not remove that follower', errorMessage(err, 'Try again in a moment.'));
            }
          },
        },
      ],
    );
  }

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
    // A photo has no page of its own: it opens what it is on.
    if (photo.source.type === 'RUN') router.push(`/run/${photo.source.id}`);
    else if (photo.source.type === 'POST') router.push(`/posts/${photo.source.id}`);
    else router.push(`/reels/${photo.source.id}`);
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
          <Avatar name={hasher.name} size={72} src={hasher.avatarUrl} position={hasher.avatarPosition} />
          <ThemedText type="title">{hasher.name}</ThemedText>
          {hasher.username ? <ThemedText themeColor="textSecondary">@{hasher.username}</ThemedText> : null}
          {!hasher.isNamed && <ThemedText themeColor="textSecondary">Not yet named by a kennel</ThemedText>}
          {hasher.bio ? <ThemedText style={styles.bio}>{hasher.bio}</ThemedText> : null}
          <ThemedText themeColor="textSecondary">Hashing since {formatDate(hasher.joinedAt)}</ThemedText>

          <View style={styles.statsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${counts?.followers ?? hasher.followers} followers`}
              disabled={!hasher.canSeeContent}
              onPress={() => setTab('followers')}
              style={styles.statButton}>
              <ThemedText type="smallBold">{counts?.followers ?? hasher.followers} followers</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${counts?.following ?? hasher.following} following`}
              disabled={!hasher.canSeeContent}
              onPress={() => setTab('following')}
              style={styles.statButton}>
              <ThemedText type="smallBold">{counts?.following ?? hasher.following} following</ThemedText>
            </Pressable>
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

          {!hasher.isMe && user && (
            <SafetyMenu hasherId={hasher.id} name={hasher.name} initial={hasher.myBlock ?? null} />
          )}

          {hasher.isMe && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/privacy')}
              style={({ pressed }) => [styles.followButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
              <ThemedText type="smallBold">Privacy and account</ThemedText>
            </Pressable>
          )}
        </View>

        {hasher.canSeeContent && <TaggedPhotos hasherId={hasher.id} name={hasher.name} />}

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
            <View style={[styles.tabs, { borderBottomColor: theme.border }]} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'photos' }}
              onPress={() => setTab('photos')}
              style={[styles.tab, { borderBottomColor: tab === 'photos' ? theme.primary : 'transparent' }]}>
              <ThemedText type="smallBold" style={{ color: tab === 'photos' ? theme.primaryStrong : theme.textSecondary }}>
                Photos
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'followers' }}
              onPress={() => setTab('followers')}
              style={[styles.tab, { borderBottomColor: tab === 'followers' ? theme.primary : 'transparent' }]}>
              <ThemedText type="smallBold" style={{ color: tab === 'followers' ? theme.primaryStrong : theme.textSecondary }}>
                {counts?.followers ?? hasher.followers} Followers
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'following' }}
              onPress={() => setTab('following')}
              style={[styles.tab, { borderBottomColor: tab === 'following' ? theme.primary : 'transparent' }]}>
              <ThemedText type="smallBold" style={{ color: tab === 'following' ? theme.primaryStrong : theme.textSecondary }}>
                {counts?.following ?? hasher.following} Following
              </ThemedText>
            </Pressable>
            </View>

            {tab === 'photos' && (
              <View style={styles.section}>
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
            )}

            {tab === 'followers' &&
              (followers === null ? (
                <ActivityIndicator color={theme.primary} />
              ) : followers.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">Nobody yet.</ThemedText>
              ) : (
                followers.map((row) => (
                  <View key={row.id} style={[styles.personRow, { backgroundColor: theme.card }]}>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${row.name}'s profile`}
                      onPress={() => router.push(`/hashers/${row.id}`)}
                      style={styles.personMain}>
                      <Avatar
                        name={row.name}
                        size={40}
                        src={row.avatarUrl}
                        position={row.avatarPosition}
                        color={brandColor(row.homeKennel?.primaryColor)}
                      />
                      <View style={styles.personText}>
                        <ThemedText type="smallBold" numberOfLines={1}>{row.name}</ThemedText>
                        {row.homeKennel && (
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {row.homeKennel.shortName}
                          </ThemedText>
                        )}
                      </View>
                    </Pressable>
                    {hasher.isMe && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${row.name} as a follower`}
                        onPress={() => confirmRemove(row)}
                        style={({ pressed }) => [styles.removeButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
                        <ThemedText type="smallBold">Remove</ThemedText>
                      </Pressable>
                    )}
                  </View>
                ))
              ))}

            {tab === 'following' &&
              (followingList === null ? (
                <ActivityIndicator color={theme.primary} />
              ) : followingList.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">Not following anybody yet.</ThemedText>
              ) : (
                followingList.map((entry) =>
                  entry.kind === 'HASHER' ? (
                    <Pressable
                      key={`h-${entry.hasher.id}`}
                      accessibilityRole="link"
                      accessibilityLabel={`${entry.hasher.name}'s profile`}
                      onPress={() => router.push(`/hashers/${entry.hasher.id}`)}
                      style={[styles.personRow, { backgroundColor: theme.card }]}>
                      <View style={styles.personMain}>
                        <Avatar
                          name={entry.hasher.name}
                          size={40}
                          src={entry.hasher.avatarUrl}
                          position={entry.hasher.avatarPosition}
                          color={brandColor(entry.hasher.homeKennel?.primaryColor)}
                        />
                        <View style={styles.personText}>
                          <ThemedText type="smallBold" numberOfLines={1}>{entry.hasher.name}</ThemedText>
                          {entry.hasher.homeKennel && (
                            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                              {entry.hasher.homeKennel.shortName}
                            </ThemedText>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable
                      key={`k-${entry.kennel.id}`}
                      accessibilityRole="link"
                      accessibilityLabel={entry.kennel.name}
                      onPress={() => router.push(`/kennels/${entry.kennel.slug}`)}
                      style={[styles.personRow, { backgroundColor: theme.card }]}>
                      <View style={styles.personMain}>
                        <Avatar
                          name={entry.kennel.shortName}
                          size={40}
                          src={entry.kennel.logoUrl}
                          color={brandColor(entry.kennel.primaryColor)}
                        />
                        <View style={styles.personText}>
                          <ThemedText type="smallBold" numberOfLines={1}>{entry.kennel.shortName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                            {entry.kennel.city}, {entry.kennel.country}
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  ),
                )
              ))}
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
  statButton: { minHeight: 44, justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three, minHeight: 64 },
  personMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minWidth: 0 },
  personText: { flex: 1, minWidth: 0 },
  removeButton: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  followButton: { marginTop: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.five, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  kennelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, minHeight: 56 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  moreButton: { minHeight: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  lock: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.three },
  lockTitle: { textAlign: 'center', fontSize: 20, lineHeight: 26 },
  lockText: { textAlign: 'center' },
});
