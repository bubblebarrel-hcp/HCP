import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PostDetail } from '@/components/feed/post-detail';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { countView } from '@/lib/social';
import type { HasherPost } from '@/lib/types';

// One post (D51), at its own address: the post card (see PostDetail), fetched with
// the signed-in session so a post from a locked profile opens for a follower and
// answers "not available" for anybody else. The API says 404 for "private" and
// "never existed" alike, and so does this screen.
export default function PostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<HasherPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ post: HasherPost }>(`/posts/${id}`);
      setPost(data.post);
      setState('ready');
      void countView('posts', id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState('unavailable');
      else {
        setError(errorMessage(err, 'Could not load this post'));
        setState('error');
      }
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          {state === 'loading' ? (
            <Skeleton height={384} />
          ) : state === 'ready' && post ? (
            <PostDetail post={post} />
          ) : (
            <Card style={styles.notFound}>
              <ThemedText style={styles.semibold}>{state === 'error' ? 'Could not load this post' : 'Not available'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={[styles.sm, styles.center]}>
                {state === 'error' ? error : 'It may belong to a private profile you do not follow yet, or it may not exist.'}
              </ThemedText>
              <Button variant="outline" style={styles.back} onPress={() => router.replace('/')}>Back to the feed</Button>
            </Card>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
  notFound: { padding: 32, alignItems: 'center', gap: 4 },
  back: { marginTop: 16 },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  center: { textAlign: 'center' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
