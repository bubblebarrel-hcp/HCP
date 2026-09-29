import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (!token.trim()) {
      setError('Paste the token from your email.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password needs 8+ characters with a letter and a number.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password/reset', { method: 'POST', body: { token: token.trim(), password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, 'That link is invalid or has expired'));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }];

  if (done) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText type="title">Password updated</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Every other session was signed out. Log in with your new password.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/account')}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Go to log in</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.container}>
      <ThemedText type="title">Set a new password</ThemedText>
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">Reset token</ThemedText>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="Paste the token from your email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">New password</ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          style={inputStyle}
        />
        <ThemedText type="small" themeColor="textSecondary">8+ characters with a letter and a number</ThemedText>
      </View>

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Pressable
        accessibilityRole="button"
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Reset password</ThemedText>}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  centerText: { textAlign: 'center' },
  field: { gap: 4 },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
  button: { borderRadius: Spacing.two, paddingVertical: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
