import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { CheckRow } from '@/components/ui/check-row';
import { FormDialog } from '@/components/ui/form-dialog';
import { Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { RunDetail } from '@/lib/types';

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  checkIn: boolean;
}

const empty: Values = { firstName: '', lastName: '', email: '', phone: '', consent: false, checkIn: false };

// D23, as the web has it (components/runs/GuestDialog.tsx): a guest gives first name,
// last name, email and consent; phone is optional. Officers adding a walk-in can check
// them in straight away.
export function GuestDialog({
  runId,
  trigger,
  officer = false,
  allowCheckIn = false,
  onDone,
}: {
  runId: string;
  trigger: (open: () => void) => React.ReactNode;
  officer?: boolean;
  allowCheckIn?: boolean;
  onDone: (run: RunDetail) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function close() {
    setOpen(false);
    setValues(empty);
    setErrors({});
  }

  async function submit() {
    const next: typeof errors = {};
    if (!values.firstName.trim()) next.firstName = 'Enter a first name';
    if (!values.lastName.trim()) next.lastName = 'Enter a last name';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) next.email = 'Enter a valid email';
    if (!values.consent) next.consent = 'Consent is needed to record a guest';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const data = await api<{ run: RunDetail; registration: { displayName: string } }>(`/runs/${runId}/guests`, {
        method: 'POST',
        body: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          consent: true,
          checkIn: officer && allowCheckIn && values.checkIn,
        },
      });
      onDone(data.run);
      Alert.alert(officer ? `${data.registration.displayName} added.` : "You're registered. See you on trail!");
      close();
    } catch (err) {
      Alert.alert('Could not register the guest', errorMessage(err, 'Could not register the guest'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      <FormDialog
        open={open}
        onClose={close}
        busy={busy}
        testID="guest-dialog"
        submitTestID="guest-dialog-submit"
        title={officer ? 'Add a guest' : 'Register as a guest'}
        description={officer ? 'For someone hashing without a Shiggy Trails account.' : 'No account needed. The hares will know you are coming.'}
        submitLabel={busy ? 'Saving…' : officer ? 'Add guest' : 'Register'}
        onSubmit={() => void submit()}>
        <Field label="First name" error={errors.firstName}>
          <Input value={values.firstName} autoComplete="given-name" onChangeText={(t) => set('firstName', t)} accessibilityLabel="First name" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={values.lastName} autoComplete="family-name" onChangeText={(t) => set('lastName', t)} accessibilityLabel="Last name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            value={values.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            onChangeText={(t) => set('email', t)}
            accessibilityLabel="Email"
          />
        </Field>
        <Field label="Phone (optional)">
          <Input value={values.phone} keyboardType="phone-pad" autoComplete="tel" onChangeText={(t) => set('phone', t)} accessibilityLabel="Phone (optional)" />
        </Field>
        <View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: values.consent }}
            onPress={() => set('consent', !values.consent)}
            style={styles.consent}>
            <View style={[styles.box, { borderColor: values.consent ? theme.primary : theme.border, backgroundColor: values.consent ? theme.primary : 'transparent' }]}>
              {values.consent ? <Check size={14} color={theme.onPrimary} strokeWidth={3} /> : null}
            </View>
            <ThemedText style={styles.consentText}>
              {officer ? 'The guest agrees' : 'I agree'} that Shiggy Trails stores this name and email to record the run.
            </ThemedText>
          </Pressable>
          {errors.consent ? (
            <ThemedText accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{errors.consent}</ThemedText>
          ) : null}
        </View>
        {officer && allowCheckIn ? <CheckRow label="Check them in now" checked={values.checkIn} onChange={(v) => set('checkIn', v)} /> : null}
      </FormDialog>
    </>
  );
}

const styles = StyleSheet.create({
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: { marginTop: 2, width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  error: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '400' },
});
