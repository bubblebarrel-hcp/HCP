import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// Forgot password, as the web lays it out (app/auth/forgot-password/page.tsx).
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed) return setError('Enter your email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return setError('Enter a valid email');
    setError(undefined);
    setBusy(true);
    try {
      // The API always answers the same way, registered or not: nothing to
      // branch on here, just show the same confirmation either way.
      await api('/auth/password/forgot', { method: 'POST', body: { email: trimmed } });
    } catch {
      // Same confirmation either way.
    } finally {
      setBusy(false);
      setSent(trimmed);
    }
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Card bleed={false}>
            <CardHeader>
              <View style={styles.mark}>
                <HashLogo size={56} color={theme.text} />
              </View>
              <CardTitle style={styles.title}>Reset your password</CardTitle>
              <CardDescription>We will email you a link to set a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <View style={styles.sent} testID="forgot-sent">
                  <View style={styles.sentTitle}>
                    <MailCheck size={24} color={theme.primaryStrong} />
                    <ThemedText style={styles.semibold}>Check your email</ThemedText>
                  </View>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    If {sent} has an account, a reset link is on its way. It lasts 1 hour and works once.
                  </ThemedText>
                  <Button variant="outline" style={styles.start} onPress={() => router.replace('/account')}>
                    Back to sign in
                  </Button>
                </View>
              ) : (
                <View style={styles.form}>
                  <Field label="Email" error={error}>
                    <Input
                      testID="forgot-email"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={setEmail}
                      onSubmitEditing={() => void submit()}
                      accessibilityLabel="Email"
                    />
                  </Field>
                  <Button testID="forgot-submit" disabled={busy} onPress={() => void submit()}>
                    {busy ? 'Sending…' : 'Send reset link'}
                  </Button>
                  <ThemedText
                    style={[styles.link, { color: theme.primaryStrong }]}
                    accessibilityRole="link"
                    onPress={() => router.replace('/account')}>
                    Back to sign in
                  </ThemedText>
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
  // mx-auto flex max-w-md px-4 py-16
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  mark: { marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 32 },
  form: { gap: 16 },
  sent: { gap: 16 },
  sentTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  start: { alignSelf: 'flex-start' },
  link: { textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
