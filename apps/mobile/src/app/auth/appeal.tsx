import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// A held hasher's way to answer back (D75), as the web has it
// (app/auth/appeal/page.tsx). They cannot sign in, so they prove who they are with
// the password and nothing else is needed. What they write goes to the staff who
// decide it; they are not asked who reported them and are not told.

interface HoldState {
  held: boolean;
  level: 'HOLD' | 'REVIEW_HOLD' | null;
  endsAt: string | null;
  reviewed: boolean;
  canAppeal: boolean;
  appeal: { status: 'OPEN' | 'GRANTED' | 'DENIED' | 'MOOT'; message: string; decisionNote: string | null } | null;
}

const MIN = 10;
const MAX = 1000;

export default function AppealScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<HoldState | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function check() {
    setBusy(true);
    try {
      setState(await api<HoldState>('/auth/hold', { method: 'POST', body: { email: email.trim(), password } }));
    } catch (err) {
      Alert.alert('Could not check that', errorMessage(err, 'Is the email and password right?'));
    } finally {
      setBusy(false);
    }
  }

  async function appeal() {
    setBusy(true);
    try {
      await api('/auth/appeal', { method: 'POST', body: { email: email.trim(), password, message } });
      setSent(true);
      setState((s) => (s ? { ...s, canAppeal: false } : s));
    } catch (err) {
      Alert.alert('Could not send your appeal', errorMessage(err, 'Try again'));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Button variant="outline" onPress={() => router.replace('/account')}>
      Back to log in
    </Button>
  );

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Card bleed={false}>
            <CardHeader>
              <View style={styles.mark}>
                <HashLogo size={56} color={theme.text} />
              </View>
              <CardTitle style={styles.title}>Appeal a hold</CardTitle>
              <CardDescription>If your account is on hold, sign in here to tell a moderator your side. A person reads every appeal.</CardDescription>
            </CardHeader>
            <CardContent>
              {!state ? (
                <View style={styles.form} testID="appeal-check">
                  <Field label="Email">
                    <Input autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
                  </Field>
                  <Field label="Password">
                    <Input secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} accessibilityLabel="Password" />
                  </Field>
                  <Button disabled={busy || !email.trim() || !password} onPress={() => void check()}>
                    {busy ? 'Checking…' : 'Continue'}
                  </Button>
                </View>
              ) : !state.held ? (
                <View style={styles.form} testID="appeal-nothing">
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    There is nothing on this account to appeal. If you cannot sign in for another reason, write to us.
                  </ThemedText>
                  {back}
                </View>
              ) : sent || state.appeal ? (
                <View style={styles.form} testID="appeal-status">
                  <ThemedText style={styles.semibold}>
                    {sent && !state.appeal
                      ? 'Your appeal has been sent. You will be told what a moderator decides, by email.'
                      : state.appeal?.status === 'OPEN'
                        ? 'Your appeal is with a moderator. You will be told what they decide, by email.'
                        : state.appeal?.status === 'DENIED'
                          ? 'A moderator reviewed your appeal and the hold stands.'
                          : 'Your appeal was decided. Try signing in.'}
                  </ThemedText>
                  {state.appeal?.status === 'DENIED' && state.appeal.decisionNote ? (
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      They said: {state.appeal.decisionNote}
                    </ThemedText>
                  ) : null}
                  {back}
                </View>
              ) : (
                <View style={styles.form} testID="appeal-form">
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    {state.level === 'HOLD' && state.endsAt
                      ? `Your account is on hold and will be restored on ${new Date(state.endsAt).toUTCString()} unless a moderator decides otherwise. An appeal can bring that forward.`
                      : 'Your account is on hold until a moderator has reviewed the reports about it.'}{' '}
                    Say what happened, in your own words. You will not be told who reported you.
                  </ThemedText>
                  <TextInput
                    testID="appeal-message"
                    value={message}
                    onChangeText={setMessage}
                    maxLength={MAX}
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel="Your appeal"
                    placeholder="Your appeal"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                  />
                  <ThemedText themeColor="textSecondary" style={styles.count}>
                    {message.trim().length}/{MAX}
                  </ThemedText>
                  <Button testID="appeal-send" disabled={busy || message.trim().length < MIN} onPress={() => void appeal()}>
                    {busy ? 'Sending…' : 'Send my appeal'}
                  </Button>
                </View>
              )}
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  mark: { marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 30 },
  form: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  semibold: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  input: { minHeight: 140, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 },
  count: { fontSize: 12, lineHeight: 16, textAlign: 'right' },
});
