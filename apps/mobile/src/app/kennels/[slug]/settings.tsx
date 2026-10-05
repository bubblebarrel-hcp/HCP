import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AlertTriangle, Settings2, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { LocationPicker } from '@/components/map/location-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { CheckRow } from '@/components/ui/check-row';
import { Select } from '@/components/ui/select';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { KennelSettings } from '@/lib/types';

// A kennel's own admins run it from here (D34), as the web lays it out
// (app/kennels/[slug]/settings/page.tsx). Standing and verification are deliberately
// read-only: they are the platform's to set, and the API strips them even if they arrive.
// Mirrors kennelSettingsSchema in apps/api/src/validators/kennel.validator.ts and the
// web's Zod schema: change all three together.
interface Values {
  name: string;
  shortName: string;
  description: string;
  motto: string;
  meetingDay: string;
  landingMessage: string;
  primaryColor: string;
  secondaryColor: string;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: string;
  longitude: string;
  visibility: string;
  defaultRunVisibility: string;
  downDownsEnabled: boolean;
  hareNudgeSoonDays: string;
  hareNudgeUrgentDays: string;
}

type Errors = Partial<Record<keyof Values, string>>;

// The fallback the cover background and brand colour use when a kennel has none of its
// own (D24): shown as the swatch's starting point, never saved unless the admin picks one.
const DEFAULT_PRIMARY = '#F4511E';
const DEFAULT_SECONDARY = '#171717';
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const KENNEL_VISIBILITY = [
  { value: 'PUBLIC', label: 'Public — Listed in the directory and on the map.' },
  { value: 'UNLISTED', label: 'Unlisted — Reachable by link, but not listed.' },
  { value: 'HIDDEN', label: 'Hidden — Members only. Nobody else can find it.' },
];

const RUN_VISIBILITY = [
  { value: 'PUBLIC', label: 'Public — Anyone can see the run and ask to come.' },
  { value: 'MEMBERS_ONLY', label: 'Members only — Only your members see it.' },
  { value: 'INVITE_ONLY', label: 'Invite only — Only hashers you invite see it.' },
];

function toForm(s: KennelSettings): Values {
  return {
    name: s.name,
    shortName: s.shortName,
    description: s.description ?? '',
    motto: s.motto ?? '',
    meetingDay: s.meetingDay ?? '',
    landingMessage: s.landingMessage ?? '',
    primaryColor: s.primaryColor ?? '',
    secondaryColor: s.secondaryColor ?? '',
    country: s.country,
    stateProvince: s.stateProvince,
    city: s.city,
    timeZone: s.timeZone,
    latitude: s.latitude === null ? '' : String(s.latitude),
    longitude: s.longitude === null ? '' : String(s.longitude),
    visibility: s.visibility,
    defaultRunVisibility: s.defaultRunVisibility,
    downDownsEnabled: s.downDownsEnabled,
    hareNudgeSoonDays: s.hareNudgeSoonDays === null ? '' : String(s.hareNudgeSoonDays),
    hareNudgeUrgentDays: s.hareNudgeUrgentDays === null ? '' : String(s.hareNudgeUrgentDays),
  };
}

function coordinate(label: string, bound: number, v: string) {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) || Math.abs(n) > bound ? `${label} must be a number between -${bound} and ${bound}` : undefined;
}

function dayCount(label: string, min: number, v: string) {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n >= min && n <= 180 ? undefined : `${label} must be a whole number of days`;
}

function validate(v: Values): Errors {
  const e: Errors = {};
  const required = (key: keyof Values, label: string, max: number) => {
    const value = String(v[key]).trim();
    if (!value) e[key] = `${label} is required`;
    else if (value.length > max) e[key] = `${label} is too long`;
  };
  required('name', 'Name', 120);
  required('shortName', 'Short name', 40);
  required('description', 'Description', 4000);
  required('country', 'Country', 80);
  required('stateProvince', 'State or province', 80);
  required('city', 'City', 80);
  required('timeZone', 'Time zone', 60);
  if (v.motto.trim().length > 200) e.motto = 'Motto is too long';
  if (v.meetingDay.trim().length > 40) e.meetingDay = 'Usual run day is too long';
  if (v.landingMessage.trim().length > 2000) e.landingMessage = 'Welcome message is too long';
  for (const key of ['primaryColor', 'secondaryColor'] as const) {
    if (v[key].trim() !== '' && !HEX.test(v[key].trim())) e[key] = 'Enter a hex colour, e.g. #F4511E';
  }
  const lat = coordinate('Latitude', 90, v.latitude);
  const lng = coordinate('Longitude', 180, v.longitude);
  if (lat) e.latitude = lat;
  if (lng) e.longitude = lng;
  const soon = dayCount('Soon', 1, v.hareNudgeSoonDays);
  const urgent = dayCount('Urgent', 0, v.hareNudgeUrgentDays);
  if (soon) e.hareNudgeSoonDays = soon;
  if (urgent) e.hareNudgeUrgentDays = urgent;
  return e;
}

// Both or neither: a single coordinate cannot put a pin anywhere.
function toCoordinates(v: Pick<Values, 'latitude' | 'longitude'>) {
  const latitude = v.latitude.trim() === '' ? null : Number(v.latitude);
  const longitude = v.longitude.trim() === '' ? null : Number(v.longitude);
  return latitude === null || longitude === null ? { latitude: null, longitude: null } : { latitude, longitude };
}

export default function KennelSettingsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading } = useAuth();
  const [settings, setSettings] = useState<KennelSettings | null>(null);
  const [v, setV] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<KennelSettings>(`/kennels/${slug}/settings`)
      .then((data) => {
        if (!alive) return;
        setSettings(data);
        setV(toForm(data));
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, 'You cannot manage this kennel.')));
    return () => {
      alive = false;
    };
  }, [slug, loading]);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.denied}>
        <ThemedText testID="settings-denied" style={styles.bold}>{error}</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace(`/kennels/${slug}`)}>Back to the kennel</Button>
      </Card>,
    );
  }
  if (!settings || !v) return shell(<Skeleton height={384} />);

  const set = <K extends keyof Values>(key: K) => (value: Values[K]) => setV((prev) => (prev ? { ...prev, [key]: value } : prev));
  const point = toCoordinates(v);
  const pending = settings.status === 'PENDING_VERIFICATION';

  async function save() {
    if (!v) return;
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      // Empty optional text means "clear it", which the API stores as null.
      const data = await api<{ kennel: KennelSettings }>(`/kennels/${slug}/settings`, {
        method: 'PATCH',
        body: {
          name: v.name.trim(),
          shortName: v.shortName.trim(),
          description: v.description.trim(),
          country: v.country.trim(),
          stateProvince: v.stateProvince.trim(),
          city: v.city.trim(),
          timeZone: v.timeZone.trim(),
          visibility: v.visibility,
          defaultRunVisibility: v.defaultRunVisibility,
          downDownsEnabled: v.downDownsEnabled,
          ...toCoordinates(v),
          motto: v.motto.trim() || null,
          meetingDay: v.meetingDay.trim() || null,
          landingMessage: v.landingMessage.trim() || null,
          primaryColor: v.primaryColor.trim() || null,
          secondaryColor: v.secondaryColor.trim() || null,
          hareNudgeSoonDays: v.hareNudgeSoonDays.trim() === '' ? null : Number(v.hareNudgeSoonDays),
          hareNudgeUrgentDays: v.hareNudgeUrgentDays.trim() === '' ? null : Number(v.hareNudgeUrgentDays),
        },
      });
      // The slug never changes, so a rename keeps this page's address.
      setSettings((prev) => (prev ? { ...prev, ...data.kennel } : prev));
      Alert.alert('Saved. Public pages can take a minute to catch up.');
    } catch (err) {
      Alert.alert('Could not save those settings', errorMessage(err, 'Could not save those settings'));
    } finally {
      setSaving(false);
    }
  }

  const short = (name: keyof Values, label: string, hint?: string, opts: { numeric?: boolean; placeholder?: string } = {}) => (
    <Field label={label} error={errors[name]} hint={hint}>
      <Input
        testID={`settings-${name}`}
        value={String(v[name])}
        onChangeText={(t) => set(name)(t as never)}
        keyboardType={opts.numeric ? 'numbers-and-punctuation' : 'default'}
        autoCapitalize={name === 'timeZone' ? 'none' : 'sentences'}
        autoCorrect={false}
        placeholder={opts.placeholder}
        accessibilityLabel={label}
      />
    </Field>
  );

  return shell(
    <>
      <Card>
        <CardHeader>
          <View style={styles.titleRow}>
            <Settings2 size={20} color={theme.text} />
            <CardTitle>Kennel settings</CardTitle>
          </View>
          <CardDescription>
            How {settings.shortName} introduces itself and who can see it. Standing and verification are set by the platform, not
            from here.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ─── Standing: read-only, because it is not the kennel's to grant itself ─── */}
      <Card>
        <View testID="settings-standing">
          <CardHeader style={styles.tight}>
            <View style={styles.titleRow}>
              <ShieldCheck size={16} color={theme.text} />
              <CardTitle style={styles.h3}>Standing</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.gap8}>
            <View style={styles.wrapRow}>
              <Badge>{settings.status.replace(/_/g, ' ').toLowerCase()}</Badge>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                Verification: {settings.verificationLevel.replace(/_/g, ' ').toLowerCase()}
              </ThemedText>
            </View>
            {pending && (
              <ThemedText themeColor="textSecondary" testID="settings-mismanagement" style={styles.sm}>
                {settings.mismanagementCount} of {settings.mismanagementNeeded} mismanagement offices filled.{' '}
                {settings.mismanagementCount >= settings.mismanagementNeeded ? (
                  'The platform reviews it from here.'
                ) : (
                  <ThemedText
                    accessibilityRole="link"
                    onPress={() => router.push(`/kennels/${slug}/officers`)}
                    style={[styles.sm, styles.link, { color: theme.primaryStrong }]}>
                    Appoint officers
                  </ThemedText>
                )}
              </ThemedText>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-identity">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Identity</CardTitle>
            <CardDescription>The web address stays {slug} even if the name changes.</CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {short('name', 'Name')}
            {short('shortName', 'Short name')}
            <Field label="Description" error={errors.description}>
              <Input
                testID="settings-description"
                value={v.description}
                onChangeText={set('description')}
                multiline
                accessibilityLabel="Description"
                style={styles.textarea}
              />
            </Field>
            {short('motto', 'Motto (optional)')}
            {short('meetingDay', 'Usual run day (optional)')}
            <Field label="Welcome message (optional)" error={errors.landingMessage} hint="What a visitor reads before deciding to come out.">
              <Input
                testID="settings-landingMessage"
                value={v.landingMessage}
                onChangeText={set('landingMessage')}
                multiline
                accessibilityLabel="Welcome message (optional)"
                style={[styles.textarea, styles.shortArea]}
              />
            </Field>
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-colours">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Brand colours</CardTitle>
            <CardDescription>Shown on your kennel page, cards and avatars. Leave blank for Shiggy Trails’ defaults.</CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {(['primaryColor', 'secondaryColor'] as const).map((name) => {
              const label = name === 'primaryColor' ? 'Primary colour' : 'Secondary colour';
              const fallback = name === 'primaryColor' ? DEFAULT_PRIMARY : DEFAULT_SECONDARY;
              const swatch = HEX.test(v[name].trim()) ? v[name].trim() : fallback;
              return (
                <Field key={name} label={label} error={errors[name]}>
                  <View style={styles.colourRow}>
                    <View testID={`settings-${name}-picker`} style={[styles.swatch, { backgroundColor: swatch, borderColor: theme.border }]} />
                    <View style={styles.flex}>
                      <Input
                        testID={`settings-${name}`}
                        value={v[name]}
                        onChangeText={(t) => set(name)(t.toUpperCase())}
                        placeholder={fallback}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        accessibilityLabel={label}
                      />
                    </View>
                  </View>
                </Field>
              );
            })}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-place">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Where you hash</CardTitle>
            <CardDescription>This is what puts your pin on the map.</CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {short('country', 'Country')}
            {short('stateProvince', 'State or province')}
            {short('city', 'City')}
            {short('timeZone', 'Time zone', 'e.g. Africa/Lagos')}
            {/* Without coordinates a kennel is listed but never pinned (D38). */}
            <View testID="settings-coordinates" style={styles.stack}>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                {point.latitude === null
                  ? `No pin yet, so ${settings.shortName} is listed but does not appear on the world map.`
                  : 'Drag the pin or tap the map to move it.'}
              </ThemedText>
              <LocationPicker
                latitude={point.latitude}
                longitude={point.longitude}
                onChange={(next) => setV((prev) => (prev ? { ...prev, latitude: String(next.latitude), longitude: String(next.longitude) } : prev))}
              />
              {short('latitude', 'Latitude', undefined, { numeric: true })}
              {short('longitude', 'Longitude', undefined, { numeric: true })}
            </View>
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-privacy">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Who can see what</CardTitle>
            <CardDescription>
              Run privacy is the hosting kennel’s call (D3). This is the default every new run starts from; hares cannot change it
              without a delegation.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            <Field label="Kennel visibility">
              <Select testID="settings-visibility" value={v.visibility} onChange={set('visibility')} options={KENNEL_VISIBILITY} />
            </Field>
            <Field label="Default run visibility">
              <Select testID="settings-defaultRunVisibility" value={v.defaultRunVisibility} onChange={set('defaultRunVisibility')} options={RUN_VISIBILITY} />
            </Field>
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-circle">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Circle</CardTitle>
            <CardDescription>FR-CIRCLE-006: down-downs are on by default; some kennels choose not to run them.</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckRow
              testID="settings-down-downs"
              label="Allow down-downs to be recorded at the Circle"
              checked={v.downDownsEnabled}
              onChange={set('downDownsEnabled')}
            />
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="settings-hare-nudges">
          <CardHeader style={styles.tight}>
            <CardTitle style={styles.h3}>Hare nudges</CardTitle>
            <CardDescription>
              When Shiggy Trails speaks up about a run with nobody haring it yet (D45). Leave blank to use the platform default —
              currently {settings.hareNudgeDefaults.soonDays} and {settings.hareNudgeDefaults.urgentDays} days.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {short('hareNudgeSoonDays', 'Nudge the officers (days before)', `Platform default: ${settings.hareNudgeDefaults.soonDays}`, {
              numeric: true,
              placeholder: String(settings.hareNudgeDefaults.soonDays),
            })}
            {short('hareNudgeUrgentDays', 'Ask the whole kennel (days before)', `Platform default: ${settings.hareNudgeDefaults.urgentDays}`, {
              numeric: true,
              placeholder: String(settings.hareNudgeDefaults.urgentDays),
            })}
          </CardContent>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button testID="settings-save" disabled={saving} onPress={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</Button>
        <Button variant="outline" disabled={saving} onPress={() => { setV(toForm(settings)); setErrors({}); }}>Undo changes</Button>
      </View>

      {/* ─── Second thoughts (D34) ─── */}
      {settings.viewer.isFounder && pending && (
        <Card style={{ borderColor: theme.danger + '66' }}>
          <View testID="settings-abandon">
            <CardHeader style={styles.tight}>
              <View style={styles.titleRow}>
                <AlertTriangle size={16} color={theme.danger} />
                <CardTitle style={styles.h3}>Second thoughts</CardTitle>
              </View>
              <CardDescription>
                {settings.viewer.canAbandon
                  ? 'You started this kennel and nobody else has joined, so you can still close it yourself. It is archived rather than deleted, and you are free to start another.'
                  : 'Other hashers have joined. A kennel with members is archived by the platform, not abandoned — ask staff if it should close.'}
              </CardDescription>
            </CardHeader>
            {settings.viewer.canAbandon && (
              <CardContent>
                <ActionDialog
                  trigger={(open) => (
                    <Button variant="destructive" testID="abandon-trigger" style={styles.start} onPress={open}>Abandon this kennel</Button>
                  )}
                  title={`Abandon ${settings.name}?`}
                  description="It leaves the directory and the map straight away. The record is kept, archived, for the audit trail."
                  confirmLabel="Abandon it"
                  destructive
                  text={{ label: 'Reason', required: true, placeholder: 'Started it by mistake', marked: true }}
                  onConfirm={async ({ text: reason }) => {
                    try {
                      await api(`/kennels/${slug}/abandon`, { method: 'POST', body: { reason } });
                      router.replace('/kennels');
                    } catch (err) {
                      Alert.alert('Could not abandon this kennel', errorMessage(err, 'Could not abandon this kennel'));
                      throw err;
                    }
                  }}
                />
              </CardContent>
            )}
          </View>
        </Card>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  denied: { padding: 32, alignItems: 'center' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  mt16: { marginTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tight: { paddingBottom: 12 },
  h3: { fontSize: 18, lineHeight: 28 },
  stack: { gap: 16 },
  gap8: { gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  link: { fontWeight: '500', textDecorationLine: 'underline' },
  textarea: { minHeight: 104, textAlignVertical: 'top', paddingTop: 10 },
  shortArea: { minHeight: 80 },
  colourRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 48, height: 40, borderRadius: 6, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  start: { alignSelf: 'flex-start' },
});
