import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { normalizeTag } from '@/lib/entities';
import { formatDate } from '@/lib/format';
import type { HasherPost, Page, Reel } from '@/lib/types';

// Everything carrying a #hashtag (D59). What shows is what this viewer could see
// anywhere else: the API applies the same audience rules to a tag as to every
// other list, so a tag opens no door.
export default function TagScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  const tag = normalizeTag(raw ?? '');
  const [posts, setPosts] = useState<HasherPost[] | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tag) return;
    setError(null);
    try {
      const [p, r] = await Promise.all([
        api<Page<HasherPost>>(`/posts?limit=30&tag=${encodeURIComponent(tag)}`),
        api<Page<Reel>>(`/reels?limit=20&tag=${encodeURIComponent(tag)}`),
      ]);
      setPosts(p.items);
      setReels(r.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this tag'));
    }
  }, [tag]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, user]);

  if (!tag) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText themeColor="textSecondary">That is not a tag.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      {posts === null && !error ? (
        <ActivityIndicator color={theme.primary} style={styles.center} />
      ) : error ? (
        <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title" style={{ color: theme.primaryStrong }}>#{tag}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                What hashers have tagged with it. You see what you could see anywhere else.
              </ThemedText>
              {reels.length > 0 && (
                <View style={styles.reels}>
                  <ThemedText type="smallBold">Reels</ThemedText>
                  {reels.map((reel) => (
                    <Pressable
                      key={reel.id}
                      accessibilityRole="link"
                      onPress={() => router.push(`/reels/${reel.id}`)}
                      style={[styles.reelRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                      <Avatar name={reel.author.name} src={reel.author.avatarUrl} size={32} />
                      <View style={styles.flex}>
                        <ThemedText type="smallBold" numberOfLines={1}>{reel.author.name}</ThemedText>
                        {reel.caption ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{reel.caption}</ThemedText> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            reels.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.empty}>Nothing you can see is tagged #{tag} yet.</ThemedText>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.pad}>
                <Pressable style={styles.row} accessibilityRole="link" onPress={() => router.push(`/hashers/${item.author.id}`)}>
                  <Avatar name={item.author.name} src={item.author.avatarUrl} size={36} />
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{item.author.name}</ThemedText>
                    {item.publishedAt ? <ThemedText type="small" themeColor="textSecondary">{formatDate(item.publishedAt)}</ThemedText> : null}
                  </View>
                </Pressable>
                <RichText text={item.body} style={{ marginTop: Spacing.two }} />
                {item.poll ? <PollCard postId={item.id} initial={item.poll} /> : null}
                {item.linkPreview ? <LinkPreviewCard preview={item.linkPreview} /> : null}
              </View>
              <EngagementBar segment="posts" id={item.id} initial={item.engagement} authorId={item.author.id} />
            </ThemedView>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  list: { padding: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  header: { gap: Spacing.one, padding: Spacing.two, marginBottom: Spacing.two },
  reels: { gap: Spacing.two, marginTop: Spacing.three },
  reelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 12, padding: Spacing.two, minHeight: 48 },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pad: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  separator: { height: Spacing.two },
  empty: { textAlign: 'center', padding: Spacing.four },
});
