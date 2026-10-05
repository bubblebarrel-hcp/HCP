import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LocationPicker } from '@/components/map/location-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api, errorMessage } from '@/lib/api';

// FR-KENNEL-001 (D33), as the web lays it out (app/kennels/new/page.tsx): one card,
// the fields, a map to drop a pin on, and "Start the kennel". Mirrors foundKennelSchema
// in apps/api/src/validators/kennel.validator.ts and the web's Zod schema: change all
// three together.
interface Values {
  name: string;
  shortName: string;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: string;
  longitude: string;
  description: string;
  motto: string;
  meetingDay: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

function coordinate(label: string, bound: number, v: string) {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) || Math.abs(n) > bound ? `${label} must be a number between -${bound} and ${bound}` : undefined;
}

function validate(v: Values): Errors {
  const e: Errors = {};
  const required = (key: keyof Values, label: string, max = 80) => {
    const value = v[key].trim();
    if (!value) e[key] = `${label} is required`;
    else if (value.length > max) e[key] = `${label} is too long`;
  };
  required('name', 'Name', 120);
  required('shortName', 'Short name', 40);
  required('country', 'Country');
  required('stateProvince', 'State or province');
  required('city', 'City');
  required('timeZone', 'Time zone', 60);
  required('description', 'Description', 4000);
  const lat = coordinate('Latitude', 90, v.latitude);
  const lng = coordinate('Longitude', 180, v.longitude);
  if (lat) e.latitude = lat;
  if (lng) e.longitude = lng;
  if (v.motto.trim().length > 200) e.motto = 'Motto is too long';
  if (v.meetingDay.trim().length > 40) e.meetingDay = 'Usual run day is too long';
  return e;
}

// Both or neither: a single coordinate cannot put a pin anywhere.
function toCoordinates(v: Values) {
  const latitude = v.latitude.trim() === '' ? null : Number(v.latitude);
  const longitude = v.longitude.trim() === '' ? null : Number(v.longitude);
  return latitude === null || longitude === null ? { latitude: null, longitude: null } : { latitude, longitude };
}

export default function NewKennelScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [v, setV] = useState<Values>(() => ({
    name: '', shortName: '', country: '', stateProvince: '', city: '', timeZone: deviceTimeZone(),
    latitude: '', longitude: '', description: '', motto: '', meetingDay: '',
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof Values) => (value: string) => setV((prev) => ({ ...prev, [key]: value }));
  // The picker and the two fields are the same value seen twice.
  const point = toCoordinates(v);

  async function submit() {
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      const data = await api<{ kennel: { slug: string } }>('/kennels', {
        method: 'POST',
        body: {
          name: v.name.trim(),
          shortName: v.shortName.trim(),
          country: v.country.trim(),
          stateProvince: v.stateProvince.trim(),
          city: v.city.trim(),
          timeZone: v.timeZone.trim(),
          description: v.description.trim(),
          ...toCoordinates(v),
          motto: v.motto.trim() || null,
          meetingDay: v.meetingDay.trim() || null,
        },
      });
      router.replace(`/kennels/${data.kennel.slug}`);
    } catch (err) {
      Alert.alert('Could not start your kennel', errorMessage(err, 'Could not start your kennel'));
      setSubmitting(false);
    }
  }

  const text = (name: keyof Values, label: string, hint?: string, opts: { numeric?: boolean; placeholder?: string } = {}) => (
    <Field label={label} error={errors[name]} hint={hint}>
      <Input
        testID={`found-${name}`}
        value={v[name]}
        onChangeText={set(name)}
        keyboardType={opts.numeric ? 'numbers-and-punctuation' : 'default'}
        autoCapitalize={name === 'timeZone' ? 'none' : 'sentences'}
        autoCorrect={false}
        accessibilityLabel={label}
      />
    </Field>
  );

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );

  if (loading) return shell(<Skeleton height={384} />);

  if (!user) {
    return shell(
      <Card style={styles.signin}>
        <View testID="found-signin" style={styles.center}>
          <ThemedText style={styles.bold}>Log in to start a kennel</ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.sm, styles.centerText, styles.mt4]}>
            A kennel needs someone accountable for it, so we need to know who you are.
          </ThemedText>
          <Button style={styles.mt16} onPress={() => router.push('/account')}>Log in</Button>
        </View>
      </Card>,
    );
  }

  return shell(
    <Card>
      <View testID="found-kennel">
        <CardHeader>
          <CardTitle style={styles.title}>Start a kennel</CardTitle>
          <CardDescription>
            You will be its first member and its provisional admin. It stays unverified until four of your mismanagement hold
            office, which you can set up straight after.
          </CardDescription>
        </CardHeader>
        <CardContent style={styles.form}>
          {text('name', 'Name', 'The full name, e.g. Jos Hash House Harriers')}
          {text('shortName', 'Short name', 'What hashers actually call it, e.g. Jos H3')}
          {text('country', 'Country')}
          {text('stateProvince', 'State or province')}
          {text('city', 'City')}
          {text('timeZone', 'Time zone', 'e.g. Africa/Lagos')}

          {/* A kennel with no coordinates is listed but never pinned, so this is asked for at
              founding rather than left to be noticed later (D38). */}
          <View style={styles.location}>
            <ThemedText style={[styles.sm, styles.medium]}>Where on the map (optional)</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              Drop a pin where you meet and your kennel appears on the world map the day it goes live. You can change it later in
              kennel settings.
            </ThemedText>
            <LocationPicker
              latitude={point.latitude}
              longitude={point.longitude}
              onChange={(next) => setV((prev) => ({ ...prev, latitude: String(next.latitude), longitude: String(next.longitude) }))}
            />
            {text('latitude', 'Latitude', 'e.g. 9.8965', { numeric: true })}
            {text('longitude', 'Longitude', 'e.g. 8.8583', { numeric: true })}
          </View>

          <Field label="Description" error={errors.description}>
            <Input
              testID="found-description"
              value={v.description}
              onChangeText={set('description')}
              multiline
              accessibilityLabel="Description"
              style={styles.textarea}
            />
          </Field>
          {text('motto', 'Motto (optional)', 'On On through the rocks')}
          {text('meetingDay', 'Usual run day (optional)', 'Saturday')}
          <Button testID="found-submit" disabled={submitting} style={styles.start} onPress={() => void submit()}>
            {submitting ? 'Starting…' : 'Start the kennel'}
          </Button>
          <ThemedText themeColor="textSecondary" style={styles.sm}>
            Two kennels cannot share a name in the same city, and you can only have one awaiting verification at a time.
          </ThemedText>
        </CardContent>
      </View>
    </Card>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
  title: { fontSize: 24, lineHeight: 32 },
  form: { gap: 16 },
  location: { gap: 12 },
  signin: { padding: 32 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  mt4: { marginTop: 4 },
  mt16: { marginTop: 16 },
  start: { alignSelf: 'flex-start' },
  textarea: { minHeight: 104, textAlignVertical: 'top', paddingTop: 10 },
});
