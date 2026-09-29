import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/api';
import { getEngagement, reshare, setBookmarked, setLiked, unreshare } from '@/lib/social';
import type { Engagement, SubjectSegment } from '@/lib/types';

// The bar under a piece of content: like, comment, reshare, share, save, seen
// (D50). Mirrors apps/web/components/social/EngagementBar.tsx's interaction
// model — optimistic press, reconciled with the server's own number — but
// opens comments as a pushed screen instead of an inline expand, since a
// FlatList item that grows underneath a scroll position is a worse fit on a
// phone than a full screen is.

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return <ThemedText type="small" style={styles.count}>{value > 999 ? `${(value / 1000).toFixed(1)}k` : value}</ThemedText>;
}

const WEB_HREF: Record<SubjectSegment, (id: string) => string> = {
  posts: (id) => `/posts/${id}`,
  reels: (id) => `/reels/${id}`,
  reports: (id) => `/reports/${id}`,
  photos: (id) => `/posts/${id}`,
  runs: (id) => `/runs/${id}`,
  capsules: (id) => `/capsules/${id}`,
  comments: (id) => `/posts/${id}`,
};

export function EngagementBar({
  segment,
  id,
  initial,
  authorId,
  showViews = true,
}: {
  segment: SubjectSegment;
  id: string;
  initial: Engagement;
  authorId?: string | null;
  showViews?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [engagement, setEngagement] = useState(initial);
  const [composing, setComposing] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(optimistic: Engagement, run: () => Promise<Engagement>) {
    const previous = engagement;
    setError(null);
    setEngagement(optimistic);
    setBusy(true);
    try {
      setEngagement(await run());
    } catch {
      setEngagement(previous);
      setError('That did not go through.');
    } finally {
      setBusy(false);
    }
  }

  const signedOut = !user;
  const isMine = Boolean(user && authorId && authorId === user.id);

  function onLike() {
    if (signedOut) return;
    const next = !engagement.liked;
    void act({ ...engagement, liked: next, likes: engagement.likes + (next ? 1 : -1) }, () => setLiked(segment, id, next));
  }

  function onBookmark() {
    if (signedOut) return;
    const next = !engagement.bookmarked;
    void act({ ...engagement, bookmarked: next, bookmarks: engagement.bookmarks + (next ? 1 : -1) }, () =>
      setBookmarked(segment, id, next),
    );
  }

  function onReshare() {
    if (signedOut) return;
    if (engagement.reshared) {
      void act({ ...engagement, reshared: false, reshares: Math.max(0, engagement.reshares - 1) }, () => unreshare(segment, id));
      return;
    }
    setComposing((open) => !open);
  }

  function submitReshare() {
    const quote = commentary.trim();
    setComposing(false);
    setCommentary('');
    void act({ ...engagement, reshared: true, reshares: engagement.reshares + 1 }, () => reshare(segment, id, quote || null));
  }

  function onShare() {
    const href = WEB_HREF[segment]?.(id) ?? `/${segment}/${id}`;
    void Share.share({ url: `${WEB_URL}${href}`, message: `${WEB_URL}${href}` });
  }

  return (
    <View style={[styles.wrap, { borderTopColor: theme.border }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: engagement.liked, disabled: busy || signedOut }}
          accessibilityLabel={engagement.liked ? 'Unlike' : 'Like'}
          disabled={busy || signedOut}
          onPress={onLike}
          style={styles.button}>
          <Icon
            name={{ ios: engagement.liked ? 'heart.fill' : 'heart', android: 'favorite', web: 'favorite' }}
            size={19}
            color={engagement.liked ? theme.primaryStrong : theme.textSecondary}
          />
          <Count value={engagement.likes} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          onPress={() => router.push(`/comments/${segment}/${id}`)}
          style={styles.button}>
          <Icon name={{ ios: 'bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble' }} size={19} color={theme.textSecondary} />
          <Count value={engagement.comments} />
        </Pressable>

        {isMine ? (
          engagement.reshares > 0 && (
            <View style={styles.button}>
              <Icon name={{ ios: 'arrow.2.squarepath', android: 'repeat', web: 'repeat' }} size={19} color={theme.textSecondary} />
              <Count value={engagement.reshares} />
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: engagement.reshared, disabled: busy || signedOut }}
            accessibilityLabel={engagement.reshared ? 'Undo reshare' : 'Reshare'}
            disabled={busy || signedOut}
            onPress={onReshare}
            style={styles.button}>
            <Icon
              name={{ ios: 'arrow.2.squarepath', android: 'repeat', web: 'repeat' }}
              size={19}
              color={engagement.reshared ? theme.primaryStrong : theme.textSecondary}
            />
            <Count value={engagement.reshares} />
          </Pressable>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={onShare} style={styles.button}>
          <Icon name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={19} color={theme.textSecondary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: engagement.bookmarked, disabled: busy || signedOut }}
          accessibilityLabel={engagement.bookmarked ? 'Remove from saved' : 'Save'}
          disabled={busy || signedOut}
          onPress={onBookmark}
          style={[styles.button, styles.bookmark]}>
          <Icon
            name={{ ios: engagement.bookmarked ? 'bookmark.fill' : 'bookmark', android: 'bookmark', web: 'bookmark' }}
            size={19}
            color={engagement.bookmarked ? theme.accentStrong : theme.textSecondary}
          />
        </Pressable>

        {showViews && engagement.views > 0 && (
          <View style={styles.views}>
            <Icon name={{ ios: 'eye', android: 'visibility', web: 'visibility' }} size={17} color={theme.textSecondary} />
            <Count value={engagement.views} />
          </View>
        )}
      </View>

      {error && <ThemedText type="small" style={{ color: theme.danger, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two }}>{error}</ThemedText>}

      {composing && (
        <View style={[styles.composeBox, { borderTopColor: theme.border }]}>
          <TextInput
            value={commentary}
            onChangeText={setCommentary}
            placeholder="Say something about it, or leave this blank."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
            style={[styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          <View style={styles.composeRow}>
            <Pressable accessibilityRole="button" onPress={submitReshare} style={[styles.composeButton, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Reshare</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setComposing(false)} style={styles.composeButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// Fetches its own engagement rather than trusting a stale `initial` — for
// screens (post/reel detail) that were not handed one by a feed read.
export function useOwnEngagement(segment: SubjectSegment, id: string, fallback: Engagement) {
  const [engagement, setEngagement] = useState(fallback);
  useEffect(() => {
    getEngagement(segment, id).then(setEngagement).catch(() => undefined);
  }, [segment, id]);
  return engagement;
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, gap: 2 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: Spacing.two, justifyContent: 'center' },
  bookmark: { marginLeft: 'auto' },
  views: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.two },
  count: { fontVariant: ['tabular-nums'] },
  composeBox: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.two },
  textarea: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, minHeight: 60, fontSize: 15 },
  composeRow: { flexDirection: 'row', gap: Spacing.two },
  composeButton: { paddingHorizontal: Spacing.three, minHeight: 40, justifyContent: 'center', borderRadius: Spacing.two },
});
