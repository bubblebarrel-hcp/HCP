import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Hash } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';

import { PostDetail } from '@/components/feed/post-detail';
import { ReelsGrid } from '@/components/feed/reels-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { normalizeTag } from '@/lib/entities';
import type { HasherPost, Page, Reel } from '@/lib/types';

// Everything carrying a #hashtag (D59), as the web lays it out
// (app/tags/[tag]/page.tsx): a header card with the hash in a tinted circle, then
// the posts as full post cards, then the reels grid. What shows is what this
// viewer could see anywhere else: the API applies the same audience rules to a
// tag as to every other list, so a tag opens no door.
export default function TagScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  const tag = normalizeTag(raw ?? '');
  const [posts, setPosts] = useState<HasherPost[] | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);

  useEffect(() => {
    if (!tag) return;
    let alive = true;
    Promise.all([
      api<Page<HasherPost>>(`/posts?limit=30&tag=${encodeURIComponent(tag)}`),
      api<Page<Reel>>(`/reels?limit=30&tag=${encodeURIComponent(tag)}`),
    ])
      .then(([p, r]) => {
        if (!alive) return;
        setPosts(p.items);
        setReels(r.items);
      })
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [tag, user]);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (!tag) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText style={styles.semibold}>That is not a tag.</ThemedText>
      </Card>,
    );
  }

  const nothing = posts !== null && posts.length === 0 && reels.length === 0;

  return shell(
    <>
      <Card style={styles.intro}>
        <View style={[styles.hash, { backgroundColor: theme.primary + '1a' }]}>
          <Hash size={24} color={theme.primaryStrong} />
        </View>
        <View style={styles.introText}>
          <ThemedText numberOfLines={1} accessibilityRole="header" testID="tag-title" style={styles.h1}>#{tag}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.sm}>
            What hashers have tagged with it. You see what you could see anywhere else on Shiggy Trails.
          </ThemedText>
        </View>
      </Card>

      {posts === null ? (
        <Skeleton height={256} />
      ) : (
        <View style={styles.results} testID="tag-results">
          {posts.map((post) => (
            <PostDetail key={post.id} post={post} />
          ))}

          {(reels.length > 0 || user) && (
            <ReelsGrid
              reels={reels}
              emptyText={posts.length > 0 ? 'No reels carry this tag right now. Reels last a day.' : undefined}
            />
          )}

          {nothing && !user && (
            <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]} testID="tag-empty">
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>Nothing public is tagged #{tag} yet.</ThemedText>
            </View>
          )}
        </View>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  notFound: { padding: 32, alignItems: 'center' },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  intro: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hash: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, minWidth: 0 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  results: { gap: 16 },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '400' },
});
