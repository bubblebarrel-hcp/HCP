import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
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

export function PostDetail({ post }: { post: HasherPost }) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [audience, setAudience] = useState<Audience>(post.visibility);
  const [saving, setSaving] = useState(false);

  const content = Math.min(width, MaxContentWidth);
  const many = post.photos.length > 1;
  const tile = (content - 2) / 2;

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

  return (
    <Card style={styles.overflow}>
      <View testID="post-page">
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
                  {post.editedAt ? ' · edited' : ''}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <RichText text={post.body} style={styles.body} testID="post-body" />
          {post.poll ? <PollCard postId={post.id} initial={post.poll} /> : null}
          {post.linkPreview ? <LinkPreviewCard preview={post.linkPreview} /> : null}
        </View>

        {post.photos.length > 0 && (
          <View style={many ? styles.photoGrid : undefined}>
            {post.photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.url }}
                style={[
                  { backgroundColor: theme.backgroundElement },
                  many ? { width: tile, height: tile } : { width: content, height: Math.min(content * 1.25, 640) },
                ]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ))}
          </View>
        )}

        {post.run && (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${post.run!.id}`)} style={styles.runLink}>
            <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
              Run #{post.run.runNumber ?? '—'}
              {post.run.title ? ` · ${post.run.title}` : ''}
            </ThemedText>
          </Pressable>
        )}

        {post.isMine && (
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

const styles = StyleSheet.create({
  overflow: { overflow: 'hidden' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  medium: { fontWeight: '500' },
  padded: { padding: 16 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorText: { flex: 1, minWidth: 0 },
  body: { marginTop: 12, fontSize: 15, lineHeight: 24, fontWeight: '400' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  runLink: { paddingHorizontal: 16, paddingVertical: 12 },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  select: { width: 150 },
});
