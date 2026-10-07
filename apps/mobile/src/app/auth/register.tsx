import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Select } from '@/components/ui/select';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { LEGAL_DOCS, LEGAL_VERSION } from '@/lib/legal';
import { resetLegalConsent, useLegalConsent } from '@/lib/legal-consent';

// The register page, as the web lays it out (app/auth/register/page.tsx): one
// card, four sections (About you, Contact & location, Emergency contact,
// Account), the terms checkbox, a large full-width button and the way back to
// log in. Mirrors apps/api/src/validators/auth.validator.ts and the web's Zod
// schema: change all three together. D5: full biodata is required; only the hash
// handle is ever shown publicly.

const GENDERS = [
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other' },
];

interface Values {
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

const defaults: Values = {
  firstName: '', middleName: '', lastName: '', hashHandle: '', dateOfBirth: '',
  gender: 'PREFER_NOT_TO_SAY', phone: '', nationality: '', country: '', stateProvince: '', city: '',
  addressLine: '', occupation: '', languages: '', emergencyContactName: '', emergencyContactPhone: '',
  emergencyContactRelationship: '', email: '', password: '',
};

type Errors = Partial<Record<keyof Values | 'acceptTerms', string>>;

function validate(v: Values, acceptTerms: boolean): Errors {
  const e: Errors = {};
  const required = (key: keyof Values, label: string, max = 80) => {
    const value = v[key].trim();
    if (!value) e[key] = `${label} is required`;
    else if (value.length > max) e[key] = `${label} is too long`;
  };
  required('firstName', 'First name');
  required('lastName', 'Last name');
  required('phone', 'Phone', 40);
  required('nationality', 'Nationality');
  required('country', 'Country');
  required('stateProvince', 'State / province');
  required('city', 'City');
  required('emergencyContactName', 'Emergency contact name', 120);
  required('emergencyContactPhone', 'Emergency contact phone', 40);
  required('emergencyContactRelationship', 'Relationship', 60);
  if (!v.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
  else if (Number.isNaN(Date.parse(v.dateOfBirth)) || new Date(v.dateOfBirth) >= new Date()) e.dateOfBirth = 'Enter a valid past date';
  const email = v.email.trim();
  if (!email) e.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
  if (v.password.length < 8) e.password = 'At least 8 characters';
  else if (!/[A-Za-z]/.test(v.password)) e.password = 'Include at least one letter';
  else if (!/[0-9]/.test(v.password)) e.password = 'Include at least one number';
  if (!acceptTerms) e.acceptTerms = 'Read and accept both the Terms of Service and the Privacy Policy';
  return e;
}

function Section({ title, description, first, children }: { title: string; description?: string; first?: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 24 }]}>
      <View>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {description ? <ThemedText themeColor="textSecondary" style={styles.sm}>{description}</ThemedText> : null}
      </View>
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [v, setV] = useState<Values>(defaults);
  const consent = useLegalConsent();
  // The acceptance belongs to this sign-up, so start from nothing.
  useEffect(() => resetLegalConsent(), []);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Values) => (value: string) => setV((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    const found = validate(v, consent.all);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          ...v,
          email: v.email.trim().toLowerCase(),
          middleName: v.middleName.trim() || undefined,
          hashHandle: v.hashHandle.trim() || undefined,
          addressLine: v.addressLine.trim() || undefined,
          occupation: v.occupation.trim() || undefined,
          languages: v.languages.split(',').map((l) => l.trim()).filter(Boolean),
          acceptTerms: true,
          termsVersion: LEGAL_VERSION,
        },
      });
      // D31: no session yet. Send them to confirm their address rather than
      // welcoming them into an app they cannot use.
      router.replace({ pathname: '/auth/verify', params: { sent: v.email.trim().toLowerCase() } });
    } catch (err) {
      Alert.alert('Could not create your account', errorMessage(err, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  }

  const text = (
    name: keyof Values,
    label: string,
    opts: { hint?: string; keyboardType?: 'email-address' | 'phone-pad' | 'default'; secure?: boolean; autoCapitalize?: 'none' | 'words' | 'sentences'; placeholder?: string } = {},
  ) => (
    <Field label={label} error={errors[name]} hint={opts.hint}>
      <Input
        testID={`register-${name}`}
        value={v[name]}
        onChangeText={set(name)}
        keyboardType={opts.keyboardType}
        secureTextEntry={opts.secure}
        autoCapitalize={opts.autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        placeholder={opts.placeholder}
        accessibilityLabel={label}
      />
    </Field>
  );

  const handle = v.hashHandle.trim() || `Just ${v.firstName.trim() || 'your first name'}`;

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Card bleed={false}>
            <CardHeader>
              <View style={styles.mark}>
                <HashLogo size={56} color={theme.text} />
              </View>
              <CardTitle style={styles.title}>Join Shiggy Trails</CardTitle>
              <CardDescription>
                Your details stay private. Other hashers only see your hash handle, or{' '}
                <ThemedText style={[styles.sm, styles.bold]}>“{handle}”</ThemedText> until your kennel names you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.form}>
                <Section title="About you" first>
                  {text('firstName', 'First name')}
                  {text('lastName', 'Last name')}
                  {text('middleName', 'Middle name (optional)')}
                  {text('hashHandle', 'Hash handle (optional)', { hint: 'Leave blank if you have not been named yet.' })}
                  {text('dateOfBirth', 'Date of birth', { placeholder: 'YYYY-MM-DD', autoCapitalize: 'none' })}
                  <Field label="Gender" error={errors.gender}>
                    <Select testID="register-gender" value={v.gender} onChange={set('gender')} options={GENDERS} />
                  </Field>
                  {text('nationality', 'Nationality')}
                  {text('occupation', 'Occupation (optional)')}
                  {text('languages', 'Languages (optional)', { hint: 'Comma separated, e.g. English, Igbo' })}
                </Section>

                <Section title="Contact & location">
                  {text('phone', 'Phone', { keyboardType: 'phone-pad' })}
                  {text('country', 'Country')}
                  {text('stateProvince', 'State / province')}
                  {text('city', 'City')}
                  {text('addressLine', 'Address (optional)')}
                </Section>

                <Section title="Emergency contact" description="Used only by run organisers in an emergency.">
                  {text('emergencyContactName', 'Name')}
                  {text('emergencyContactPhone', 'Phone', { keyboardType: 'phone-pad' })}
                  {text('emergencyContactRelationship', 'Relationship')}
                </Section>

                <Section title="Account">
                  {text('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
                  {text('password', 'Password', { secure: true, autoCapitalize: 'none', hint: '8+ characters with a letter and a number' })}
                </Section>

                <View style={styles.terms}>
                  <ThemedText style={styles.termsTitle}>Terms and privacy</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.xs}>Read each document to the end and accept it to create your account.</ThemedText>
                  {(['terms', 'privacy'] as const).map((slug) => {
                    const accepted = consent[slug];
                    return (
                      <Pressable
                        key={slug}
                        accessibilityRole="button"
                        accessibilityLabel={`${LEGAL_DOCS[slug].title}, ${accepted ? 'accepted' : 'read and accept'}`}
                        testID={`register-read-${slug}`}
                        onPress={() => router.push(`/legal/${slug}` as never)}
                        style={[styles.termsRow, { borderColor: accepted ? theme.primaryStrong : theme.border }]}>
                        <View style={[styles.box, { borderColor: accepted ? theme.primary : theme.border, backgroundColor: accepted ? theme.primary : 'transparent' }]}>
                          {accepted && <Check size={12} color={theme.onPrimary} />}
                        </View>
                        <ThemedText style={styles.termsText}>{LEGAL_DOCS[slug].title}</ThemedText>
                        <ThemedText style={[styles.xs, { color: accepted ? theme.primaryStrong : theme.textSecondary }]}>{accepted ? 'Accepted' : 'Read and accept'}</ThemedText>
                        <ChevronRight size={16} color={theme.textSecondary} />
                      </Pressable>
                    );
                  })}
                  {errors.acceptTerms ? (
                    <ThemedText accessibilityRole="alert" style={[styles.xs, { color: theme.danger }]}>{errors.acceptTerms}</ThemedText>
                  ) : null}
                </View>

                <Button size="lg" testID="register-submit" disabled={busy} onPress={() => void submit()}>
                  {busy ? 'Creating your account…' : 'Create account'}
                </Button>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.footer}>
                Already hashing with us?{' '}
                <ThemedText style={[styles.link, { color: theme.primaryStrong }]} onPress={() => router.replace('/account')}>
                  Log in
                </ThemedText>
              </ThemedText>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  // mx-auto max-w-3xl px-4 py-12
  page: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 48 },
  mark: { marginBottom: 8 },
  title: { fontSize: 24, lineHeight: 32 },
  form: { gap: 24 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  fields: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  bold: { fontWeight: '700' },
  terms: { gap: 8 },
  termsTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 },
  box: { marginTop: 2, width: 16, height: 16, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  termsText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
