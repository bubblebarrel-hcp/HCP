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
import { REPORTABLE } from '@/lib/moderation';
import { REACTIONS, reactionLabel } from '@/lib/reactions';
import type { Engagement, ReactionKind, SubjectSegment } from '@/lib/types';

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
  // The hash reaction tray (D60): opened by a long press on the like button.
  const [tray, setTray] = useState(false);

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
    setTray(false);
    const next = !engagement.liked;
    const reactions = { ...engagement.reactions };
    if (next) reactions.ON_ON += 1;
    else if (engagement.myReaction) reactions[engagement.myReaction] = Math.max(0, reactions[engagement.myReaction] - 1);
    void act(
      { ...engagement, liked: next, likes: engagement.likes + (next ? 1 : -1), reactions, myReaction: next ? 'ON_ON' : null },
      () => setLiked(segment, id, next),
    );
  }

  // Choosing a reaction is a like with a kind (D60): the number of likes does not
  // change when a standing like is swapped for another.
  function onReact(kind: ReactionKind) {
    setTray(false);
    if (engagement.liked && engagement.myReaction === kind) {
      onLike();
      return;
    }
    const reactions = { ...engagement.reactions };
    if (engagement.myReaction) reactions[engagement.myReaction] = Math.max(0, reactions[engagement.myReaction] - 1);
    reactions[kind] += 1;
    void act(
      { ...engagement, liked: true, likes: engagement.liked ? engagement.likes : engagement.likes + 1, reactions, myReaction: kind },
      () => setLiked(segment, id, true, kind),
    );
  }

  const mineReaction = REACTIONS.find((r) => r.kind === engagement.myReaction);
  // The reactions people actually used, most used first. A phone has no hover
  // tooltip, so the counts are shown in a line under the bar (as on web, only
  // once more than one kind is in play).
  const used = REACTIONS.filter((r) => engagement.reactions[r.kind] > 0).sort(
    (a, b) => engagement.reactions[b.kind] - engagement.reactions[a.kind],
  );

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
          accessibilityLabel={engagement.liked ? `Remove ${reactionLabel(engagement.myReaction)}` : 'On On! (like). Hold for more reactions.'}
          accessibilityHint="Hold to choose a reaction"
          disabled={busy || signedOut}
          onPress={onLike}
          onLongPress={() => setTray((open) => !open)}
          delayLongPress={350}
          style={styles.button}>
          {mineReaction?.emoji ? (
            <ThemedText style={styles.emoji}>{mineReaction.emoji}</ThemedText>
          ) : (
            <Icon
              name={{ ios: engagement.liked ? 'heart.fill' : 'heart', android: 'favorite', web: 'favorite' }}
              size={19}
              color={engagement.liked ? theme.primaryStrong : theme.textSecondary}
            />
          )}
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

        {/* Telling the people who look after Shiggy Trails (D61). Not on a trail
            report, a run or a capsule, and not on your own. */}
        {!signedOut && !isMine && REPORTABLE[segment] && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report"
            onPress={() => router.push({ pathname: '/report/[type]/[id]', params: { type: REPORTABLE[segment]!, id, ...(authorId ? { by: authorId } : {}) } })}
            style={styles.button}>
            <Icon name={{ ios: 'flag', android: 'flag', web: 'flag' }} size={18} color={theme.textSecondary} />
          </Pressable>
        )}

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

      {used.length > 1 && (
        <View
          style={styles.reactionCounts}
          accessible
          accessibilityLabel={used.map((r) => `${r.label} ${engagement.reactions[r.kind]}`).join(', ')}>
          {used.map((r) => (
            <View key={r.kind} style={styles.reactionCount}>
              {r.emoji ? (
                <ThemedText style={styles.emojiSmall}>{r.emoji}</ThemedText>
              ) : (
                <Icon name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={13} color={theme.primaryStrong} />
              )}
              <Count value={engagement.reactions[r.kind]} />
            </View>
          ))}
        </View>
      )}

      {tray && !signedOut && (
        <View style={[styles.tray, { backgroundColor: theme.card, borderColor: theme.border }]} accessibilityLabel="Reactions">
          {REACTIONS.map((r) => (
            <Pressable
              key={r.kind}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              onPress={() => onReact(r.kind)}
              style={[styles.trayButton, engagement.myReaction === r.kind && { backgroundColor: theme.backgroundSelected }]}>
              {r.emoji ? (
                <ThemedText style={styles.emoji}>{r.emoji}</ThemedText>
              ) : (
                <Icon name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} size={22} color={theme.primaryStrong} />
              )}
            </Pressable>
          ))}
        </View>
      )}

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
  emoji: { fontSize: 18, lineHeight: 22 },
  emojiSmall: { fontSize: 13, lineHeight: 18 },
  reactionCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
  reactionCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tray: { flexDirection: 'row', gap: Spacing.one, alignSelf: 'flex-start', marginLeft: Spacing.two, marginBottom: Spacing.one, borderWidth: 1, borderRadius: 999, padding: Spacing.one },
  trayButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  composeBox: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.two },
  textarea: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, minHeight: 60, fontSize: 15 },
  composeRow: { flexDirection: 'row', gap: Spacing.two },
  composeButton: { paddingHorizontal: Spacing.three, minHeight: 40, justifyContent: 'center', borderRadius: Spacing.two },
});
