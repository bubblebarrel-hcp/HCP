import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui/web-ui';
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
          <Card bleed={false} style={styles.card}>
            <View testID="report-sent" style={styles.sections}>
              <ThemedText accessibilityRole="header" style={styles.title}>Thank you</ThemedText>
              <View style={styles.checkLine}>
                <Check size={20} color={theme.trail} />
                <ThemedText style={styles.sm}>Your report is with us. We will tell you what we decide.</ThemedText>
              </View>
              {who &&
                (after ? (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>{after}</ThemedText>
                ) : (
                  <View style={styles.sections}>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>Do you want to stop seeing them as well?</ThemedText>
                    <View style={styles.row}>
                      <Button variant="outline" size="sm" onPress={() => void stopSeeing('mute')}>Mute</Button>
                      <Button variant="outline" size="sm" onPress={() => void stopSeeing('block')}>Block</Button>
                    </View>
                  </View>
                ))}
              <Button onPress={() => router.back()}>Done</Button>
            </View>
          </Card>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card bleed={false} style={styles.card}>
          <View testID="report-form" style={styles.sections}>
            <View>
              <ThemedText accessibilityRole="header" style={styles.title}>Report {TARGET_WORDS[targetType] ?? 'this'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                We will look at it. They are not told it was you, and nothing happens to it until we have.
              </ThemedText>
            </View>

            <View style={styles.gap} accessibilityRole="radiogroup">
              <ThemedText style={styles.label}>What is wrong?</ThemedText>
              {reasons.map((r) => {
                const selected = reason === r.value;
                return (
                  <Pressable
                    key={r.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${r.label}. ${r.hint}`}
                    testID={`report-reason-${r.value}`}
                    onPress={() => setReason(r.value)}
                    style={[
                      styles.option,
                      { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary + '0d' : 'transparent' },
                    ]}>
                    <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}>
                      {selected && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
                    </View>
                    <View style={styles.flex}>
                      <ThemedText style={styles.optionTitle}>{r.label}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.sm}>{r.hint}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {isImpersonation && (
              <View style={[styles.fieldset, { borderColor: theme.border }]} testID="report-impersonation">
                <ThemedText style={styles.label}>Who are they pretending to be?</ThemedText>
                {(['ME', 'OTHER'] as const).map((who) => (
                  <Pressable
                    key={who}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: impersonating === who }}
                    testID={who === 'ME' ? 'report-impersonating-me' : 'report-impersonating-other'}
                    onPress={() => setImpersonating(who)}
                    style={styles.inline}>
                    <View style={[styles.radio, { borderColor: impersonating === who ? theme.primary : theme.border }]}>
                      {impersonating === who && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
                    </View>
                    <ThemedText style={styles.sm}>{who === 'ME' ? 'Me' : 'Somebody else'}</ThemedText>
                  </Pressable>
                ))}
                {impersonating === 'OTHER' &&
                  (real ? (
                    <View style={[styles.picked, { backgroundColor: theme.backgroundElement }]}>
                      <Avatar name={real.name} src={real.avatarUrl} size={28} />
                      <ThemedText numberOfLines={1} style={[styles.flex, styles.optionTitle]}>{real.name}</ThemedText>
                      <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={() => setReal(null)}>Change</ThemedText>
                    </View>
                  ) : (
                    <View>
                      <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Find the real hasher"
                        placeholderTextColor={theme.textSecondary}
                        autoCapitalize="none"
                        accessibilityLabel="Find the hasher they are pretending to be"
                        testID="report-real-input"
                        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                      />
                      {found.length > 0 && (
                        <View style={[styles.suggestions, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          {found.map((person) => (
                            <Pressable
                              key={person.id}
                              accessibilityRole="button"
                              accessibilityLabel={`${person.name}, @${person.username}`}
                              testID="report-real-suggestion"
                              onPress={() => setReal(person)}
                              style={styles.suggestion}>
                              <Avatar name={person.name} src={person.avatarUrl} size={28} />
                              <ThemedText numberOfLines={1} style={[styles.flex, styles.sm]}>{person.name}</ThemedText>
                              <ThemedText themeColor="textSecondary" style={styles.xs}>@{person.username}</ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
              </View>
            )}

            <View style={styles.gap}>
              <ThemedText style={styles.label}>Anything we should know?{reason === 'OTHER' ? '' : ' (optional)'}</ThemedText>
              <TextInput
                value={details}
                onChangeText={(next) => setDetails(next.slice(0, 1000))}
                multiline
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Details"
                testID="report-details"
                style={[styles.input, styles.details, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              />
            </View>

            {reason === 'SELF_HARM' && (
              <View accessibilityRole="summary" style={[styles.note, { backgroundColor: theme.danger + '1a' }]}>
                <ThemedText style={styles.sm}>
                  If somebody is in immediate danger, contact your local emergency services first. We read these reports straight away.
                </ThemedText>
              </View>
            )}
            {error ? <ThemedText accessibilityRole="alert" style={[styles.sm, { color: theme.danger }]}>{error}</ThemedText> : null}

            <View style={styles.footer}>
              <Button variant="ghost" onPress={() => router.back()}>Cancel</Button>
              <Button disabled={!ready || busy} testID="report-submit" onPress={() => void send()}>
                {busy ? 'Sending…' : 'Send report'}
              </Button>
            </View>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The web's dialog card: rounded-xl border p-6, on the page.
  scroll: { maxWidth: 512, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 32 },
  card: { padding: 24 },
  sections: { gap: 16 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  gap: { gap: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // flex items-start gap-3 rounded-lg border p-3 text-sm
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  optionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  radio: { marginTop: 3, width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  fieldset: { gap: 8, borderWidth: 1, borderRadius: 8, padding: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, padding: 8 },
  input: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 14 },
  suggestions: { marginTop: 4, borderWidth: 1, borderRadius: 8, padding: 4 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 44 },
  details: { minHeight: 80, paddingTop: 8, textAlignVertical: 'top' },
  note: { borderRadius: 8, padding: 12 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
