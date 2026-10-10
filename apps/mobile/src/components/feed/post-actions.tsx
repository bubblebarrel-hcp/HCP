import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// What an author can do to their own post: change the words, or delete it (web
// components/feed/PostActions.tsx). Deleting is the API's archive (Ch.22): the post
// leaves every list and its own page, and the row stays. An edit is marked "edited"
// for readers. Only the words change; photos, poll and audience are set elsewhere.
//
// It works out whose post it is from the signed-in user, so a card can render it
// for everybody; the API checks again.
const MAX_POST_BODY = 5000;

export function PostActions({
  id,
  authorId,
  body,
  threadCount = 0,
  onEdited,
  onDeleted,
}: {
  id: string;
  authorId: string | null;
  body: string;
  // Posts after this one in its thread; deleting the first deletes them all.
  threadCount?: number;
  onEdited: (body: string) => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !authorId || user.id !== authorId) return null;

  function openMenu() {
    Alert.alert('Your post', undefined, [
      {
        text: 'Edit post',
        onPress: () => {
          setText(body);
          setError(null);
          setEditing(true);
        },
      },
      { text: 'Delete post', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this post?',
      threadCount > 0
        ? `This deletes the whole thread: this post and the ${threadCount} after it. Likes and comments go with it.`
        : 'It disappears for everyone, along with its likes and comments.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete post', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }

  async function remove() {
    try {
      await api(`/posts/${id}/archive`, { method: 'POST' });
      onDeleted();
    } catch (err) {
      Alert.alert('Could not delete this post', errorMessage(err, 'Could not delete this post'));
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/posts/${id}`, { method: 'PATCH', body: { body: text } });
      onEdited(text.trim());
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your changes'));
    } finally {
      setBusy(false);
    }
  }

  const changed = text.trim() !== body.trim();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post actions"
        testID="post-actions"
        hitSlop={6}
        onPress={openMenu}
        style={styles.menu}>
        <MoreHorizontal size={20} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={editing} animationType="slide" onRequestClose={() => !busy && setEditing(false)}>
        <View style={[styles.modal, { backgroundColor: theme.canvas }]}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(false)} style={styles.headerButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">Edit post</ThemedText>
            <Pressable
              accessibilityRole="button"
              testID="post-edit-save"
              disabled={busy || !changed}
              onPress={() => void save()}
              style={[styles.headerButton, (busy || !changed) && styles.dim]}>
              {busy ? <ActivityIndicator color={theme.primaryStrong} /> : <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Save</ThemedText>}
            </Pressable>
          </View>
          <View style={styles.editor}>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Only the words change. People will see that it was edited.
            </ThemedText>
            <Input
              value={text}
              onChangeText={setText}
              multiline
              maxLength={MAX_POST_BODY}
              autoFocus
              textAlignVertical="top"
              accessibilityLabel="Post text"
              testID="post-edit-text"
              style={styles.input}
            />
            <ThemedText themeColor="textSecondary" style={[styles.hint, styles.right]}>
              {text.length} / {MAX_POST_BODY}
            </ThemedText>
            {error ? (
              <ThemedText accessibilityRole="alert" style={{ color: theme.danger, fontSize: 14, lineHeight: 20 }}>
                {error}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', top: 6, right: 6, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  headerButton: { minWidth: 72, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
  editor: { padding: 16, gap: 8 },
  hint: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  right: { textAlign: 'right' },
  input: { minHeight: 180, paddingTop: 12, fontSize: 15, lineHeight: 22 },
});
