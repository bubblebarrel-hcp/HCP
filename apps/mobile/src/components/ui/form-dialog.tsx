import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// The web's Dialog with a form in it (components/ui/dialog.tsx): a centred card over a
// dimmed backdrop, a title and a line of explanation, the fields, and Cancel plus a
// submit button right-aligned. The caller owns `open` and `busy`.
export function FormDialog({
  open,
  onClose,
  title,
  description,
  children,
  submitLabel,
  busy,
  onSubmit,
  testID,
  submitTestID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  submitLabel: string;
  busy?: boolean;
  onSubmit: () => void;
  testID?: string;
  submitTestID?: string;
}) {
  const theme = useTheme();
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View testID={testID} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <View style={styles.head}>
              <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
              {description ? <ThemedText themeColor="textSecondary" style={styles.description}>{description}</ThemedText> : null}
            </View>
            {children}
            <View style={styles.footer}>
              <Button variant="outline" disabled={busy} onPress={close}>Cancel</Button>
              <Button disabled={busy} busy={busy} testID={submitTestID} onPress={onSubmit}>{submitLabel}</Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 512, maxHeight: '90%', borderWidth: 1, borderRadius: 12 },
  body: { padding: 24, gap: 16 },
  head: { gap: 6 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 8 },
});
