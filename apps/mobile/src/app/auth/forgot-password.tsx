import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// Same non-enumerating shape as email verification: always answers success,
// whatever the address, so an attacker cannot use this to test which emails
// are registered.
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api('/auth/password/forgot', { method: 'POST', body: { email: email.trim().toLowerCase() } });
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }];

  if (sent) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText type="title">Check your email</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          If {email.trim()} has an account, a reset link is on its way.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/auth/reset-password')}
          style={styles.link}>
          <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>I have my token</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.container}>
      <ThemedText type="title">Forgot your password?</ThemedText>
      <ThemedText themeColor="textSecondary">We will email you a link to set a new one.</ThemedText>
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
          onSubmitEditing={submit}
          style={inputStyle}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={submit}
        disabled={busy || !email.trim()}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Send reset link</ThemedText>}
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
  link: { alignItems: 'center', padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
});
