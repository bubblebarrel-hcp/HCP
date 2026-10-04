import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { REPORT_REASONS, TARGET_WORDS, type ReportReason, type ReportTargetType } from '@/lib/moderation';

// Reporting something to the people who look after Shiggy Trails (D61). A report
// asks a person to look. Nothing is hidden or taken down by sending one, the
// hasher reported is never told who did, and the reporter hears the outcome in one
// line. Impersonation asks one more thing: is it you they are pretending to be, or
// somebody else (who?).
//
// /report/<TYPE>/<id>?by=<userId>, where `by` is who made it, so a mute or block
// can be offered straight after.

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export default function ReportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { type, id, by } = useLocalSearchParams<{ type: string; id: string; by?: string }>();
  const targetType = String(type).toUpperCase() as ReportTargetType;
  const reasons = REPORT_REASONS.filter((r) => !r.hasherOnly || targetType === 'USER');

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [impersonating, setImpersonating] = useState<'ME' | 'OTHER' | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);
  const [real, setReal] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [after, setAfter] = useState<string | null>(null);

  const isImpersonation = reason === 'IMPERSONATION';
  const ready =
    reason !== null &&
    (reason !== 'OTHER' || details.trim().length > 0) &&
    (!isImpersonation || impersonating === 'ME' || (impersonating === 'OTHER' && real !== null));

  useEffect(() => {
    if (impersonating !== 'OTHER' || real) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<{ items: Suggestion[] }>(`/mentions/suggest?q=${encodeURIComponent(query)}&limit=6`)
        .then((data) => alive && setFound(data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, impersonating, real]);

  async function send() {
    if (!reason || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/reports', {
        method: 'POST',
        body: {
          targetType,
          targetId: id,
          reason,
          details: details.trim() || undefined,
          ...(isImpersonation ? { impersonating, impersonatedUserId: impersonating === 'OTHER' ? real?.id : undefined } : {}),
        },
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'That did not send.'));
    } finally {
      setBusy(false);
    }
  }

  async function stopSeeing(kind: 'block' | 'mute') {
    const who = targetType === 'USER' ? id : by;
    if (!who) return;
    try {
      await api(`/hashers/${who}/${kind}`, { method: 'PUT' });
      setAfter(kind === 'block' ? 'Blocked. You can undo it under Privacy.' : 'Muted. You can undo it under Privacy.');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again.'));
    }
  }

  if (sent) {
    const who = targetType === 'USER' ? id : by;
    return (
      <ThemedView type="canvas" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle" accessibilityRole="header">Thank you</ThemedText>
          <ThemedText>Your report is with us. We will tell you what we decide.</ThemedText>
          {who && (
            <View style={styles.gap}>
              {after ? (
                <ThemedText type="small" themeColor="textSecondary">{after}</ThemedText>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">Do you want to stop seeing them as well?</ThemedText>
                  <View style={styles.row}>
                    <Pressable accessibilityRole="button" onPress={() => void stopSeeing('mute')} style={[styles.chip, { borderColor: theme.border }]}>
                      <ThemedText type="smallBold">Mute</ThemedText>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => void stopSeeing('block')} style={[styles.chip, { borderColor: theme.border }]}>
                      <ThemedText type="smallBold" style={{ color: theme.danger }}>Block</ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.submit, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Done</ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" accessibilityRole="header">Report {TARGET_WORDS[targetType] ?? 'this'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          We will look at it. They are not told it was you, and nothing happens to it until we have.
        </ThemedText>

        <View style={styles.gap} accessibilityRole="radiogroup">
          <ThemedText type="smallBold">What is wrong?</ThemedText>
          {reasons.map((r) => {
            const selected = reason === r.value;
            return (
              <Pressable
                key={r.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${r.label}. ${r.hint}`}
                onPress={() => setReason(r.value)}
                style={[styles.option, { backgroundColor: theme.card, borderColor: selected ? theme.primary : theme.border }]}>
                <ThemedText type="smallBold">{r.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{r.hint}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {isImpersonation && (
          <View style={styles.gap}>
            <ThemedText type="smallBold">Who are they pretending to be?</ThemedText>
            <View style={styles.row}>
              {(['ME', 'OTHER'] as const).map((who) => (
                <Pressable
                  key={who}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: impersonating === who }}
                  onPress={() => setImpersonating(who)}
                  style={[styles.chip, { borderColor: impersonating === who ? theme.primary : theme.border, backgroundColor: theme.card }]}>
                  <ThemedText type="smallBold">{who === 'ME' ? 'Me' : 'Somebody else'}</ThemedText>
                </Pressable>
              ))}
            </View>
            {impersonating === 'OTHER' &&
              (real ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${real.name}. Press to change.`}
                  onPress={() => setReal(null)}
                  style={[styles.option, styles.pick, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Avatar name={real.name} src={real.avatarUrl} size={28} />
                  <ThemedText type="smallBold" style={styles.flex}>{real.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.primaryStrong }}>Change</ThemedText>
                </Pressable>
              ) : (
                <>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Find the real hasher"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    accessibilityLabel="Find the hasher they are pretending to be"
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  />
                  {found.map((person) => (
                    <Pressable
                      key={person.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${person.name}, @${person.username}`}
                      onPress={() => setReal(person)}
                      style={[styles.option, styles.pick, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Avatar name={person.name} src={person.avatarUrl} size={28} />
                      <ThemedText type="smallBold" style={styles.flex}>{person.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">@{person.username}</ThemedText>
                    </Pressable>
                  ))}
                </>
              ))}
          </View>
        )}

        <View style={styles.gap}>
          <ThemedText type="smallBold">Anything we should know?{reason === 'OTHER' ? '' : ' (optional)'}</ThemedText>
          <TextInput
            value={details}
            onChangeText={(next) => setDetails(next.slice(0, 1000))}
            multiline
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Details"
            style={[styles.input, styles.details, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
          />
        </View>

        {reason === 'SELF_HARM' && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            If somebody is in immediate danger, contact your local emergency services first. We read these reports straight away.
          </ThemedText>
        )}
        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        <Pressable
          accessibilityRole="button"
          disabled={!ready || busy}
          onPress={() => void send()}
          style={[styles.submit, { backgroundColor: theme.primary, opacity: !ready || busy ? 0.5 : 1 }]}>
          {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Send report</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  gap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  option: { borderWidth: 2, borderRadius: 12, padding: Spacing.three, gap: 2, minHeight: 56 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48, borderWidth: 1 },
  chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderWidth: 2, borderRadius: 22, justifyContent: 'center' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  details: { minHeight: 90, paddingTop: Spacing.two, textAlignVertical: 'top' },
  submit: { minHeight: 48, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
});
