import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// An account decision that has to be meant (components/profile/PasswordConfirmDialog.tsx):
// it asks for the password, and when `typeWord` is given, for that word typed out
// as well. Deactivating asks for the first; deleting, which cannot be undone,
// asks for both (D57). onConfirm throws to keep the dialog open.
export function PasswordConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  typeWord,
  onConfirm,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  typeWord?: string;
  onConfirm: (password: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  function change(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setPassword('');
      setTyped('');
      setError(null);
    }
  }

  const ready = password.length > 0 && (!typeWord || typed === typeWord);

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
      setBusy(false);
      setOpen(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <>
      {trigger(() => change(true))}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => change(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => change(false)} accessibilityLabel="Close" />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]} testID="password-confirm">
            <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.description}>{description}</ThemedText>
            <View style={styles.fields}>
              <Field label="Your password" error={error ?? undefined}>
                <Input
                  testID="confirm-password"
                  secureTextEntry
                  autoComplete="current-password"
                  autoCapitalize="none"
                  value={password}
                  onChangeText={(next) => {
                    setPassword(next);
                    if (error) setError(null);
                  }}
                />
              </Field>
              {typeWord ? (
                <Field label={`Type ${typeWord} to confirm`}>
                  <Input testID="confirm-word" autoCapitalize="none" autoCorrect={false} value={typed} onChangeText={setTyped} />
                </Field>
              ) : null}
            </View>
            <View style={styles.footer}>
              <Button variant="outline" disabled={busy} onPress={() => change(false)}>Cancel</Button>
              <Button variant="destructive" disabled={busy || !ready} testID="confirm-submit" onPress={() => void submit()}>
                {busy ? 'Working…' : confirmLabel}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 448, borderWidth: 1, borderRadius: 12, padding: 24, gap: 6 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  fields: { marginTop: 12, gap: 16 },
  footer: { marginTop: 16, paddingTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
