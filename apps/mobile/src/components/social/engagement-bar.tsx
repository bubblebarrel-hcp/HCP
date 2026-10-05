import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { Bookmark, Eye, Flag, Heart, MessageCircle, Repeat2, Share2, SmilePlus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { CommentThread } from '@/components/social/comment-thread';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/api';
import { REPORTABLE } from '@/lib/moderation';
import { REACTIONS, reactionLabel } from '@/lib/reactions';
import { countView, getEngagement, reshare, setBookmarked, setLiked, unreshare } from '@/lib/social';
import type { Engagement, ReactionKind, SubjectSegment } from '@/lib/types';

// The bar under a piece of content: like with a tray of hash reactions, comment,
// reshare, share, report, save and seen (D50), laid out as the web draws it
// (components/social/EngagementBar.tsx): a hairline above, 16pt icons with their
// counts, save on the far right, the reaction counts under the row, and the
// "Pass it on" box for a quote reshare. Optimistic press, reconciled with the
// server's own number. Comments open as the inline thread under the bar, as on
// the web.

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return <ThemedText style={styles.count}>{value > 999 ? `${(value / 1000).toFixed(1)}k` : value}</ThemedText>;
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
  countViewOnMount = false,
}: {
  segment: SubjectSegment;
  id: string;
  initial: Engagement;
  authorId?: string | null;
  showViews?: boolean;
  // Count this as a view when it appears (a detail screen, not a feed row).
  countViewOnMount?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [engagement, setEngagement] = useState(initial);
  const [composing, setComposing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The hash reaction tray (D60).
  const [tray, setTray] = useState(false);

  useEffect(() => {
    if (countViewOnMount) void countView(segment, id);
  }, [countViewOnMount, segment, id]);

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

  const mine = REACTIONS.find((r) => r.kind === engagement.myReaction);
  // The reactions people actually used, most used first.
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

  const muted = theme.textSecondary;
  const likedColor = theme.primaryStrong;

  return (
    <View style={[styles.wrap, { borderTopColor: theme.border }]} testID="engagement-bar">
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: engagement.liked, disabled: busy || signedOut }}
          accessibilityLabel={engagement.liked ? `Remove ${reactionLabel(engagement.myReaction)}` : 'On On! (like)'}
          disabled={busy || signedOut}
          onPress={onLike}
          onLongPress={() => !signedOut && setTray((open) => !open)}
          delayLongPress={350}
          testID="engagement-like"
          style={[styles.button, (busy || signedOut) && styles.disabled]}>
          {mine?.emoji ? (
            <ThemedText style={styles.emoji}>{mine.emoji}</ThemedText>
          ) : (
            <Heart size={16} color={engagement.liked ? likedColor : theme.text} fill={engagement.liked ? likedColor : 'none'} />
          )}
          <Count value={engagement.likes} />
        </Pressable>
        {!signedOut && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a reaction"
            accessibilityState={{ expanded: tray }}
            testID="reaction-toggle"
            onPress={() => setTray((open) => !open)}
            style={styles.toggle}>
            <SmilePlus size={16} color={muted} />
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          accessibilityState={{ expanded: showComments }}
          testID="engagement-comment"
          onPress={() => setShowComments((open) => !open)}
          style={styles.button}>
          <MessageCircle size={16} color={theme.text} />
          <Count value={engagement.comments} />
        </Pressable>

        {/* Resharing your own post is refused by the API, so it is not offered. */}
        {isMine ? (
          engagement.reshares > 0 && (
            <View style={styles.button}>
              <Repeat2 size={16} color={muted} />
              <Count value={engagement.reshares} />
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: engagement.reshared, disabled: busy || signedOut }}
            accessibilityLabel={engagement.reshared ? 'Undo reshare' : 'Reshare'}
            disabled={busy || signedOut}
            testID="engagement-reshare"
            onPress={onReshare}
            style={[styles.button, (busy || signedOut) && styles.disabled]}>
            <Repeat2 size={16} color={engagement.reshared ? theme.trail : theme.text} />
            <Count value={engagement.reshares} />
          </Pressable>
        )}

        <Pressable accessibilityRole="button" accessibilityLabel="Share" testID="engagement-share" onPress={onShare} style={styles.button}>
          <Share2 size={16} color={theme.text} />
        </Pressable>

        {/* Telling the people who look after Shiggy Trails (D61). Not on a trail
            report, a run or a capsule, and not on your own. */}
        {!signedOut && !isMine && REPORTABLE[segment] && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report"
            testID="engagement-report"
            onPress={() =>
              router.push({ pathname: '/report/[type]/[id]', params: { type: REPORTABLE[segment]!, id, ...(authorId ? { by: authorId } : {}) } })
            }
            style={styles.button}>
            <Flag size={16} color={theme.text} />
          </Pressable>
        )}

        <View style={styles.spacer} />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: engagement.bookmarked, disabled: busy || signedOut }}
          accessibilityLabel={engagement.bookmarked ? 'Remove from saved' : 'Save'}
          disabled={busy || signedOut}
          testID="engagement-bookmark"
          onPress={onBookmark}
          style={[styles.button, (busy || signedOut) && styles.disabled]}>
          <Bookmark
            size={16}
            color={engagement.bookmarked ? theme.accentStrong : theme.text}
            fill={engagement.bookmarked ? theme.accentStrong : 'none'}
          />
        </Pressable>

        {showViews && engagement.views > 0 && (
          <View style={styles.button}>
            <Eye size={16} color={muted} />
            <Count value={engagement.views} />
          </View>
        )}
      </View>

      {tray && !signedOut && (
        <View style={[styles.tray, { backgroundColor: theme.card, borderColor: theme.border }]} accessibilityLabel="Reactions">
          {REACTIONS.map((r) => (
            <Pressable
              key={r.kind}
              accessibilityRole="menuitem"
              accessibilityLabel={r.label}
              testID={`reaction-${r.kind}`}
              onPress={() => onReact(r.kind)}
              style={[
                styles.trayButton,
                engagement.myReaction === r.kind && { backgroundColor: theme.backgroundElement, borderWidth: 2, borderColor: theme.primary },
              ]}>
              {r.emoji ? (
                <ThemedText style={styles.trayEmoji}>{r.emoji}</ThemedText>
              ) : (
                <Heart size={20} color={likedColor} fill={likedColor} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* What people reacted with, once more than one kind is in play. */}
      {used.length > 1 && (
        <View
          style={styles.reactionCounts}
          accessible
          testID="reaction-counts"
          accessibilityLabel={used.map((r) => `${r.label} ${engagement.reactions[r.kind]}`).join(', ')}>
          {used.map((r) => (
            <View key={r.kind} style={styles.reactionCount}>
              {r.emoji ? (
                <ThemedText style={styles.emojiSmall}>{r.emoji}</ThemedText>
              ) : (
                <Heart size={14} color={likedColor} fill={likedColor} />
              )}
              <ThemedText themeColor="textSecondary" style={styles.xs}>{engagement.reactions[r.kind]}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {error ? <ThemedText style={[styles.errorText, { color: theme.danger }]}>{error}</ThemedText> : null}

      {composing && (
        <View style={[styles.compose, { borderTopColor: theme.border }]}>
          <ThemedText style={styles.composeLabel}>Pass it on</ThemedText>
          <TextInput
            value={commentary}
            onChangeText={setCommentary}
            placeholder="Say something about it, or leave this blank."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
            testID="reshare-commentary"
            style={[styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <View style={styles.composeRow}>
            <Button size="sm" disabled={busy} testID="reshare-submit" onPress={submitReshare}>Reshare</Button>
            <Button size="sm" variant="ghost" onPress={() => setComposing(false)}>Cancel</Button>
          </View>
        </View>
      )}

      {showComments && (
        <CommentThread
          segment={segment}
          id={id}
          onCountChange={(comments) => setEngagement((current) => ({ ...current, comments }))}
        />
      )}
    </View>
  );
}

// Fetches its own engagement rather than trusting a stale `initial`, for screens
// (post/reel detail) that were not handed one by a feed read.
export function useOwnEngagement(segment: SubjectSegment, id: string, fallback: Engagement) {
  const [engagement, setEngagement] = useState(fallback);
  useEffect(() => {
    getEngagement(segment, id).then(setEngagement).catch(() => undefined);
  }, [segment, id]);
  return engagement;
}

const styles = StyleSheet.create({
  // border-t border-border
  wrap: { borderTopWidth: 1 },
  // flex items-center gap-1 px-2 py-1
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  // inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, minHeight: 40, borderRadius: 6 },
  toggle: { paddingHorizontal: 4, paddingVertical: 6, minHeight: 40, minWidth: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  disabled: { opacity: 0.5 },
  spacer: { flex: 1 },
  count: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontVariant: ['tabular-nums'] },
  emoji: { fontSize: 16, lineHeight: 20 },
  emojiSmall: { fontSize: 12, lineHeight: 16 },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400', fontVariant: ['tabular-nums'] },
  tray: { flexDirection: 'row', gap: 4, alignSelf: 'flex-start', marginLeft: 8, marginBottom: 4, borderWidth: 1, borderRadius: 999, padding: 4 },
  trayButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  trayEmoji: { fontSize: 20, lineHeight: 24 },
  // flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-1.5 text-xs
  reactionCounts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, paddingHorizontal: 16, paddingBottom: 6 },
  reactionCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  compose: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  composeLabel: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  textarea: { minHeight: 56, borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 15, textAlignVertical: 'top' },
  composeRow: { marginTop: 4, flexDirection: 'row', gap: 8 },
});
