import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { HasherPost, Page } from '@/lib/types';

// What hashers have written about this run (D60): posts they tagged to it. The API
// decides who may see each one and refuses the whole list for somebody who may not
// see the run, so this shows nothing at all in that case.
export function RunPosts({ runId }: { runId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<HasherPost[]>([]);

  useEffect(() => {
    let alive = true;
    api<Page<HasherPost>>(`/posts?runId=${runId}&limit=10`)
      .then((data) => alive && setPosts(data.items))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [runId, user]);

  if (posts.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <ThemedText type="subtitle">What hashers are saying</ThemedText>
      {posts.map((post) => (
        <ThemedView key={post.id} type="card" style={[styles.card, { borderColor: theme.border }]}>
          <View style={styles.pad}>
            <Pressable style={styles.row} accessibilityRole="link" onPress={() => router.push(`/hashers/${post.author.id}`)}>
              <Avatar name={post.author.name} src={post.author.avatarUrl} size={36} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{post.author.name}</ThemedText>
                {post.publishedAt ? <ThemedText type="small" themeColor="textSecondary">{formatDate(post.publishedAt)}</ThemedText> : null}
              </View>
            </Pressable>
            <RichText text={post.body} style={{ marginTop: Spacing.two }} />
            {post.poll ? <PollCard postId={post.id} initial={post.poll} /> : null}
            {post.linkPreview ? <LinkPreviewCard preview={post.linkPreview} /> : null}
          </View>
          <EngagementBar segment="posts" id={post.id} initial={post.engagement} authorId={post.author.id} />
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.three },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pad: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
