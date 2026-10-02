import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { AudienceChips } from '@/components/profile/audience-chips';
import { EngagementBar } from '@/components/social/engagement-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api, errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { countView } from '@/lib/social';
import type { Audience, HasherPost } from '@/lib/types';

// One post (D51), at its own screen: the full words, every photo, the numbers,
// and for its author, who may read it (D57).
//
// It is fetched with the signed-in session, so a post from a locked profile opens
// for a follower and answers "not available" for anybody else, exactly as the web
// page does. The API says 404 for "private" and "never existed" alike, and so
// does this screen.

export default function PostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<HasherPost | null>(null);
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const content = Math.min(width, MaxContentWidth) - Spacing.three * 2;

  const load = useCallback(async () => {
    try {
      const data = await api<{ post: HasherPost }>(`/posts/${id}`);
      setPost(data.post);
      setAudience(data.post.visibility);
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
    load();
  }, [load]);

  async function changeAudience(next: Audience) {
    const before = audience;
    setAudience(next);
    setSaving(true);
    setNote(null);
    try {
      await api(`/posts/${id}`, { method: 'PATCH', body: { visibility: next } });
      setNote('Who can see this post is updated.');
    } catch (err) {
      setAudience(before);
      setNote(errorMessage(err, 'Could not change who can see it'));
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (state === 'unavailable' || state === 'error' || !post) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText type="subtitle" style={styles.centerText}>
          {state === 'error' ? 'Could not load this post' : 'Not available'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          {state === 'error'
            ? error
            : 'It may belong to a private profile you do not follow yet, or it may not exist.'}
        </ThemedText>
      </ThemedView>
    );
  }

  const many = post.photos.length > 1;
  const tile = (content - 2) / 2;

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.padded}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${post.author.name}'s profile`}
              onPress={() => router.push(`/hashers/${post.author.id}`)}
              style={styles.author}>
              <Avatar
                name={post.author.name}
                size={44}
                src={post.author.avatarUrl}
                color={brandColor(post.kennel?.primaryColor)}
              />
              <View style={styles.authorText}>
                <ThemedText type="smallBold" numberOfLines={1}>{post.author.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {post.publishedAt ? formatDate(post.publishedAt) : ''}
                  {post.editedAt ? ' · edited' : ''}
                  {post.kennel ? ` · ${post.kennel.shortName}` : ''}
                </ThemedText>
              </View>
            </Pressable>
            {post.body ? <ThemedText style={styles.body}>{post.body}</ThemedText> : null}
          </View>

          {post.photos.length > 0 && (
            <View style={many ? styles.photoGrid : undefined}>
              {post.photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.url }}
                  style={many ? { width: tile, height: tile } : { width: content, height: content * 0.8 }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ))}
            </View>
          )}

          {post.run && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/run/${post.run!.id}`)}
              style={styles.runLink}>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
                Run #{post.run.runNumber ?? '—'}
                {post.run.title ? ` · ${post.run.title}` : ''}
              </ThemedText>
            </Pressable>
          )}

          <EngagementBar segment="posts" id={post.id} initial={post.engagement} authorId={post.author.id} />
        </View>

        {post.isMine && (
          <View style={styles.owner}>
            <AudienceChips what="post" value={audience} onChange={(next) => void changeAudience(next)} disabled={saving} />
            {note && <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  centerText: { textAlign: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  card: { borderRadius: Spacing.three, overflow: 'hidden' },
  padded: { padding: Spacing.three, gap: Spacing.two },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  authorText: { flex: 1, minWidth: 0 },
  body: { fontSize: 17, lineHeight: 25 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  runLink: { padding: Spacing.three, minHeight: 44, justifyContent: 'center' },
  owner: { gap: Spacing.one, paddingHorizontal: Spacing.one },
});
