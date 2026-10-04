import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { UsernameCard } from '@/components/profile/username-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { deactivateAccount, deleteAccount, getPrivacy, setMilestoneSharing, setPrivacy } from '@/lib/social';
import type { Audience } from '@/lib/types';

// Privacy and account (D57): who sees what a hasher makes, stepping away for a
// while, and leaving for good.

const OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Anyone on Shiggy Trails, signed in or not, can see your photos, posts and reels.' },
  {
    value: 'FOLLOWERS',
    label: 'Followers',
    hint: 'Your profile is locked. People ask to follow you, and only the ones you approve see your photos, posts and reels.',
  },
  { value: 'ONLY_ME', label: 'Only me', hint: 'Nobody sees them but you, and nobody can follow you.' },
];

type Danger = 'deactivate' | 'delete';

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [level, setLevel] = useState<Audience | null>(null);
  const [pending, setPending] = useState(0);
  // Whether a milestone may appear in the feed as a card (D60).
  const [milestones, setMilestones] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [danger, setDanger] = useState<Danger | null>(null);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getPrivacy();
      setLevel(data.profileVisibility);
      setPending(data.pendingRequests);
      setMilestones(data.shareMilestones);
    } catch (err) {
      setNote(errorMessage(err, 'Could not load your privacy settings'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  async function choose(next: Audience) {
    if (next === level) return;
    const before = level;
    setLevel(next);
    setSaving(true);
    setNote(null);
    try {
      const data = await setPrivacy(next);
      setPending(data.pendingRequests);
      setNote(
        next === 'PUBLIC'
          ? 'Your profile is public.'
          : next === 'FOLLOWERS'
            ? 'Your profile is locked. People now have to ask to follow you.'
            : 'Your profile is just for you.',
      );
    } catch (err) {
      setLevel(before);
      setNote(errorMessage(err, 'Could not change your privacy'));
    } finally {
      setSaving(false);
    }
  }

  function openDanger(next: Danger) {
    setDanger((current) => (current === next ? null : next));
    setPassword('');
    setTyped('');
    setDangerError(null);
  }

  async function confirmDanger() {
    if (!danger) return;
    setWorking(true);
    setDangerError(null);
    try {
      if (danger === 'deactivate') await deactivateAccount(password);
      else await deleteAccount(password);
      await logout();
      router.replace('/');
    } catch (err) {
      setDangerError(errorMessage(err, 'That did not work'));
    } finally {
      setWorking(false);
    }
  }

  if (!user) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText themeColor="textSecondary">Log in to manage your privacy.</ThemedText>
      </ThemedView>
    );
  }

  const ready = password.length > 0 && (danger !== 'delete' || typed === 'DELETE');
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }];

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" accessibilityRole="header">Who can see what I make</ThemedText>
        <ThemedText themeColor="textSecondary">
          This covers your photos, posts and reels. Each reel can be narrower than this, never wider. Your name,
          picture and bio stay visible so people can find you and ask to follow.
        </ThemedText>

        {level === null ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <View style={styles.options} accessibilityRole="radiogroup">
            {OPTIONS.map((option) => {
              const selected = level === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: saving }}
                  disabled={saving}
                  onPress={() => choose(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                      opacity: pressed || saving ? 0.8 : 1,
                    },
                  ]}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{option.hint}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
        {note && <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>}
        {level !== null && level !== 'PUBLIC' && pending > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {pending} {pending === 1 ? 'person is' : 'people are'} waiting for your yes. Making your profile public lets
            them all in.
          </ThemedText>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/follow-requests')}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText type="smallBold">Follow requests{pending > 0 ? ` (${pending})` : ''}</ThemedText>
        </Pressable>

        <View style={styles.dangerBlock}>
          <ThemedText type="smallBold">Milestones in the feed</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            When you pass 10, 50 or 100 runs, the people who can see your profile may get a card for it. Turning it off
            only removes the card: the milestone stays on your Hash Passport.
          </ThemedText>
          <View style={styles.switchRow}>
            <ThemedText style={styles.flex}>Show my milestones as cards</ThemedText>
            <Switch
              value={milestones}
              accessibilityLabel="Show my milestones as cards in the feed"
              onValueChange={(next) => {
                setMilestones(next);
                setMilestoneSharing(next).catch(() => setMilestones(!next));
              }}
            />
          </View>
        </View>

        <UsernameCard />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/blocked')}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText type="smallBold">Blocked and muted</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/photo-tags')}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
          <ThemedText type="smallBold">Photo tags waiting for me</ThemedText>
        </Pressable>

        <View style={styles.dangerBlock}>
          <ThemedText type="smallBold">Step away for a while</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Deactivating takes your profile, photos, posts and reels off Shiggy Trails and signs you out. Kennel records that name
            you stay as they are. Nothing is removed: log in again and everything is back.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => openDanger('deactivate')}
            style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText type="smallBold">Deactivate my account</ThemedText>
          </Pressable>
        </View>

        <View style={styles.dangerBlock}>
          <ThemedText type="smallBold">Delete my account</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This cannot be undone. Your name, handle, picture, details, login, follows, posts, reels and their photos are
            removed. Runs you attended, trail reports and Run Capsules that mention you stay, because they are a
            kennel&apos;s record, and show you as &ldquo;Deleted hasher&rdquo;. If you hold an office in a kennel, resign it
            first.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => openDanger('delete')}
            style={({ pressed }) => [styles.row, { backgroundColor: theme.danger, opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText type="smallBold" style={styles.onDanger}>Delete my account</ThemedText>
          </Pressable>
        </View>

        {danger && (
          <View style={[styles.confirm, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold">
              {danger === 'delete' ? 'Delete your account for good?' : 'Deactivate your account?'}
            </ThemedText>
            <TextInput
              accessibilityLabel="Your password"
              placeholder="Your password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setDangerError(null);
              }}
              style={inputStyle}
            />
            {danger === 'delete' && (
              <TextInput
                accessibilityLabel="Type DELETE to confirm"
                placeholder="Type DELETE to confirm"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                value={typed}
                onChangeText={setTyped}
                style={inputStyle}
              />
            )}
            {dangerError && <ThemedText type="small" style={{ color: theme.danger }}>{dangerError}</ThemedText>}
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                disabled={working}
                onPress={() => openDanger(danger)}
                style={({ pressed }) => [styles.small, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready || working }}
                disabled={!ready || working}
                onPress={confirmDanger}
                style={({ pressed }) => [
                  styles.small,
                  { backgroundColor: theme.danger, opacity: !ready || working ? 0.45 : pressed ? 0.8 : 1 },
                ]}>
                {working ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <ThemedText type="smallBold" style={styles.onDanger}>
                    {danger === 'delete' ? 'Delete my account' : 'Deactivate'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  options: { gap: Spacing.two },
  option: { borderWidth: 2, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one, minHeight: 64 },
  row: { minHeight: 48, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  dangerBlock: { gap: Spacing.two, marginTop: Spacing.two },
  onDanger: { color: '#ffffff' },
  confirm: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  confirmActions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  small: { minHeight: 44, minWidth: 96, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
});
