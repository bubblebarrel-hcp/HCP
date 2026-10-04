import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { MentionInput } from '@/components/social/mention-input';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { addComment, listComments } from '@/lib/social';
import { errorMessage } from '@/lib/api';
import type { CommentThreadItem, ContentComment, SubjectSegment } from '@/lib/types';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function CommentRow({ comment, reply }: { comment: ContentComment; reply?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const gone = comment.status !== 'VISIBLE';
  return (
    <View style={[styles.commentRow, reply && styles.replyRow]}>
      <Avatar name={comment.author?.name ?? 'Removed'} size={reply ? 28 : 34} />
      <View style={styles.commentBody}>
        <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{comment.author?.name ?? 'A hasher'}</ThemedText>
          {gone ? (
            <ThemedText style={{ color: theme.textSecondary, fontStyle: 'italic' }}>
              {comment.status === 'DELETED' ? 'Comment deleted' : 'Comment removed'}
            </ThemedText>
          ) : (
            <RichText text={comment.body ?? ''} />
          )}
        </View>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary">{timeAgo(comment.createdAt)}</ThemedText>
          {comment.editedAt ? <ThemedText type="small" themeColor="textSecondary">· edited</ThemedText> : null}
          {comment.likes > 0 ? <ThemedText type="small" themeColor="textSecondary">· {comment.likes} likes</ThemedText> : null}
          {user && !gone && comment.author && comment.author.id !== user.id ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/report/[type]/[id]', params: { type: 'COMMENT', id: comment.id, by: comment.author!.id } })}>
              · Report
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CommentsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { segment, id } = useLocalSearchParams<{ segment: SubjectSegment; id: string }>();
  const [items, setItems] = useState<CommentThreadItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listComments(segment, id, 1);
      setItems(data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load comments'));
    }
  }, [segment, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function submit() {
    const value = body.trim();
    if (!value) return;
    setBusy(true);
    setBody('');
    try {
      await addComment(segment, id, value);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not post that comment'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          {items === null ? (
            <ActivityIndicator color={theme.primary} style={styles.center} />
          ) : error ? (
            <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <ThemedText themeColor="textSecondary" style={styles.center}>No comments yet. Say something.</ThemedText>
              }
              renderItem={({ item }) => (
                <View>
                  <CommentRow comment={item} />
                  {item.replies.map((r) => <CommentRow key={r.id} comment={r} reply />)}
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}

          {user ? (
            <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
              <MentionInput
                value={body}
                onChangeText={setBody}
                suggestionsAbove
                placeholder="Add a comment… @ to mention"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !body.trim()}
                onPress={submit}
                style={[styles.sendButton, { backgroundColor: theme.primary, opacity: busy || !body.trim() ? 0.5 : 1 }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Post</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
              <ThemedText themeColor="textSecondary">Log in to comment.</ThemedText>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  list: { padding: Spacing.three, gap: 0, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  separator: { height: Spacing.two },
  commentRow: { flexDirection: 'row', gap: Spacing.two },
  replyRow: { marginLeft: Spacing.five, marginTop: Spacing.two },
  commentBody: { flex: 1, minWidth: 0, gap: 2 },
  bubble: { borderRadius: 14, padding: Spacing.two, gap: 2 },
  metaRow: { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.one },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, borderTopWidth: 1, padding: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, maxHeight: 100, fontSize: 15 },
  sendButton: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
