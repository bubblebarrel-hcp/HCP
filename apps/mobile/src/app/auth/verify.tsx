import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// D31: registering issues a hashed, single-use, 24h token by email; the app
// has no session yet, so this screen is reachable signed out. The emailed
// link opens the web app today (no universal links configured), so the token
// field is a manual-paste fallback — the same token the web verify page's URL
// carries, and the one logged outside production per CLAUDE.md.

export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resent, setResent] = useState(false);

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await api('/auth/verify-email', { method: 'POST', body: { token: token.trim() } });
      setVerified(true);
    } catch (err) {
      setError(errorMessage(err, 'That link is invalid or has expired'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email.trim()) {
      setError('Enter the email you registered with.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api('/auth/verification/resend', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setResent(true);
    } catch {
      setError('Could not send it just now. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }];

  if (verified) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText type="title">Email confirmed</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>You are all set. On On!</ThemedText>
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
      <ThemedText type="title">Confirm your email</ThemedText>
      <ThemedText themeColor="textSecondary">
        {email ? `We sent a link to ${email}. Open it on this phone, or paste the token from it below.` : 'Open the link we emailed you, or paste its token below.'}
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">Verification token</ThemedText>
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

      {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

      <Pressable
        accessibilityRole="button"
        onPress={confirm}
        disabled={busy || !token.trim()}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || busy || !token.trim() ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Confirm</ThemedText>}
      </Pressable>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">Email</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
      </View>

      {resent ? (
        <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>A fresh link is on its way.</ThemedText>
      ) : (
        <Pressable accessibilityRole="button" onPress={resend} disabled={busy} style={styles.link}>
          <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Send the link again</ThemedText>
        </Pressable>
      )}
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
  link: { alignItems: 'center', padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
