import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// Set a new password, as the web lays it out (app/auth/reset-password/page.tsx).
// The link in the email carries the token; without one there is nothing to reset.
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token) return;
    if (password.length < 8) return setError('At least 8 characters');
    if (!/[A-Za-z]/.test(password)) return setError('Include at least one letter');
    if (!/[0-9]/.test(password)) return setError('Include at least one number');
    setError(undefined);
    setBusy(true);
    try {
      await api('/auth/password/reset', { method: 'POST', body: { token, password } });
      Alert.alert('Password reset. You can log in with your new password.');
      router.replace('/account');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That reset link is no longer valid.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {!token ? (
            <Card bleed={false} >
              <View testID="reset-invalid">
                <CardHeader>
                  <CardTitle style={styles.title}>That link is missing a token</CardTitle>
                  <CardDescription>Ask for a fresh reset link from the sign-in page.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" style={styles.start} onPress={() => router.replace('/auth/forgot-password')}>
                    Reset my password
                  </Button>
                </CardContent>
              </View>
            </Card>
          ) : (
            <Card bleed={false}>
              <CardHeader>
                <View style={styles.mark}>
                  <HashLogo size={56} color={theme.text} />
                </View>
                <View style={styles.titleRow}>
                  <CheckCircle2 size={24} color={theme.primaryStrong} />
                  <CardTitle style={styles.title}>Set a new password</CardTitle>
                </View>
                <CardDescription>This link works once and lasts 1 hour.</CardDescription>
              </CardHeader>
              <CardContent>
                <View style={styles.form}>
                  <Field label="New password" error={error} hint="8+ characters with a letter and a number">
                    <Input
                      testID="reset-password"
                      secureTextEntry
                      autoComplete="new-password"
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                      onSubmitEditing={() => void submit()}
                      accessibilityLabel="New password"
                    />
                  </Field>
                  <Button testID="reset-submit" disabled={busy} onPress={() => void submit()}>
                    {busy ? 'Resetting…' : 'Reset password'}
                  </Button>
                </View>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  mark: { marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, lineHeight: 32 },
  form: { gap: 16 },
  start: { alignSelf: 'flex-start' },
});
