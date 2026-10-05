import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Select } from '@/components/ui/select';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// The edit-profile page, as the web lays it out (app/account/profile/page.tsx): a back
// link, one card, the same biodata as registration in four sections, and a large
// Save button. D5/FR-ID-005. Mirrors apps/api/src/validators/profile.validator.ts and
// the web's Zod schema: change all three together.

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
  medicalNotes: string;
}

interface ProfileResponse {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine: string | null;
  occupation: string | null;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  medicalNotes: string | null;
}

type Errors = Partial<Record<keyof Values, string>>;

function toValues(p: ProfileResponse): Values {
  return {
    firstName: p.firstName,
    middleName: p.middleName ?? '',
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth.slice(0, 10),
    gender: p.gender,
    phone: p.phone,
    nationality: p.nationality,
    country: p.country,
    stateProvince: p.stateProvince,
    city: p.city,
    addressLine: p.addressLine ?? '',
    occupation: p.occupation ?? '',
    languages: p.languages.join(', '),
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    emergencyContactRelationship: p.emergencyContactRelationship,
    medicalNotes: p.medicalNotes ?? '',
  };
}

function validate(v: Values): Errors {
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
  if (v.medicalNotes.trim().length > 2000) e.medicalNotes = 'Medical notes are too long';
  if (!v.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
  else if (Number.isNaN(Date.parse(v.dateOfBirth)) || new Date(v.dateOfBirth) >= new Date()) e.dateOfBirth = 'Enter a valid past date';
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

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [v, setV] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/account');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<ProfileResponse>('/me/profile')
      .then((data) => alive && setV(toValues(data)))
      .catch((err) => alive && Alert.alert('Could not load your profile', errorMessage(err, 'Could not load your profile')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user]);

  async function submit() {
    if (!v) return;
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const data = await api<ProfileResponse>('/me/profile', {
        method: 'PATCH',
        body: {
          ...v,
          languages: v.languages.split(',').map((l) => l.trim()).filter(Boolean),
        },
      });
      setV(toValues(data));
      await refreshUser();
      Alert.alert('Profile updated.');
    } catch (err) {
      Alert.alert('Could not save your changes', errorMessage(err, 'Could not save your changes'));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || loading || !v) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <View style={styles.page}>
          <Skeleton height={384} />
        </View>
      </ThemedView>
    );
  }

  const set = (key: keyof Values) => (value: string) => setV((prev) => (prev ? { ...prev, [key]: value } : prev));

  const text = (
    name: keyof Values,
    label: string,
    opts: { hint?: string; keyboardType?: 'phone-pad' | 'default'; placeholder?: string; autoCapitalize?: 'none' | 'words' | 'sentences' } = {},
  ) => (
    <Field label={label} error={errors[name]} hint={opts.hint}>
      <Input
        testID={`profile-${name}`}
        value={v[name]}
        onChangeText={set(name)}
        keyboardType={opts.keyboardType}
        autoCapitalize={opts.autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        placeholder={opts.placeholder}
        accessibilityLabel={label}
      />
    </Field>
  );

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="link" onPress={() => router.replace('/account')} style={styles.back}>
            <ArrowLeft size={16} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.sm}>Back to account</ThemedText>
          </Pressable>
          <Card bleed={false}>
            <CardHeader>
              <CardTitle style={styles.title}>Your profile</CardTitle>
              <CardDescription>
                Private biodata. Other hashers only ever see your hash handle — this stays between you and Shiggy Trails (D5).
                Your picture and banner are changed on your account page, right on the picture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.form}>
                <Section title="About you" first>
                  {text('firstName', 'First name')}
                  {text('lastName', 'Last name')}
                  {text('middleName', 'Middle name (optional)')}
                  {text('dateOfBirth', 'Date of birth', { placeholder: 'YYYY-MM-DD', autoCapitalize: 'none' })}
                  <Field label="Gender" error={errors.gender}>
                    <Select testID="profile-gender" value={v.gender} onChange={set('gender')} options={GENDERS} />
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

                <Section title="Medical notes" description="Private to you. No one else on Shiggy Trails can see this yet.">
                  <Field label="Medical notes (optional)" error={errors.medicalNotes}>
                    <Input
                      testID="profile-medicalNotes"
                      value={v.medicalNotes}
                      onChangeText={set('medicalNotes')}
                      multiline
                      accessibilityLabel="Medical notes (optional)"
                      style={styles.textarea}
                    />
                  </Field>
                </Section>

                <Button size="lg" testID="profile-submit" disabled={busy} onPress={() => void submit()}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </View>
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
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, minHeight: 44 },
  title: { fontSize: 24, lineHeight: 32 },
  form: { gap: 24 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  fields: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
});
