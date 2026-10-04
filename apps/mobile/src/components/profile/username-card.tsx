import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// What other hashers type to mention you (D59). The hash handle is still the name
// shown everywhere (D11); this is only how you are addressed, so it can be short
// and it has to be unique.
//
// Mirrors USERNAME_PATTERN in apps/api/src/utils/entities.ts: change both together.
const PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

export function UsernameCard() {
  const theme = useTheme();
  const { user, refreshUser } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (!user) return null;
  const next = value.trim().replace(/^@/, '').toLowerCase();
  const changed = next !== (user.username ?? '');

  async function save() {
    if (!PATTERN.test(next) || next.includes('..')) {
      setFailed(true);
      setNote('3 to 30 letters, numbers, "_" or ".", starting and ending on a letter or number.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api('/me/username', { method: 'PATCH', body: { username: next } });
      await refreshUser();
      setFailed(false);
      setNote(`You are @${next} now.`);
    } catch (err) {
      setFailed(true);
      setNote(errorMessage(err, 'Could not change your username.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Username</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        How other hashers @mention you. Your hash handle is still the name people see.
      </ThemedText>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={31}
          accessibilityLabel="Username"
          placeholder="username"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !changed}
          onPress={() => void save()}
          style={[styles.button, { backgroundColor: theme.primary, opacity: busy || !changed ? 0.5 : 1 }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Save</ThemedText>
        </Pressable>
      </View>
      {note && <ThemedText type="small" style={{ color: failed ? theme.danger : theme.textSecondary }}>{note}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  button: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, justifyContent: 'center' },
});
