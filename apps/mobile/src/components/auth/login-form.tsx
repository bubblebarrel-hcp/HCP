import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api, errorMessage } from '@/lib/api';

// The log-in page, as the web lays it out (app/auth/login/page.tsx): a centred
// card with the mark, "Welcome back", the two fields, "Forgot password?" on the
// right, a full-width button and the way to register.
export function LoginForm() {
  const theme = useTheme();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  // D31: an unconfirmed address is a specific, fixable state, not a failure to
  // shrug at. Hold the address so we can offer to send the link again.
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function submit() {
    const next: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = 'Enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    setUnverified(null);
    try {
      await login(trimmed, password);
      router.replace('/account');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(trimmed);
      } else {
        Alert.alert('Could not log in', errorMessage(err, 'Could not log in'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!unverified) return;
    setResending(true);
    try {
      await api('/auth/verification/resend', { method: 'POST', body: { email: unverified } });
      Alert.alert('A fresh confirmation link is on its way.');
    } catch {
      Alert.alert('Could not send it just now. Try again in a minute.');
    } finally {
      setResending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card bleed={false}>
        <CardHeader>
          <View style={styles.mark}>
            <HashLogo size={56} color={theme.text} />
          </View>
          <CardTitle style={styles.title}>Welcome back</CardTitle>
          <CardDescription>Log in to follow your kennels and runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {unverified ? (
            <View
              accessibilityRole="alert"
              testID="login-unverified"
              style={[styles.notice, { borderColor: theme.accent + '66', backgroundColor: theme.accent + '1a' }]}>
              <ThemedText style={styles.noticeTitle}>Confirm your email first</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.noticeText}>
                We sent a link to {unverified} when you registered. Click it and you are in.
              </ThemedText>
              <Button variant="outline" size="sm" disabled={resending} testID="login-resend" style={styles.resend} onPress={() => void resend()}>
                {resending ? 'Sending…' : 'Send the link again'}
              </Button>
            </View>
          ) : null}
          <View style={styles.form}>
            <Field label="Email" error={errors.email}>
              <Input
                testID="login-email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <Input
                testID="login-password"
                secureTextEntry
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                accessibilityLabel="Password"
              />
            </Field>
            <View style={styles.forgot}>
              <Pressable accessibilityRole="link" testID="login-forgot" onPress={() => router.push('/auth/forgot-password')}>
                <ThemedText style={[styles.link, { color: theme.primaryStrong }]}>Forgot password?</ThemedText>
              </Pressable>
            </View>
            <Button testID="login-submit" disabled={busy} onPress={() => void submit()}>
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.footer}>
            New to Shiggy Trails?{' '}
            <ThemedText style={[styles.link, { color: theme.primaryStrong }]} onPress={() => router.push('/auth/register')}>
              Create an account
            </ThemedText>
          </ThemedText>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // mx-auto flex max-w-md px-4 py-16
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  mark: { marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 32 },
  notice: { marginBottom: 16, borderWidth: 1, borderRadius: 8, padding: 16 },
  noticeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  noticeText: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  resend: { marginTop: 12, alignSelf: 'flex-start' },
  form: { gap: 16 },
  forgot: { alignItems: 'flex-end' },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
