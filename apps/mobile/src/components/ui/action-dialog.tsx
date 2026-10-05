import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { Button, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// The web app's confirm dialog (components/membership/ActionDialog.tsx): a title,
// a line of explanation, an optional reason box, Cancel and a confirm button
// that goes red for something destructive. `onConfirm` may throw to keep the
// dialog open (the caller has already said why).
export function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  text,
  until,
  types,
  typesLabel = 'Join as',
  defaultType,
  onConfirm,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  text?: { label: string; placeholder?: string; required?: boolean; hint?: string; marked?: boolean };
  // An optional "until" date (YYYY-MM-DD), as in suspending a member for a while.
  until?: { label: string; hint?: string };
  // A "Join as" list for choices such as a membership type; the first is chosen.
  types?: { value: string; label: string; hint?: string }[];
  typesLabel?: string;
  defaultType?: string;
  onConfirm: (values: { text: string; type: string; until: string }) => Promise<void> | void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState('');
  const [untilValue, setUntilValue] = useState('');
  const [type, setType] = useState(defaultType ?? types?.[0]?.value ?? '');

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm({ text: value.trim(), type, until: untilValue });
      setOpen(false);
      setValue('');
      setUntilValue('');
    } catch {
      // Stays open; the caller reported the failure.
    } finally {
      setBusy(false);
    }
  }

  const blocked = Boolean(text?.required && value.trim().length < 3);

  return (
    <>
      {trigger(() => setOpen(true))}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
            {description ? <ThemedText themeColor="textSecondary" style={styles.description}>{description}</ThemedText> : null}
            {types ? (
              <View style={styles.field}>
                <ThemedText style={styles.typeLabel}>{typesLabel}</ThemedText>
                {types.map((t) => {
                  const selected = type === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setType(t.value)}
                      style={[styles.type, { borderColor: selected ? theme.primary : theme.border }]}>
                      <ThemedText style={styles.typeName}>{t.label}</ThemedText>
                      {t.hint ? <ThemedText themeColor="textSecondary" style={styles.typeHint}>{t.hint}</ThemedText> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {text ? (
              <View style={styles.field}>
                <Field label={text.marked ? `${text.label} ${text.required ? '(required)' : '(optional)'}` : text.label} hint={text.hint}>
                  <Input value={value} onChangeText={setValue} placeholder={text.placeholder} multiline style={styles.multiline} />
                </Field>
              </View>
            ) : null}
            {until ? (
              <View style={styles.field}>
                <Field label={`${until.label} (optional)`} hint={until.hint}>
                  <DateField value={untilValue} onChange={setUntilValue} />
                </Field>
              </View>
            ) : null}
            <View style={styles.footer}>
              <Button variant="outline" disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
              <Button variant={destructive ? 'destructive' : 'default'} disabled={busy || blocked} busy={busy} onPress={() => void confirm()}>
                {confirmLabel}
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
  field: { marginTop: 12 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  typeLabel: { fontSize: 14, lineHeight: 14, fontWeight: '500', marginBottom: 6 },
  type: { borderWidth: 2, borderRadius: 8, padding: 12, marginBottom: 8, minHeight: 44, justifyContent: 'center' },
  typeName: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  typeHint: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  footer: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
