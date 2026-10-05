import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PostDetail } from '@/components/feed/post-detail';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import type { HasherPost, Page } from '@/lib/types';

// What hashers have written about this run (D60): posts they tagged to it, drawn as
// the web does (components/runs/RunPosts.tsx): a heading, then each as a full post
// card. The API decides who may see each one and refuses the whole list for somebody
// who may not see the run, so this shows nothing at all in that case.
export function RunPosts({ runId }: { runId: string }) {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<HasherPost[]>([]);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<Page<HasherPost>>(`/posts?runId=${runId}&limit=10`)
      .then((data) => alive && setPosts(data.items))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [runId, user, loading]);

  if (posts.length === 0) return null;
  return (
    <View style={styles.wrap} testID="run-posts">
      <ThemedText accessibilityRole="header" style={styles.heading}>What hashers are saying</ThemedText>
      {posts.map((post) => (
        <PostDetail key={post.id} post={post} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // space-y-3
  wrap: { gap: 12 },
  heading: { paddingHorizontal: 16, fontSize: 18, lineHeight: 28, fontWeight: '600' },
});
