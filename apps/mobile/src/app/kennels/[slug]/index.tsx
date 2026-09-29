import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { brandColor, membershipStatusLabels, verificationLabels } from '@/lib/format';
import { followKennel, followState } from '@/lib/social';
import type { FollowState, KennelDetail, MembershipType, MembershipViewer } from '@/lib/types';

// The kennel home a hasher actually lands on from a phone: who they are,
// whether they can request to join, and — once in — how to leave or make it
// home. Officer desk work (members list, invitations, settings, branding)
// stays on the web; this screen only carries what a rank-and-file member does.

const JOIN_TYPES: { value: MembershipType; label: string }[] = [
  { value: 'FULL', label: 'Full member' },
  { value: 'ASSOCIATE', label: 'Associate' },
  { value: 'VISITING', label: 'Visiting' },
  { value: 'VIRGIN', label: 'First timer' },
];

const OPEN_STATUSES = ['APPLICANT', 'PENDING_REVIEW'];

export default function KennelDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();

  const [kennel, setKennel] = useState<KennelDetail | null>(null);
  const [viewer, setViewer] = useState<MembershipViewer | null>(null);
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [joinType, setJoinType] = useState<MembershipType>('FULL');
  const [message, setMessage] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [k, v, f] = await Promise.all([
        api<{ kennel: KennelDetail }>(`/kennels/${slug}`),
        api<MembershipViewer>(`/kennels/${slug}/membership`),
        followState('kennels', slug),
      ]);
      setKennel(k.kennel);
      setViewer(v);
      setFollow(f);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this kennel'));
    }
  }, [slug]);

  async function toggleFollow() {
    if (!follow) return;
    const next = !follow.following;
    setFollowBusy(true);
    setFollow({ ...follow, following: next, followers: follow.followers + (next ? 1 : -1) });
    try {
      await followKennel(slug, next);
    } catch {
      await load();
    } finally {
      setFollowBusy(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function requestJoin() {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/kennels/${slug}/memberships`, { method: 'POST', body: { type: joinType, message: message.trim() || undefined } });
      setShowJoinForm(false);
      setMessage('');
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not send that request'));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!viewer?.membership) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/memberships/${viewer.membership.id}/withdraw`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not withdraw that request'));
    } finally {
      setBusy(false);
    }
  }

  async function resign() {
    if (!viewer?.membership) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/memberships/${viewer.membership.id}/resign`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not leave this kennel'));
    } finally {
      setBusy(false);
    }
  }

  async function makeHome() {
    if (!kennel) return;
    setBusy(true);
    setActionError(null);
    try {
      await api('/me/home-kennel', { method: 'PATCH', body: { kennelId: kennel.id } });
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not set your home kennel'));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!kennel || !viewer) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  const verified = verificationLabels[kennel.verificationLevel];
  const status = viewer.membership?.status;
  const isActive = status === 'ACTIVE';
  const isPending = status ? OPEN_STATUSES.includes(status) : false;

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {kennel.bannerUrl ? <Image source={{ uri: kennel.bannerUrl }} style={styles.banner} /> : null}

        <View style={styles.headerRow}>
          <Avatar name={kennel.shortName} size={56} color={brandColor(kennel.primaryColor)} />
          <View style={styles.headerText}>
            <ThemedText type="title" numberOfLines={2}>{kennel.name}</ThemedText>
            <ThemedText themeColor="textSecondary">{kennel.city}, {kennel.country}</ThemedText>
          </View>
          {user && follow && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: follow.following }}
              disabled={followBusy}
              onPress={toggleFollow}
              style={[
                styles.followButton,
                { backgroundColor: follow.following ? theme.backgroundElement : theme.primary, opacity: followBusy ? 0.8 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: follow.following ? theme.text : theme.onPrimary }}>
                {follow.following ? 'Following' : 'Follow'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.chipRow}>
          {verified ? (
            <View style={[styles.chip, { borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: theme.primaryStrong }}>{verified}</ThemedText>
            </View>
          ) : null}
          <View style={[styles.chip, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">{kennel.activeMemberCount} members</ThemedText>
          </View>
          {follow && follow.followers > 0 ? (
            <View style={[styles.chip, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">{follow.followers} followers</ThemedText>
            </View>
          ) : null}
          {kennel.meetingDay ? (
            <View style={[styles.chip, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">{kennel.meetingDay}s</ThemedText>
            </View>
          ) : null}
        </View>

        {kennel.motto ? <ThemedText style={styles.motto}>“{kennel.motto}”</ThemedText> : null}
        {kennel.landingMessage ? <ThemedText>{kennel.landingMessage}</ThemedText> : null}
        {kennel.description ? <ThemedText themeColor="textSecondary">{kennel.description}</ThemedText> : null}

        {kennel.officers.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Officers</ThemedText>
            {kennel.officers.map((o, i) => (
              <View key={`${o.title}-${i}`} style={styles.officerRow}>
                <Avatar name={o.name} size={28} />
                <ThemedText type="small">{o.name} · {o.title}</ThemedText>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {!user ? (
            <ThemedText themeColor="textSecondary">Log in to join this kennel.</ThemedText>
          ) : isActive ? (
            <>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>You are a member</ThemedText>
              {viewer.membership?.isHomeKennel ? (
                <ThemedText type="small" themeColor="textSecondary">This is your home kennel.</ThemedText>
              ) : (
                <Pressable accessibilityRole="button" disabled={busy} onPress={makeHome} style={styles.smallAction}>
                  <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Make this my home kennel</ThemedText>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" disabled={busy} onPress={resign} style={styles.smallAction}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>Leave this kennel</ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/kennels/${slug}/officers`)} style={styles.smallAction}>
                <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>See officers →</ThemedText>
              </Pressable>
            </>
          ) : isPending ? (
            <>
              <ThemedText type="smallBold">Request sent</ThemedText>
              <ThemedText themeColor="textSecondary">Waiting on this kennel&rsquo;s mismanagement.</ThemedText>
              <Pressable accessibilityRole="button" disabled={busy} onPress={withdraw} style={styles.smallAction}>
                {busy ? <ActivityIndicator color={theme.danger} /> : <ThemedText type="smallBold" style={{ color: theme.danger }}>Withdraw request</ThemedText>}
              </Pressable>
            </>
          ) : status ? (
            <>
              <ThemedText type="smallBold">{membershipStatusLabels[status]}</ThemedText>
              {viewer.membership?.suspensionReason ? (
                <ThemedText themeColor="textSecondary">{viewer.membership.suspensionReason}</ThemedText>
              ) : null}
              {viewer.canRequest ? (
                showJoinForm ? (
                  <JoinForm
                    theme={theme}
                    joinType={joinType}
                    setJoinType={setJoinType}
                    message={message}
                    setMessage={setMessage}
                    busy={busy}
                    onSubmit={requestJoin}
                  />
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => setShowJoinForm(true)} style={styles.smallAction}>
                    <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Ask to join again</ThemedText>
                  </Pressable>
                )
              ) : viewer.reason ? (
                <ThemedText type="small" themeColor="textSecondary">{viewer.reason}</ThemedText>
              ) : null}
            </>
          ) : viewer.canRequest ? (
            showJoinForm ? (
              <JoinForm
                theme={theme}
                joinType={joinType}
                setJoinType={setJoinType}
                message={message}
                setMessage={setMessage}
                busy={busy}
                onSubmit={requestJoin}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowJoinForm(true)}
                style={({ pressed }) => [styles.joinButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Ask to join</ThemedText>
              </Pressable>
            )
          ) : (
            <ThemedText themeColor="textSecondary">{viewer.reason ?? 'This kennel is not accepting requests right now.'}</ThemedText>
          )}
          {actionError && <ThemedText type="small" style={{ color: theme.danger }}>{actionError}</ThemedText>}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function JoinForm({
  theme,
  joinType,
  setJoinType,
  message,
  setMessage,
  busy,
  onSubmit,
}: {
  theme: ReturnType<typeof useTheme>;
  joinType: MembershipType;
  setJoinType: (t: MembershipType) => void;
  message: string;
  setMessage: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.joinForm}>
      <ThemedText type="small" themeColor="textSecondary">Join as</ThemedText>
      <View style={styles.chipRow}>
        {JOIN_TYPES.map((t) => {
          const active = joinType === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setJoinType(t.value)}
              style={[styles.typeChip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: active ? theme.onPrimary : theme.text }}>{t.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="A note for the mismanagement (optional)"
        placeholderTextColor={theme.textSecondary}
        multiline
        style={[styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onSubmit}
        style={({ pressed }) => [styles.joinButton, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.8 : 1 }]}>
        {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Send request</ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  banner: { width: '100%', aspectRatio: 3, borderRadius: 12, marginBottom: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1, minWidth: 0 },
  followButton: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 4 },
  motto: { fontStyle: 'italic' },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  officerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  smallAction: { minHeight: 44, justifyContent: 'center' },
  joinButton: { borderRadius: Spacing.two, paddingVertical: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  joinForm: { gap: Spacing.two },
  typeChip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minHeight: 40, justifyContent: 'center' },
  textarea: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, minHeight: 60, fontSize: 16 },
});
