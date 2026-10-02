import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { Audience } from '@/lib/types';

// A hasher's own words, straight from the composer (D51): create-draft,
// publish — the photo-upload step in between is not built here yet (the
// composer stays text-only on mobile; attaching photos is still web-only,
// same split as everywhere else media touches R2 presigning).

// Who may read the post (D57): it can narrow the hasher's profile, never widen it.
const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Anyone can read it.' },
  { value: 'FOLLOWERS', label: 'Followers', hint: 'Only people who follow you.' },
  { value: 'ONLY_ME', label: 'Only me', hint: 'Only you.' },
];

export function Composer({
  name,
  avatarUrl,
  avatarPosition,
  onPosted,
}: {
  name: string;
  avatarUrl?: string | null;
  avatarPosition?: string | null;
  onPosted: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = body.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api<{ post: { id: string } }>('/posts', {
        method: 'POST',
        body: { body: value, visibility: audience },
      });
      await api(`/posts/${draft.post.id}/publish`, { method: 'POST' });
      setBody('');
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(errorMessage(err, 'Could not post that'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <Avatar name={name} src={avatarUrl} position={avatarPosition} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Write a post"
            onPress={() => setOpen(true)}
            style={[styles.pill, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              What&apos;s on trail, {name}?
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: theme.canvas }]}>
          <View style={styles.modalHeader}>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headerButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">New post</ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !body.trim()}
              onPress={submit}
              style={styles.headerButton}>
              {busy ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <ThemedText type="smallBold" style={{ color: body.trim() ? theme.primaryStrong : theme.textSecondary }}>
                  Post
                </ThemedText>
              )}
            </Pressable>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.row}>
              <Avatar name={name} src={avatarUrl} position={avatarPosition} />
              <ThemedText type="smallBold">{name}</ThemedText>
            </View>
            <View style={styles.audience} accessibilityRole="radiogroup">
              {AUDIENCES.map((option) => {
                const selected = audience === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option.label}. ${option.hint}`}
                    accessibilityState={{ selected }}
                    onPress={() => setAudience(option.value)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? theme.primary : theme.border, backgroundColor: theme.card },
                    ]}>
                    <ThemedText type="smallBold" style={{ color: selected ? theme.primaryStrong : theme.textSecondary }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {AUDIENCES.find((a) => a.value === audience)?.hint}
            </ThemedText>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What's on trail?"
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
              maxLength={5000}
              style={[styles.input, { color: theme.text }]}
            />
            {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
            <ThemedText type="small" themeColor="textSecondary">
              Words only for now — photos and reels still come from the composer on the web.
            </ThemedText>
          </View>
        </View>
      </Modal>
    </>
  );
}

// Shown in place of the composer to signed-out visitors.
export function WelcomeCard({ onLogin }: { onLogin: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>ON ON</ThemedText>
      <ThemedText style={styles.welcomeTitle}>A digital home for the worldwide Hash House Harriers.</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Find a kennel, join a run, follow the trail, and keep every story.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onLogin}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Log in or create an account</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pill: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  welcomeTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  button: { marginTop: Spacing.one, minHeight: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.two },
  headerButton: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  modalBody: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  input: { flex: 1, fontSize: 18, textAlignVertical: 'top' },
  audience: { flexDirection: 'row', gap: Spacing.two },
  chip: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
