import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { MentionInput } from '@/components/social/mention-input';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { REPORTABLE } from '@/lib/moderation';
import { addComment, deleteComment, editComment, getEngagement, listComments, listReplies, removeComment, setLiked } from '@/lib/social';
import type { CommentThreadItem, ContentComment, SubjectSegment } from '@/lib/types';

// The conversation under a piece of content (D50), laid out inline as the web does
// (components/social/CommentThread.tsx). Two levels: comments, and replies to them. A
// reply to a reply lands under the same root, which the API enforces, so this never has
// to recurse. A withdrawn or removed comment keeps its place so the replies under it
// are not orphaned, and says so rather than saying nothing.

function Composer({
  placeholder,
  submitLabel,
  initial = '',
  busy,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  placeholder: string;
  submitLabel: string;
  initial?: string;
  busy: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  const [body, setBody] = useState(initial);
  const ready = body.trim().length > 0;

  return (
    <View style={styles.flex}>
      <MentionInput
        value={body}
        onChangeText={setBody}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={2000}
        autoFocus={autoFocus}
        testID="comment-input"
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
      <View style={styles.composerRow}>
        <Button
          size="sm"
          disabled={!ready || busy}
          testID="comment-submit"
          onPress={() => {
            onSubmit(body.trim());
            setBody('');
          }}>
          {submitLabel}
        </Button>
        {onCancel ? <Button size="sm" variant="ghost" onPress={onCancel}>Cancel</Button> : null}
      </View>
    </View>
  );
}

function CommentRow({
  comment,
  canModerate,
  onReply,
  onChanged,
  onRemoved,
  depth = 0,
}: {
  comment: ContentComment;
  canModerate: boolean;
  onReply?: () => void;
  onChanged: (next: ContentComment) => void;
  onRemoved: (id: string) => void;
  depth?: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gone = comment.status !== 'VISIBLE';

  async function toggleLike() {
    const next = !comment.liked;
    onChanged({ ...comment, liked: next, likes: comment.likes + (next ? 1 : -1) });
    try {
      await setLiked('comments', comment.id, next);
    } catch {
      onChanged(comment);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      await deleteComment(comment.id);
      onChanged({ ...comment, status: 'DELETED', body: null, author: null });
      onRemoved(comment.id);
    } catch (err) {
      setError(errorMessage(err, 'Could not withdraw that.'));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      await removeComment(comment.id, reason);
      onChanged({ ...comment, status: 'REMOVED', body: null, author: null });
      onRemoved(comment.id);
    } catch (err) {
      setError(errorMessage(err, 'Could not take that down.'));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const link = (label: string, onPress: () => void, testID?: string, danger?: boolean) => (
    <Pressable accessibilityRole="link" testID={testID} onPress={onPress} hitSlop={8} disabled={busy}>
      <ThemedText style={[styles.meta, danger ? { color: theme.danger } : { color: theme.textSecondary }]}>{label}</ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.row, depth > 0 && styles.reply]} testID="comment">
      <Avatar name={comment.author?.name ?? 'Hash'} size={32} src={comment.author?.avatarUrl ?? null} />
      <View style={styles.flex}>
        {gone ? (
          <ThemedText themeColor="textSecondary" style={styles.gone}>
            {comment.status === 'REMOVED' ? 'A moderator took this comment down.' : 'This comment was withdrawn.'}
          </ThemedText>
        ) : editing ? (
          <Composer
            placeholder="Say something."
            submitLabel="Save"
            initial={comment.body ?? ''}
            busy={busy}
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              setBusy(true);
              try {
                onChanged(await editComment(comment.id, body));
                setEditing(false);
              } catch (err) {
                setError(errorMessage(err, 'Could not save that.'));
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <>
            <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
              {comment.author ? (
                <ThemedText accessibilityRole="link" onPress={() => router.push(`/hashers/${comment.author!.id}`)} style={styles.author}>
                  {comment.author.name}
                </ThemedText>
              ) : (
                <ThemedText style={styles.author}>A hasher</ThemedText>
              )}
              <RichText text={comment.body ?? ''} style={styles.body} />
            </View>
            <View style={styles.metaRow}>
              <ThemedText themeColor="textSecondary" style={styles.meta}>{formatDate(comment.createdAt)}</ThemedText>
              {comment.editedAt ? <ThemedText themeColor="textSecondary" style={styles.meta}>edited</ThemedText> : null}
              {user ? (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: comment.liked }} testID="comment-like" onPress={() => void toggleLike()} hitSlop={8} style={styles.like}>
                  <Heart size={12} color={comment.liked ? theme.primaryStrong : theme.textSecondary} fill={comment.liked ? theme.primaryStrong : 'none'} />
                  <ThemedText style={[styles.meta, { color: comment.liked ? theme.primaryStrong : theme.textSecondary, fontWeight: comment.liked ? '500' : '400' }]}>
                    {comment.likes > 0 ? String(comment.likes) : 'Like'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {onReply && user ? link('Reply', onReply, 'comment-reply') : null}
              {comment.isMine ? (
                <>
                  {link('Edit', () => setEditing(true))}
                  <ActionDialog
                    title="Withdraw this comment?"
                    description="The words go; its place in the thread stays, so the replies under it are not orphaned. This cannot be undone."
                    confirmLabel="Withdraw"
                    destructive
                    onConfirm={withdraw}
                    trigger={(open) => link('Withdraw', open)}
                  />
                </>
              ) : null}
              {user && !comment.isMine && comment.author
                ? link(
                    'Report',
                    () =>
                      router.push({
                        pathname: '/report/[type]/[id]',
                        params: { type: REPORTABLE.comments ?? 'COMMENT', id: comment.id, by: comment.author!.id },
                      }),
                    'comment-report',
                  )
                : null}
              {canModerate && !comment.isMine ? (
                <ActionDialog
                  title="Take this comment down?"
                  description="A moderator’s removal is written to the audit log with the reason. The row stays; the words go."
                  confirmLabel="Take it down"
                  destructive
                  text={{ label: 'Reason', required: true, hint: 'Written to the audit log.', marked: true }}
                  onConfirm={(values) => takeDown(values.text)}
                  trigger={(open) => link('Take down', open, undefined, true)}
                />
              ) : null}
            </View>
          </>
        )}
        {error ? <ThemedText style={[styles.error, { color: theme.danger }]}>{error}</ThemedText> : null}
      </View>
    </View>
  );
}

export function CommentThread({
  segment,
  id,
  onCountChange,
}: {
  segment: SubjectSegment;
  id: string;
  onCountChange?: (comments: number) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [roots, setRoots] = useState<CommentThreadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (which: number) => {
      setLoading(true);
      try {
        const data = await listComments(segment, id, which);
        setRoots((current) => (which === 1 ? data.items : [...current, ...data.items]));
        setTotal(data.total);
      } catch (err) {
        setError(errorMessage(err, 'Could not load the conversation.'));
      } finally {
        setLoading(false);
      }
    },
    [segment, id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [load]);

  // Whether this reader may take a comment down is a property of the subject, not of any
  // one comment, so it is asked once.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getEngagement(segment, id)
      .then((detail) => alive && setCanModerate(Boolean((detail as { canModerate?: boolean }).canModerate)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [segment, id, user]);

  function replaceComment(next: ContentComment) {
    setRoots((current) =>
      current.map((root) =>
        root.id === next.id
          ? { ...root, ...next }
          : { ...root, replies: root.replies.map((reply) => (reply.id === next.id ? { ...reply, ...next } : reply)) },
      ),
    );
  }

  async function post(body: string, parentId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const comment = await addComment(segment, id, body, parentId);
      if (parentId) {
        setRoots((current) =>
          current.map((root) =>
            root.id === parentId ? { ...root, replies: [...root.replies, comment], replyCount: root.replyCount + 1 } : root,
          ),
        );
        setReplyingTo(null);
      } else {
        setRoots((current) => [...current, { ...comment, replies: [] }]);
      }
      setTotal((count) => count + 1);
      onCountChange?.(total + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not post that.'));
    } finally {
      setBusy(false);
    }
  }

  async function expandReplies(rootId: string) {
    try {
      const data = await listReplies(rootId);
      setRoots((current) => current.map((root) => (root.id === rootId ? { ...root, replies: data.items } : root)));
    } catch (err) {
      setError(errorMessage(err, 'Could not load the replies.'));
    }
  }

  const removed = () => {
    setTotal((count) => Math.max(0, count - 1));
    onCountChange?.(Math.max(0, total - 1));
  };

  return (
    // border-t px-4 py-3
    <View testID="comment-thread" style={[styles.thread, { borderTopColor: theme.border }]}>
      {loading && roots.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.sm}>Loading the conversation…</ThemedText>
        </View>
      ) : roots.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.sm}>Nobody has said anything yet.</ThemedText>
      ) : (
        <View style={styles.roots}>
          {roots.map((root) => (
            <View key={root.id} style={styles.root}>
              <CommentRow
                comment={root}
                canModerate={canModerate}
                onReply={() => setReplyingTo(replyingTo === root.id ? null : root.id)}
                onChanged={replaceComment}
                onRemoved={removed}
              />
              {root.replies.map((reply) => (
                <CommentRow key={reply.id} comment={reply} canModerate={canModerate} depth={1} onChanged={replaceComment} onRemoved={removed} />
              ))}
              {root.replyCount > root.replies.length ? (
                <Pressable accessibilityRole="link" onPress={() => void expandReplies(root.id)} style={styles.indent}>
                  <ThemedText style={[styles.sm, { color: theme.primaryStrong }]}>Show all {root.replyCount} replies</ThemedText>
                </Pressable>
              ) : null}
              {replyingTo === root.id ? (
                <View style={[styles.indent, styles.composerWrap]}>
                  <Composer
                    placeholder={`Reply to ${root.author?.name ?? 'this'}…`}
                    submitLabel="Reply"
                    busy={busy}
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                    onSubmit={(body) => void post(body, root.id)}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {roots.length < total ? (
        <Pressable
          accessibilityRole="link"
          style={styles.more}
          onPress={() => {
            const next = page + 1;
            setPage(next);
            void load(next);
          }}>
          <ThemedText style={[styles.sm, { color: theme.primaryStrong }]}>More comments</ThemedText>
        </Pressable>
      ) : null}

      {error ? <ThemedText style={[styles.sm, styles.errorTop, { color: theme.danger }]}>{error}</ThemedText> : null}

      {user ? (
        <View style={styles.newRow}>
          <Avatar name={user.displayName} size={32} src={user.avatarUrl} />
          <Composer placeholder="Say something." submitLabel="Comment" busy={busy} onSubmit={(body) => void post(body, null)} />
        </View>
      ) : (
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.newRow]}>
          <ThemedText accessibilityRole="link" onPress={() => router.push('/account')} style={[styles.sm, { color: theme.primaryStrong }]}>
            Sign in
          </ThemedText>{' '}
          to join the conversation.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  thread: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  roots: { gap: 16 },
  root: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  reply: { marginLeft: 40 },
  indent: { marginLeft: 40 },
  composerWrap: { flexDirection: 'row' },
  // rounded-2xl bg-muted px-3 py-2
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  author: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  gone: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', fontWeight: '400' },
  metaRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingHorizontal: 12 },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  like: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  error: { marginTop: 4, paddingHorizontal: 12, fontSize: 12, lineHeight: 16, fontWeight: '400' },
  errorTop: { marginTop: 8 },
  more: { marginTop: 12 },
  newRow: { marginTop: 16, flexDirection: 'row', gap: 8 },
  // rounded-md border p-2 text-[15px]
  input: { minHeight: 56, borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 15, textAlignVertical: 'top' },
  composerRow: { marginTop: 4, flexDirection: 'row', gap: 8 },
});
