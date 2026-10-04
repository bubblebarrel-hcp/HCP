import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { RunPosts } from '@/components/runs/run-posts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import type { RsvpStatus, RunDetail } from '@/lib/types';

// The pushed-route sibling to the runs tab's list: everything about one run
// that a hasher on a phone needs. Trail content, Circle detail and the report
// stay web-only for now (D25/D29 machinery has no native reader yet), so this
// screen ends in a link out rather than pretending to show them.

const CHECK_IN_STATES = ['CHECK_IN_OPEN', 'LIVE'];

const RSVP_CHOICES: { value: RsvpStatus; label: string }[] = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NOT_GOING', label: 'Not going' },
];

function runWhen(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { user } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ run: RunDetail }>(`/runs/${id}`);
      setRun(data.run);
    } catch (err) {
      setError(errorMessage(err, 'Could not open that run'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(fn: () => Promise<{ run: RunDetail }>) {
    setBusy(true);
    setActionError(null);
    try {
      const data = await fn();
      setRun(data.run);
    } catch (err) {
      setActionError(errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  const rsvp = (status: RsvpStatus) => act(() => api<{ run: RunDetail }>(`/runs/${id}/rsvp`, { method: 'PUT', body: { status } }));
  const checkIn = () => act(() => api<{ run: RunDetail }>(`/runs/${id}/check-in`, { method: 'POST' }));

  if (loading) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (error || !run) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error ?? 'Run not found'}</ThemedText>
      </ThemedView>
    );
  }

  const mine = run.viewer.participation;
  const checkedIn = Boolean(mine?.checkedInAt);
  const canCheckIn = CHECK_IN_STATES.includes(run.status) && Boolean(mine) && !checkedIn;

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {run.posterUrl ? <Image source={{ uri: run.posterUrl }} style={styles.poster} /> : null}

          <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>{run.kennel.shortName}</ThemedText>
          <ThemedText type="title" accessibilityRole="header">
            #{run.runNumber} · {run.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{runWhen(run.startsAt, run.timeZone)}</ThemedText>
          {run.meetingPointName ? <ThemedText themeColor="textSecondary">{run.meetingPointName}</ThemedText> : null}
          {run.meetingAddress ? <ThemedText themeColor="textSecondary">{run.meetingAddress}</ThemedText> : null}

          {run.status === 'CANCELLED' ? (
            <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Cancelled{run.cancelReason ? `: ${run.cancelReason}` : ''}
              </ThemedText>
            </View>
          ) : null}

          {run.theme ? <ThemedText type="smallBold">Theme: {run.theme}</ThemedText> : null}
          {run.description ? <ThemedText>{run.description}</ThemedText> : null}
          {run.hashCash ? <ThemedText themeColor="textSecondary">Hash cash: {run.hashCash}</ThemedText> : null}

          <ThemedText themeColor="textSecondary">
            {run.counts.going} going · {run.counts.maybe} maybe · {run.counts.checkedIn} checked in
          </ThemedText>

          {actionError && <ThemedText style={{ color: theme.danger }}>{actionError}</ThemedText>}

          {!user ? (
            <ThemedText themeColor="textSecondary">Log in to RSVP.</ThemedText>
          ) : run.viewer.canRespond ? (
            <View style={styles.row}>
              {RSVP_CHOICES.map((choice) => {
                const active = mine?.rsvpStatus === choice.value;
                return (
                  <Pressable
                    key={choice.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={busy}
                    onPress={() => rsvp(choice.value)}
                    style={({ pressed }) => [
                      styles.choice,
                      {
                        backgroundColor: active ? theme.primary : theme.backgroundElement,
                        borderColor: active ? theme.primary : theme.border,
                        opacity: pressed || busy ? 0.7 : 1,
                      },
                    ]}>
                    <ThemedText type="smallBold" style={{ color: active ? theme.onPrimary : theme.text }}>
                      {choice.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ThemedText themeColor="textSecondary">RSVP is closed for this run.</ThemedText>
          )}

          {checkedIn ? (
            <View style={styles.row}>
              <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check' }} size={18} color={theme.primaryStrong} />
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>You are checked in</ThemedText>
            </View>
          ) : canCheckIn ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={checkIn}
              style={({ pressed }) => [styles.checkIn, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.7 : 1 }]}>
              {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Check in</ThemedText>}
            </Pressable>
          ) : null}

          <RunPosts runId={run.id} />

          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${WEB_URL}/runs/${run.id}`)}
            style={styles.webLink}>
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
              Trail, Circle and report on hcp.app →
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  poster: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: Spacing.two },
  banner: { borderWidth: 1, borderRadius: 10, padding: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  choice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minHeight: 44, justifyContent: 'center' },
  checkIn: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  webLink: { paddingVertical: Spacing.three, minHeight: 44, justifyContent: 'center' },
});
