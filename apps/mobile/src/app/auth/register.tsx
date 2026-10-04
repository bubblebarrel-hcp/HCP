import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

type Theme = ReturnType<typeof useTheme>;

// Mirrors apps/api/src/validators/auth.validator.ts (Joi) and the web Zod
// schema at apps/web/app/auth/register/page.tsx. Change all three together.
// D5: full biodata is required; only the hash handle is ever shown publicly.

const GENDERS: { value: string; label: string }[] = [
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other' },
];

interface Form {
  firstName: string;
  middleName: string;
  lastName: string;
  hashHandle: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine: string;
  occupation: string;
  languages: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  email: string;
  password: string;
}

const initial: Form = {
  firstName: '', middleName: '', lastName: '', hashHandle: '', dateOfBirth: '',
  gender: 'PREFER_NOT_TO_SAY', phone: '', nationality: '', country: '', stateProvince: '', city: '',
  addressLine: '', occupation: '', languages: '', emergencyContactName: '', emergencyContactPhone: '',
  emergencyContactRelationship: '', email: '', password: '',
};

const REQUIRED: (keyof Form)[] = [
  'firstName', 'lastName', 'dateOfBirth', 'phone', 'nationality', 'country', 'stateProvince', 'city',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'email', 'password',
];

function FormField({
  label,
  value,
  onChangeText,
  theme,
  keyboardType = 'default',
  secure,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: Theme;
  keyboardType?: 'email-address' | 'phone-pad' | 'default';
  secure?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
      />
    </View>
  );
}

function validate(f: Form): string | null {
  for (const key of REQUIRED) {
    if (!f[key].trim()) return 'Fill in every required field.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateOfBirth.trim()) || Number.isNaN(Date.parse(f.dateOfBirth)) || new Date(f.dateOfBirth) >= new Date()) {
    return 'Enter date of birth as YYYY-MM-DD, in the past.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email.';
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) {
    return 'Password needs 8+ characters with a letter and a number.';
  }
  return null;
}

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setError(null);
    const problem = validate(f);
    if (problem) {
      setError(problem);
      return;
    }
    if (!acceptTerms) {
      setError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ emailSentTo: string }>('/auth/register', {
        method: 'POST',
        body: {
          ...f,
          email: f.email.trim().toLowerCase(),
          middleName: f.middleName.trim() || undefined,
          hashHandle: f.hashHandle.trim() || undefined,
          addressLine: f.addressLine.trim() || undefined,
          occupation: f.occupation.trim() || undefined,
          languages: f.languages.split(',').map((l) => l.trim()).filter(Boolean),
          acceptTerms: true,
        },
      });
      router.replace({ pathname: '/auth/verify', params: { email: data.emailSentTo } });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="title">Join Shiggy Trails</ThemedText>
          <ThemedText themeColor="textSecondary">
            Your details stay private. Other hashers only see your hash handle — or “Just {f.firstName.trim() || 'your first name'}” until your kennel names you.
          </ThemedText>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>About you</ThemedText>
          <FormField label="First name" value={f.firstName} onChangeText={set('firstName')} theme={theme} autoCapitalize="words" />
          <FormField label="Last name" value={f.lastName} onChangeText={set('lastName')} theme={theme} autoCapitalize="words" />
          <FormField label="Middle name (optional)" value={f.middleName} onChangeText={set('middleName')} theme={theme} autoCapitalize="words" />
          <FormField label="Hash handle (optional)" value={f.hashHandle} onChangeText={set('hashHandle')} theme={theme} />
          <FormField label="Date of birth (YYYY-MM-DD)" value={f.dateOfBirth} onChangeText={set('dateOfBirth')} theme={theme} />
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">Gender</ThemedText>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => {
                const active = f.gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => set('gender')(g.value)}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: active ? theme.primary : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
                    ]}>
                    <ThemedText type="small" style={{ color: active ? theme.onPrimary : theme.text }}>{g.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <FormField label="Nationality" value={f.nationality} onChangeText={set('nationality')} theme={theme} />
          <FormField label="Occupation (optional)" value={f.occupation} onChangeText={set('occupation')} theme={theme} />
          <FormField label="Languages (optional, comma separated)" value={f.languages} onChangeText={set('languages')} theme={theme} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>Contact & location</ThemedText>
          <FormField label="Phone" value={f.phone} onChangeText={set('phone')} theme={theme} keyboardType="phone-pad" />
          <FormField label="Country" value={f.country} onChangeText={set('country')} theme={theme} />
          <FormField label="State / province" value={f.stateProvince} onChangeText={set('stateProvince')} theme={theme} />
          <FormField label="City" value={f.city} onChangeText={set('city')} theme={theme} />
          <FormField label="Address (optional)" value={f.addressLine} onChangeText={set('addressLine')} theme={theme} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>Emergency contact</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Used only by run organisers in an emergency.</ThemedText>
          <FormField label="Name" value={f.emergencyContactName} onChangeText={set('emergencyContactName')} theme={theme} autoCapitalize="words" />
          <FormField label="Phone" value={f.emergencyContactPhone} onChangeText={set('emergencyContactPhone')} theme={theme} keyboardType="phone-pad" />
          <FormField label="Relationship" value={f.emergencyContactRelationship} onChangeText={set('emergencyContactRelationship')} theme={theme} />

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>Account</ThemedText>
          <FormField label="Email" value={f.email} onChangeText={set('email')} theme={theme} keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Password" value={f.password} onChangeText={set('password')} theme={theme} secure autoCapitalize="none" />
          <ThemedText type="small" themeColor="textSecondary">8+ characters with a letter and a number</ThemedText>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptTerms }}
            onPress={() => setAcceptTerms((v) => !v)}
            style={styles.termsRow}>
            <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: acceptTerms ? theme.primary : 'transparent' }]} />
            <ThemedText type="small" style={styles.termsText}>I accept the Terms of Service and Privacy Policy.</ThemedText>
          </Pressable>

          {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

          <Pressable
            accessibilityRole="button"
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.7 : 1 }]}>
            {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Create account</ThemedText>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  section: { marginTop: Spacing.two },
  field: { gap: 4 },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minHeight: 40, justifyContent: 'center' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, minHeight: 44, paddingVertical: Spacing.two },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 4, marginTop: 2 },
  termsText: { flex: 1 },
  button: { borderRadius: Spacing.two, paddingVertical: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
});
