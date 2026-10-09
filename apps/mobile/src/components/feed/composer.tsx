import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BookOpen, Footprints, ImagePlus, ListPlus, Video, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { HashLogo } from '@/components/brand/hash-logo';
import { Avatar } from '@/components/feed/avatar';
import { ReelComposer } from '@/components/feed/reel-composer';
import { MentionInput } from '@/components/social/mention-input';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, fileSize, uploadAsset } from '@/lib/media';
import type { Audience, TaggableRun } from '@/lib/types';

// A hasher's own post, straight from the composer (D51), the web's three steps:
// create the draft so photos have somewhere to land, upload them one at a time, then
// publish: nothing half-uploaded ever reaches the feed. Up to four photos, a poll, a run
// it is about, and who may read it. A reel is the other kind of thing and has its own
// composer: the "Reel" button beside the pill opens it.
const MAX_POST_BODY = 5000;
const MAX_POST_PHOTOS = 4;
// The first post and its parts together; the API holds the same line.
const MAX_THREAD_POSTS = 10;

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reeling, setReeling] = useState(false);
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // A poll (D60): the words are the question, these are the answers.
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollHours, setPollHours] = useState(24);
  // A run the post is about (D60).
  const [runs, setRuns] = useState<TaggableRun[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  // The later posts of a thread, in order. Each is words only; the first post
  // carries the photos, the poll, the run and the audience for all of them.
  const [thread, setThread] = useState<string[]>([]);

  const filled = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollReady = !pollOn || (filled.length >= 2 && body.trim().length > 0);
  // A thread goes up whole, so an empty part holds Post back rather than being dropped.
  const threadReady = thread.every((part) => part.trim().length > 0);
  const ready = (body.trim().length > 0 || photos.length > 0) && pollReady && threadReady;

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

  async function addPhotos() {
    const room = MAX_POST_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`${MAX_POST_PHOTOS} photos is the limit on a post.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.85,
    });
    if (result.canceled) return;
    const tooBig = result.assets.find((a) => a.fileSize !== undefined && a.fileSize > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setError(`${tooBig.fileName ?? 'That photo'} is ${fileSize(tooBig.fileSize ?? 0)} — the limit is ${fileSize(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setError(null);
    setPhotos((current) => [...current, ...result.assets].slice(0, MAX_POST_PHOTOS));
  }

  async function submit() {
    const value = body.trim();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setProgress(photos.length ? { done: 0, total: photos.length } : null);
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
      for (const [index, asset] of photos.entries()) {
        setProgress({ done: index, total: photos.length });
        // Sequential on purpose: a failure halfway leaves a draft that was never published
        // rather than a post with holes in it.
        await uploadAsset(asset, { type: 'POST', id: draft.post.id }, index);
      }
      setProgress(photos.length ? { done: photos.length, total: photos.length } : null);
      // Each part is written in order, so its place in the chain is the order typed.
      for (const words of thread) {
        await api('/posts', { method: 'POST', body: { body: words.trim(), threadRootId: draft.post.id } });
      }
      await api(`/posts/${draft.post.id}/publish`, { method: 'POST' });
      setBody('');
      setThread([]);
      setPhotos([]);
      setPollOn(false);
      setPollOptions(['', '']);
      setRunId(null);
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(errorMessage(err, 'Could not post that'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      {/* The web composer on a phone (components/feed/Composer.tsx): a bleed card
          with the avatar and a filled input, then a divider and three icon-only
          shortcuts: reel, trail reports, runs. */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowTop}>
          <Avatar name={name} src={avatarUrl} position={avatarPosition} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Write a post"
            testID="composer-input"
            onPress={() => setOpen(true)}
            style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.pillText}>
              What&apos;s on trail, {name}?
            </ThemedText>
          </Pressable>
        </View>
        <View style={[styles.shortcuts, { borderTopColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a reel"
            testID="composer-reel"
            onPress={() => setReeling(true)}
            style={({ pressed }) => [styles.shortcut, pressed && { backgroundColor: theme.backgroundElement }]}>
            <Video size={20} color={theme.primaryStrong} />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Trail reports"
            onPress={() => router.push('/trail-reports' as never)}
            style={({ pressed }) => [styles.shortcut, pressed && { backgroundColor: theme.backgroundElement }]}>
            <BookOpen size={20} color={theme.primaryStrong} />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Runs"
            onPress={() => router.push('/runs')}
            style={({ pressed }) => [styles.shortcut, pressed && { backgroundColor: theme.backgroundElement }]}>
            <Footprints size={20} color={theme.primaryStrong} />
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
              disabled={busy || !ready}
              onPress={submit}
              style={styles.headerButton}>
              {busy ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <ThemedText type="smallBold" style={{ color: ready ? theme.primaryStrong : theme.textSecondary }}>
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
              onChangeText={(next) => setBody(next.slice(0, MAX_POST_BODY))}
              placeholder="What's on trail? Use # for a tag, @ for a hasher."
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
              style={[styles.input, { color: theme.text }]}
            />

            {photos.length > 0 && (
              <View style={styles.photos} testID="composer-photos">
                {photos.map((asset, index) => (
                  <View key={`${asset.uri}-${index}`}>
                    <Image source={{ uri: asset.uri }} accessibilityLabel={asset.fileName ?? 'Photo'} style={[styles.thumb, { borderColor: theme.border }]} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${asset.fileName ?? 'photo'}`}
                      disabled={busy}
                      onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                      style={[styles.remove, { backgroundColor: theme.text }]}>
                      <X size={14} color={theme.background} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {thread.length > 0 && (
              <ScrollView style={styles.threadScroll} testID="composer-thread" keyboardShouldPersistTaps="handled">
                {thread.map((part, index) => (
                  <View key={index} style={[styles.threadPart, { borderLeftColor: theme.primary }]}>
                    <TextInput
                      value={part}
                      onChangeText={(next) =>
                        setThread((cur) => cur.map((p, i) => (i === index ? next.slice(0, MAX_POST_BODY) : p)))
                      }
                      placeholder={`Part ${index + 2}`}
                      placeholderTextColor={theme.textSecondary}
                      accessibilityLabel={`Part ${index + 2} of the thread`}
                      multiline
                      editable={!busy}
                      style={[styles.threadInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove part ${index + 2}`}
                      disabled={busy}
                      onPress={() => setThread((cur) => cur.filter((_, i) => i !== index))}
                      style={[styles.remove, { backgroundColor: theme.text }]}>
                      <X size={14} color={theme.background} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            <Pressable
              accessibilityRole="button"
              testID="composer-add-thread"
              disabled={busy || thread.length + 1 >= MAX_THREAD_POSTS}
              onPress={() => setThread((cur) => [...cur, ''])}
              style={[styles.chip, styles.pollToggle, { borderColor: theme.border, backgroundColor: theme.card, flexDirection: 'row', gap: 6, opacity: busy || thread.length + 1 >= MAX_THREAD_POSTS ? 0.5 : 1 }]}>
              <ListPlus size={16} color={theme.textSecondary} />
              <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>Add to thread</ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              testID="composer-add-photo"
              disabled={busy || photos.length >= MAX_POST_PHOTOS}
              onPress={() => void addPhotos()}
              style={[styles.chip, styles.pollToggle, { borderColor: theme.border, backgroundColor: theme.card, flexDirection: 'row', gap: 6, opacity: busy || photos.length >= MAX_POST_PHOTOS ? 0.5 : 1 }]}>
              <ImagePlus size={16} color={theme.textSecondary} />
              <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>Photo</ThemedText>
            </Pressable>

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
            {progress ? (
              <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
                Photo {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </ThemedText>
            ) : null}
            {body.length > MAX_POST_BODY - 500 ? (
              <ThemedText type="small" themeColor="textSecondary">{MAX_POST_BODY - body.length}</ThemedText>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

// Shown in place of the composer to signed-out visitors (web WelcomeCard.tsx).
export function WelcomeCard({ onLogin }: { onLogin: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.card, styles.welcome, { backgroundColor: theme.card, borderColor: theme.border }]} testID="welcome-card">
      <View style={styles.row}>
        <HashLogo size={48} color={theme.text} />
        <ThemedText style={[styles.onOn, { color: theme.primaryStrong }]}>ON ON</ThemedText>
      </View>
      <ThemedText style={styles.welcomeTitle}>A digital home for the worldwide Hash House Harriers.</ThemedText>
      <ThemedText themeColor="textSecondary">Find a kennel, join a run, follow the trail, and keep every story.</ThemedText>
      <View style={styles.welcomeButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/auth/register')}
          style={({ pressed }) => [styles.button, styles.buttonFill, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Create your account</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onLogin}
          style={({ pressed }) => [styles.button, styles.buttonFill, { borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText type="smallBold">Log in</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card with p-3 and border-y: edge to edge on a phone.
  card: { padding: 12, gap: Spacing.two, borderTopWidth: 1, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  // rounded-2xl bg-muted px-4 py-2.5, 15pt text.
  pill: { flex: 1, minHeight: 40, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  pillText: { fontSize: 15, lineHeight: 20 },
  // mt-3 grid-cols-3 gap-1 border-t pt-2; each shortcut is h-10 rounded-lg.
  shortcuts: { flexDirection: 'row', gap: 4, marginTop: 4, borderTopWidth: 1, paddingTop: 8 },
  shortcut: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  // p-5; text-sm font-semibold uppercase tracking-widest; text-2xl font-bold.
  welcome: { padding: 20, gap: 12 },
  onOn: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.8 },
  welcomeTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  welcomeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  buttonFill: { paddingHorizontal: 16, flexGrow: 1 },
  button: { minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.six, paddingBottom: Spacing.two },
  headerButton: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  modalBody: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  input: { flex: 1, minHeight: 90, fontSize: 18, textAlignVertical: 'top' },
  runScroll: { flexGrow: 0 },
  runRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  pollToggle: { alignSelf: 'flex-start' },
  threadScroll: { flexGrow: 0, maxHeight: 220 },
  threadPart: { borderLeftWidth: 2, paddingLeft: 12, marginBottom: 8 },
  threadInput: { minHeight: 70, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 8, fontSize: 16, textAlignVertical: 'top' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8, borderWidth: 1 },
  remove: { position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  poll: { gap: Spacing.two },
  pollInput: { minHeight: 44, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  audience: { flexDirection: 'row', gap: Spacing.two },
  chip: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
