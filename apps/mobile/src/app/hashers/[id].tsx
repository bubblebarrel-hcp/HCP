import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ReelStrip } from '@/components/feed/reel-strip';
import { Branding } from '@/components/profile/branding';
import { FollowLists } from '@/components/profile/follow-lists';
import { ProfilePhotoGrid } from '@/components/profile/profile-photo-grid';
import { SafetyMenu } from '@/components/profile/safety-menu';
import { TaggedPhotos } from '@/components/profile/tagged-photos';
import { FollowButton } from '@/components/social/follow-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { hasherPhotos, hasherProfile } from '@/lib/social';
import type { FollowRelation, HasherPhoto, HasherProfile } from '@/lib/types';

// The public face of a hasher (D11/D50), as the web lays it out on a phone
// (app/hashers/[id]/page.tsx and components/profile/HasherBody.tsx): banner,
// picture, name and handle, their words, the safety buttons, "Runs with", the
// follower counts with the follow button, then Photos / Followers / Following,
// or the lock that keeps them back (D57). Never biodata: that stays private (D5).

const PAGE = 24;

type Tab = 'photos' | 'followers' | 'following';

export default function HasherProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [hasher, setHasher] = useState<HasherProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<HasherPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [picked, setPicked] = useState<Tab | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [relation, setRelation] = useState<FollowRelation>('NONE');
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pageRef = useRef(1);
  const amFollowing = useRef<boolean | null>(null);

  const fromUrl: Tab = tabParam === 'followers' || tabParam === 'following' ? tabParam : 'photos';
  const tab = picked ?? fromUrl;

  const load = useCallback(async () => {
    try {
      const data = await hasherProfile(id);
      setHasher(data.hasher);
      setCounts({ followers: data.hasher.followers, following: data.hasher.following });
      setRelation(data.hasher.relation);
      setError(null);
      if (data.hasher.canSeeContent) {
        const grid = await hasherPhotos(id, 1, PAGE);
        pageRef.current = 1;
        setPhotos(grid.locked ? [] : grid.items);
        setTotal(grid.locked ? 0 : grid.total);
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
    void load();
  }, [load, user]);

  async function more() {
    setLoadingPhotos(true);
    try {
      const next = pageRef.current + 1;
      const grid = await hasherPhotos(id, next, PAGE);
      pageRef.current = next;
      setPhotos((current) => [...current, ...grid.items]);
      setTotal(grid.total);
    } catch {
      // Pressing it again retries.
    } finally {
      setLoadingPhotos(false);
    }
  }

  const shell = (children: React.ReactNode, refresh = false) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.page}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refreshing}
                tintColor={theme.primary}
                onRefresh={() => {
                  setRefreshing(true);
                  load().finally(() => setRefreshing(false));
                }}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      </View>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText style={styles.semibold}>{error}</ThemedText>
        <Button variant="outline" style={styles.back} onPress={() => router.replace('/')}>Back to the feed</Button>
      </Card>,
    );
  }
  if (!hasher || !counts) return shell(<Skeleton height={384} />);

  const isMe = hasher.isMe;
  // Your own page is always yours; otherwise it is what the server said, moved by
  // what the follow button learns. ONLY_ME stays shut even to a follower.
  const canSee = isMe || hasher.canSeeContent || relation === 'FOLLOWING';
  const closed = hasher.profileVisibility === 'ONLY_ME' && !isMe;
  const visible = canSee && !closed;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'photos', label: 'Photos' },
    { value: 'followers', label: `${counts.followers} ${counts.followers === 1 ? 'Follower' : 'Followers'}` },
    { value: 'following', label: `${counts.following} Following` },
  ];

  return shell(
    <Card style={styles.overflow}>
      {/* Picture and banner: the same top as a kennel page (D37, D56). */}
      <Branding
        name={hasher.name}
        color={hasher.homeKennel?.primaryColor}
        avatarUrl={hasher.avatarUrl}
        avatarPosition={hasher.avatarPosition}
        bannerUrl={hasher.bannerUrl}
        bannerHeight={128}>
        <View style={styles.nameBlock}>
          <ThemedText accessibilityRole="header" testID="hasher-name" style={styles.h1}>{hasher.name}</ThemedText>
          {hasher.username ? (
            <ThemedText themeColor="textSecondary" testID="hasher-username" style={styles.sm}>@{hasher.username}</ThemedText>
          ) : null}
          {!hasher.isNamed && (
            // "Just <firstName>" is not a hash name; saying so is kinder than
            // letting it read as one (D11).
            <ThemedText themeColor="textSecondary" style={styles.sm}>Not named yet — the kennel does that, in its own time.</ThemedText>
          )}
        </View>
      </Branding>

      <View style={styles.body}>
        {hasher.bio ? <ThemedText style={styles.bio}>{hasher.bio}</ThemedText> : null}
        <SafetyMenu hasherId={hasher.id} name={hasher.name} />

        {hasher.kennels.length > 0 && (
          <View style={styles.runsWith}>
            <ThemedText themeColor="textSecondary" style={styles.h2}>Runs with</ThemedText>
            <View style={styles.chips}>
              {hasher.kennels.map((kennel) => (
                <Pressable
                  key={kennel.slug}
                  accessibilityRole="link"
                  onPress={() => router.push(`/kennels/${kennel.slug}`)}
                  style={({ pressed }) => [styles.chip, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                  <Avatar name={kennel.shortName} size={20} color={brandColor(kennel.primaryColor)} />
                  <ThemedText style={styles.sm}>{kennel.shortName}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* The button, the counts, the lists, then their photos and reels or the
            lock that keeps them back. They move together, so the number beside
            "followers" is right the instant it is pressed. */}
        <View style={styles.statsRow}>
          <View style={styles.stats}>
            <Pressable accessibilityRole="button" testID="hasher-followers" onPress={() => visible && setPicked('followers')}>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                <ThemedText style={[styles.sm, styles.semibold]}>{counts.followers}</ThemedText>{' '}
                {counts.followers === 1 ? 'follower' : 'followers'}
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" testID="hasher-following" onPress={() => visible && setPicked('following')}>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                <ThemedText style={[styles.sm, styles.semibold]}>{counts.following}</ThemedText> following
              </ThemedText>
            </Pressable>
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              Hashing here since {formatDate(hasher.joinedAt)}
            </ThemedText>
          </View>
          <FollowButton
            kind="hasher"
            target={hasher.id}
            initialFollowers={hasher.followers}
            showCount={false}
            onRelationChange={(next) => {
              setRelation(next);
            }}
            onCountChange={(next, isFollowing) => {
              setCounts((current) => (current ? { ...current, followers: next } : current));
              const was = amFollowing.current;
              amFollowing.current = isFollowing;
              // The first report is the button learning the truth, not a change.
              if (was !== null && was !== isFollowing) {
                setVersion((v) => v + 1);
                void load();
              }
            }}
          />
        </View>
      </View>

      {visible ? (
        <View style={[styles.tabsWrap, { borderTopColor: theme.border }]} testID="hasher-tabs-wrap">
          <View accessibilityRole="tablist" style={styles.tabs}>
            {tabs.map((t) => {
              const active = tab === t.value;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  testID={`tab-${t.value}`}
                  onPress={() => setPicked(t.value)}
                  style={[styles.tab, { borderBottomColor: active ? theme.primary : 'transparent' }]}>
                  <ThemedText style={[styles.tabText, { color: active ? theme.primaryStrong : theme.textSecondary }]}>{t.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          {tab === 'photos' ? (
            <View style={styles.content} testID="hasher-content">
              <View style={styles.reels}>
                <ThemedText themeColor="textSecondary" style={styles.h2}>Reels</ThemedText>
              </View>
              <ReelStrip key={`reels-${version}`} authorId={hasher.id} />
              <ProfilePhotoGrid photos={photos} total={total} loading={loadingPhotos} onMore={() => void more()} name={hasher.name} />
              <TaggedPhotos hasherId={hasher.id} name={hasher.name} />
            </View>
          ) : (
            <View style={styles.lists}>
              <FollowLists
                key={`${version}-${tab}`}
                hasherId={hasher.id}
                only={tab}
                canRemove={isMe}
                onFollowerRemoved={() =>
                  setCounts((current) => (current ? { ...current, followers: Math.max(0, current.followers - 1) } : current))
                }
              />
            </View>
          )}
        </View>
      ) : (
        <View style={styles.locked} testID="profile-locked">
          <View style={[styles.lockRing, { borderColor: theme.text + 'b3' }]}>
            <Lock size={24} color={theme.text} />
          </View>
          <ThemedText style={styles.lockTitle}>
            {closed ? `${hasher.name} keeps this profile to themself` : 'This profile is private'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lockText}>
            {closed
              ? 'Their photos, posts and reels are only for them.'
              : relation === 'REQUESTED'
                ? `Your request is waiting for ${hasher.name} to approve it. You will see their photos, posts and reels once they do.`
                : user
                  ? `Follow ${hasher.name} to ask to see their photos, posts and reels.`
                  : `Sign in and follow ${hasher.name} to ask to see their photos, posts and reels.`}
          </ThemedText>
          {!user && (
            <Button size="sm" onPress={() => router.push('/account')}>Sign in</Button>
          )}
        </View>
      )}
    </Card>,
    true,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
  overflow: { overflow: 'hidden' },
  notFound: { padding: 32, alignItems: 'center' },
  back: { marginTop: 16 },
  semibold: { fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  nameBlock: { alignItems: 'center' },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '600', textAlign: 'center' },
  h2: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  bio: { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  runsWith: { marginTop: 16 },
  chips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statsRow: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, flexShrink: 1 },
  tabsWrap: { borderTopWidth: 1 },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  content: { paddingTop: 16, gap: 16 },
  reels: { paddingHorizontal: 16, marginBottom: -8 },
  lists: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  locked: { alignSelf: 'center', marginTop: 24, maxWidth: 384, alignItems: 'center', gap: 12, paddingBottom: 16, paddingHorizontal: 16 },
  lockRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  lockText: { fontSize: 14, lineHeight: 20, fontWeight: '400', textAlign: 'center' },
});
