import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { PostActions } from '@/components/feed/post-actions';
import { PostMedia } from '@/components/feed/post-media';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { ExpandableText } from '@/components/social/expandable-text';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { emitFeedRefresh } from '@/lib/feed-refresh';
import { brandColor, formatDate } from '@/lib/format';
import type { Audience, HasherPost } from '@/lib/types';

// One post as its own page shows it (web components/feed/PostDetail.tsx): the
// author and kennel, the words, the poll and link preview, every photo, the run it
// is about, who can read it (for its author) and the engagement bar. Used by the
// post screen and by the hashtag page, as the web does.

const AUDIENCES = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'FOLLOWERS', label: 'Followers' },
  { value: 'ONLY_ME', label: 'Only me' },
];

// One post of a page. On a post's own screen the words are whole; where posts are
// stacked in a list, `clamp` cuts a long one short with "Read more". A thread is
// the first post and then each part under it; a part has its own likes and
// conversation but no audience of its own.
function PostCard({
  post,
  clamp,
  part,
}: {
  post: HasherPost;
  clamp: boolean;
  // Set on the posts after the first in a thread: their place, "2 of 5".
  part?: { number: number; of: number };
}) {
  const theme = useTheme();
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(post.visibility);
  const [saving, setSaving] = useState(false);
  // An author's own edit or delete shows at once, without reloading the screen.
  const [gone, setGone] = useState(false);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const bodyText = editedBody ?? post.body;

  async function changeAudience(next: Audience) {
    const before = audience;
    setAudience(next);
    setSaving(true);
    try {
      await api(`/posts/${post.id}`, { method: 'PATCH', body: { visibility: next } });
    } catch (err) {
      setAudience(before);
      Alert.alert('Could not change who can see it', errorMessage(err, 'Could not change who can see it'));
    } finally {
      setSaving(false);
    }
  }

  if (gone) return null;

  return (
    <Card style={[styles.overflow, part && { borderLeftWidth: 4, borderLeftColor: theme.primary }]}>
      <View testID={part ? 'post-thread-part' : 'post-page'}>
        <PostActions
          id={post.id}
          authorId={post.author.id}
          body={bodyText}
          threadCount={part ? 0 : post.threadCount}
          onEdited={(body) => {
            setEditedBody(body);
            emitFeedRefresh();
          }}
          onDeleted={() => {
            emitFeedRefresh();
            // On its own screen the first post is the page: leave it. Anywhere else
            // (a list, a later part of a thread) just take the card away.
            if (!part && !clamp) router.replace('/');
            else setGone(true);
          }}
        />
        <View style={styles.padded}>
          <View style={styles.author}>
            <Avatar name={post.author.name} size={40} src={post.author.avatarUrl} color={brandColor(post.kennel?.primaryColor)} />
            <View style={styles.authorText}>
              <ThemedText style={styles.sm}>
                <ThemedText style={[styles.sm, styles.medium]} onPress={() => router.push(`/hashers/${post.author.id}`)}>
                  {post.author.name}
                </ThemedText>
                {post.kennel ? (
                  <>
                    {' · '}
                    <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={() => router.push(`/kennels/${post.kennel!.slug}`)}>
                      {post.kennel.shortName}
                    </ThemedText>
                  </>
                ) : null}
              </ThemedText>
              {post.publishedAt ? (
                <ThemedText themeColor="textSecondary" style={styles.sm}>
                  {formatDate(post.publishedAt)}
                  {post.editedAt || editedBody !== null ? ' · edited' : ''}
                  {part ? ` · ${part.number} of ${part.of}` : ''}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {clamp ? (
            <ExpandableText text={bodyText} style={styles.body} testID="post-body" />
          ) : (
            <RichText text={bodyText} style={styles.body} testID="post-body" />
          )}
          {post.poll ? <PollCard postId={post.id} initial={post.poll} /> : null}
          {post.linkPreview ? <LinkPreviewCard preview={post.linkPreview} /> : null}
        </View>

        <PostMedia items={post.photos} tallest={640} />

        {/* In a list the whole chain is behind the first post. */}
        {!part && !post.thread?.length && post.threadCount > 0 && (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/posts/${post.id}`)} style={styles.runLink}>
            <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
              Thread · {post.threadCount} more {post.threadCount === 1 ? 'post' : 'posts'}
            </ThemedText>
          </Pressable>
        )}

        {post.run && !part && (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${post.run!.id}`)} style={styles.runLink}>
            <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
              Run #{post.run.runNumber ?? '—'}
              {post.run.title ? ` · ${post.run.title}` : ''}
            </ThemedText>
          </Pressable>
        )}

        {post.isMine && !part && (
          <View testID="audience-control" style={[styles.audience, { borderTopColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.sm}>Who can read it</ThemedText>
            <View style={styles.select}>
              <Select value={audience} onChange={(next) => !saving && void changeAudience(next as Audience)} options={AUDIENCES} />
            </View>
          </View>
        )}

        <EngagementBar segment="posts" id={post.id} initial={post.engagement} authorId={post.author.id} />
      </View>
    </Card>
  );
}

export function PostDetail({ post, clamp = false }: { post: HasherPost; clamp?: boolean }) {
  const parts = post.thread ?? [];
  if (parts.length === 0) return <PostCard post={post} clamp={clamp} />;

  return (
    <View style={styles.thread} testID="post-thread">
      <PostCard post={post} clamp={false} />
      {parts.map((part, index) => (
        <PostCard key={part.id} post={part} clamp={false} part={{ number: index + 2, of: parts.length + 1 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overflow: { overflow: 'hidden' },
  thread: { gap: 4 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  medium: { fontWeight: '500' },
  padded: { padding: 16 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorText: { flex: 1, minWidth: 0 },
  body: { marginTop: 12, fontSize: 15, lineHeight: 24, fontWeight: '400' },
  runLink: { paddingHorizontal: 16, paddingVertical: 12 },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  select: { width: 150 },
});
