import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { ReelComposer } from '@/components/feed/reel-composer';
import { MentionInput } from '@/components/social/mention-input';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { Audience, TaggableRun } from '@/lib/types';

// A hasher's own words, straight from the composer (D51): create-draft,
// publish. The post stays text-only on mobile (photos on a post are still
// web-only). A reel is the media one, and has its own composer: the "Reel"
// button beside the pill opens it.

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
  const [reeling, setReeling] = useState(false);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A poll (D60): the words are the question, these are the answers.
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollHours, setPollHours] = useState(24);
  // A run the post is about (D60).
  const [runs, setRuns] = useState<TaggableRun[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  const filled = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollReady = !pollOn || filled.length >= 2;

  // The runs worth tagging are fetched when the box opens, not for everybody who
  // merely loads the feed.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<{ items: TaggableRun[] }>('/me/taggable-runs')
      .then((data) => alive && setRuns(data.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  async function submit() {
    const value = body.trim();
    if (!value || !pollReady) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api<{ post: { id: string } }>('/posts', {
        method: 'POST',
        body: {
          body: value,
          visibility: audience,
          runId,
          ...(pollOn ? { poll: { options: filled, hours: pollHours } } : {}),
        },
      });
      await api(`/posts/${draft.post.id}/publish`, { method: 'POST' });
      setBody('');
      setPollOn(false);
      setPollOptions(['', '']);
      setRunId(null);
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a reel"
            onPress={() => setReeling(true)}
            style={[styles.reelButton, { borderColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Reel</ThemedText>
          </Pressable>
        </View>
      </View>

      <ReelComposer visible={reeling} onClose={() => setReeling(false)} onPosted={onPosted} />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: theme.canvas }]}>
          <View style={styles.modalHeader}>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headerButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">New post</ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !body.trim() || !pollReady}
              onPress={submit}
              style={styles.headerButton}>
              {busy ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <ThemedText type="smallBold" style={{ color: body.trim() && pollReady ? theme.primaryStrong : theme.textSecondary }}>
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
            <MentionInput
              value={body}
              onChangeText={setBody}
              placeholder="What's on trail? Use # for a tag, @ for a hasher."
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
              maxLength={5000}
              style={[styles.input, { color: theme.text }]}
            />

            {runs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.runRow} style={styles.runScroll}>
                {runs.map((run) => {
                  const selected = runId === run.id;
                  return (
                    <Pressable
                      key={run.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Tag ${run.kennel.shortName} run ${run.runNumber ?? ''}`}
                      onPress={() => setRunId(selected ? null : run.id)}
                      style={[styles.chip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: theme.card }]}>
                      <ThemedText type="smallBold" style={{ color: selected ? theme.primaryStrong : theme.textSecondary }}>
                        {run.kennel.shortName} #{run.runNumber ?? '—'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pollOn }}
              onPress={() => setPollOn((on) => !on)}
              style={[styles.chip, styles.pollToggle, { borderColor: pollOn ? theme.primary : theme.border, backgroundColor: theme.card }]}>
              <ThemedText type="smallBold" style={{ color: pollOn ? theme.primaryStrong : theme.textSecondary }}>
                {pollOn ? 'Poll on' : 'Add a poll'}
              </ThemedText>
            </Pressable>
            {pollOn && (
              <View style={styles.poll}>
                <ThemedText type="small" themeColor="textSecondary">Your words are the question. Add two to five answers.</ThemedText>
                {pollOptions.map((option, index) => (
                  <TextInput
                    key={index}
                    value={option}
                    onChangeText={(next) => setPollOptions((cur) => cur.map((o, i) => (i === index ? next.slice(0, 80) : o)))}
                    placeholder={`Answer ${index + 1}`}
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel={`Answer ${index + 1}`}
                    style={[styles.pollInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  />
                ))}
                <View style={styles.runRow}>
                  {pollOptions.length < 5 && (
                    <Pressable accessibilityRole="button" onPress={() => setPollOptions((cur) => [...cur, ''])} style={[styles.chip, { borderColor: theme.border }]}>
                      <ThemedText type="smallBold">+ Answer</ThemedText>
                    </Pressable>
                  )}
                  {[1, 24, 72, 168].map((h) => (
                    <Pressable
                      key={h}
                      accessibilityRole="button"
                      accessibilityState={{ selected: pollHours === h }}
                      onPress={() => setPollHours(h)}
                      style={[styles.chip, { borderColor: pollHours === h ? theme.primary : theme.border }]}>
                      <ThemedText type="smallBold" style={{ color: pollHours === h ? theme.primaryStrong : theme.textSecondary }}>
                        {h === 1 ? '1 h' : h === 24 ? '1 day' : h === 72 ? '3 days' : '7 days'}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}
            <ThemedText type="small" themeColor="textSecondary">
              Words only here. For a video or photos, post a reel.
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
  reelButton: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  button: { marginTop: Spacing.one, minHeight: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.two },
  headerButton: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  modalBody: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  input: { flex: 1, minHeight: 90, fontSize: 18, textAlignVertical: 'top' },
  runScroll: { flexGrow: 0 },
  runRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  pollToggle: { alignSelf: 'flex-start' },
  poll: { gap: Spacing.two },
  pollInput: { minHeight: 44, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  audience: { flexDirection: 'row', gap: Spacing.two },
  chip: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
