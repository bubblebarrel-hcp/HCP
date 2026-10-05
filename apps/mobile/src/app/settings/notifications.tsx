import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BellRing, Check, Mail, MoonStar, Smartphone } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { NotificationPreferences } from '@/lib/types';

// Notification settings, as the web lays it out on a phone
// (app/settings/notifications/page.tsx): what each channel can do right now,
// quiet hours with the time zone, then a per-category, per-channel grid. A switch
// only does something if its channel can reach you; safety in-app never switches off.

const COLUMNS = [
  { channel: 'IN_APP' as const, label: 'In the app', short: 'App' },
  { channel: 'PUSH' as const, label: 'Push', short: 'Push' },
  { channel: 'EMAIL' as const, label: 'Email', short: 'Email' },
];

const platformLabel: Record<string, string> = { IOS: 'iPhone or iPad', ANDROID: 'Android phone', WEB: 'Browser' };

const categoryLabel: Record<string, string> = {
  MEMBERSHIP: 'Membership',
  RUN: 'Runs',
  TRAIL_RELEASE: 'Trail release',
  REMINDER: 'Reminders',
  REPORT: 'Trail reports',
  ANNOUNCEMENT: 'Announcements',
  GOVERNANCE: 'Governance',
  EVENT: 'Events',
  MEDIA: 'Photos',
  SAFETY: 'Safety',
  SOCIAL: 'Likes, replies and follows',
  SYSTEM: 'System',
};

const categoryHint: Record<string, string> = {
  MEMBERSHIP: 'Requests to join, and decisions on yours.',
  RUN: 'New runs, changes and cancellations.',
  TRAIL_RELEASE: 'When a hare releases the trail.',
  REMINDER: 'Nudges before a run or a deadline.',
  REPORT: 'Trail reports published by the scribe.',
  ANNOUNCEMENT: 'Kennel announcements.',
  GOVERNANCE: 'Motions, votes and officer changes.',
  EVENT: 'Interhash and multi-kennel events.',
  MEDIA: 'Photos added to your runs.',
  SAFETY: 'A run paused, a hazard, an emergency.',
  SOCIAL: 'Someone liked or replied to your post, reshared it, or followed you.',
  SYSTEM: 'Account and platform notices.',
};

type Prefs = NotificationPreferences & { timeZone?: string | null };

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [quiet, setQuiet] = useState({ start: '', end: '' });
  const [savingQuiet, setSavingQuiet] = useState(false);
  const [timeZone, setTimeZoneInput] = useState('');
  const [savingTimeZone, setSavingTimeZone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<Prefs>('/me/notification-preferences')
      .then((data) => {
        if (!alive) return;
        setPrefs(data);
        setQuiet({ start: data.push.quietHours?.start ?? '', end: data.push.quietHours?.end ?? '' });
        setTimeZoneInput(data.timeZone ?? '');
      })
      .catch((err) => alive && setError(errorMessage(err, 'Could not load your notification settings')));
    return () => {
      alive = false;
    };
  }, [user]);

  async function toggle(category: string, channel: 'IN_APP' | 'PUSH' | 'EMAIL', enabled: boolean) {
    setSaving(`${category}:${channel}`);
    try {
      setPrefs(await api<Prefs>('/me/notification-preferences', { method: 'PUT', body: { preferences: [{ category, channel, enabled }] } }));
    } catch (err) {
      Alert.alert('Could not save that', errorMessage(err, 'Could not save that'));
    } finally {
      setSaving(null);
    }
  }

  async function saveQuietHours(clear = false) {
    setSavingQuiet(true);
    try {
      const body = clear ? { quietHours: null } : { quietHours: { start: quiet.start, end: quiet.end } };
      await api('/me/notification-preferences/quiet-hours', { method: 'PUT', body });
      const data = await api<Prefs>('/me/notification-preferences');
      setPrefs(data);
      setQuiet({ start: data.push.quietHours?.start ?? '', end: data.push.quietHours?.end ?? '' });
    } catch (err) {
      Alert.alert('Could not save your quiet hours', errorMessage(err, 'Could not save your quiet hours'));
    } finally {
      setSavingQuiet(false);
    }
  }

  async function saveTimeZone(value: string) {
    setSavingTimeZone(true);
    try {
      await api('/me/timezone', { method: 'PUT', body: { timeZone: value } });
      setTimeZoneInput(value);
      setPrefs(await api<Prefs>('/me/notification-preferences'));
    } catch (err) {
      Alert.alert('Not a recognised time zone', errorMessage(err, 'Not a recognised time zone'));
    } finally {
      setSavingTimeZone(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (!user || (!prefs && !error)) return shell(<Skeleton height={384} />);
  if (error || !prefs) return shell(<Card style={styles.errorCard}><ThemedText>{error}</ThemedText></Card>);

  const live = prefs.channels;

  return shell(
    <>
      <Card style={styles.intro}>
        <ThemedText accessibilityRole="header" style={styles.h1}>Notifications</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>
          Choose what reaches you, and how. Safety notices always come through.
        </ThemedText>
      </Card>

      {/* ─── What each channel can do right now ─── */}
      <Card>
        <View testID="channel-status">
          <CardHeader style={styles.tight}>
            <CardTitle>Your channels</CardTitle>
            <CardDescription>A switch below only does something if its channel can reach you.</CardDescription>
          </CardHeader>
          <CardContent style={styles.channels}>
            <View style={[styles.channel, { borderColor: theme.border }]}>
              <View style={styles.channelHead}>
                <BellRing size={16} color={theme.text} />
                <ThemedText style={styles.medium}>In the app</ThemedText>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sm}>Always on. Everything lands here first.</ThemedText>
            </View>

            <View style={[styles.channel, { borderColor: theme.border }]} testID="push-status">
              <View style={styles.channelHead}>
                <Smartphone size={16} color={theme.text} />
                <ThemedText style={styles.medium}>Push</ThemedText>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                {!prefs.push.enabledPlatformWide
                  ? 'Switched off for Shiggy Trails right now.'
                  : prefs.push.devices.length === 0
                    ? 'No device yet. Open the Shiggy Trails app on your phone and allow notifications.'
                    : `${prefs.push.devices.length} device${prefs.push.devices.length === 1 ? '' : 's'} registered.`}
              </ThemedText>
              {prefs.push.devices.length > 0 && (
                <View style={styles.devices}>
                  {prefs.push.devices.map((d) => (
                    <ThemedText key={d.id} themeColor="textSecondary" style={styles.xs}>
                      {platformLabel[d.platform] ?? d.platform} · last seen {formatDate(d.lastSeenAt)}
                    </ThemedText>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.channel, { borderColor: theme.border }]}>
              <View style={styles.channelHead}>
                <Mail size={16} color={theme.text} />
                <ThemedText style={styles.medium}>Email</ThemedText>
              </View>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                {live.email ? `Sent to ${user.email}.` : 'No email provider is connected, so nothing is sent.'}
              </ThemedText>
            </View>
          </CardContent>
        </View>
      </Card>

      {/* ─── Quiet hours (FR-NOT-006) ─── */}
      <Card>
        <View testID="quiet-hours">
          <CardHeader style={styles.tight}>
            <View style={styles.titleRow}>
              <MoonStar size={16} color={theme.text} />
              <CardTitle>Quiet hours</CardTitle>
            </View>
            <CardDescription>
              Hours when your phone should stay quiet. Only push is held back; everything still waits for you in the app, and
              anything critical still comes through.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.quietBody}>
            <View style={[styles.channel, { borderColor: theme.border }]} testID="time-zone">
              <ThemedText style={styles.medium}>Time zone</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                {prefs.timeZone
                  ? `Quiet hours are worked out for ${prefs.timeZone}.`
                  : 'Not set yet, so quiet hours are worked out for UTC, probably not where you are.'}
              </ThemedText>
              <View style={styles.tzRow}>
                <Input
                  testID="time-zone-input"
                  value={timeZone}
                  onChangeText={setTimeZoneInput}
                  placeholder="e.g. Africa/Lagos"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.tzInput}
                />
                <Button size="sm" disabled={savingTimeZone || !timeZone.trim()} testID="save-time-zone" onPress={() => void saveTimeZone(timeZone)}>
                  {savingTimeZone ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingTimeZone}
                  testID="detect-time-zone"
                  onPress={() => void saveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>
                  Use this device’s time zone
                </Button>
              </View>
            </View>

            <View style={styles.quietRow}>
              <View style={styles.quietField}>
                <Field label="From">
                  <Input value={quiet.start} placeholder="22:00" onChangeText={(start) => setQuiet((q) => ({ ...q, start }))} autoCapitalize="none" />
                </Field>
              </View>
              <View style={styles.quietField}>
                <Field label="Until">
                  <Input value={quiet.end} placeholder="07:00" onChangeText={(end) => setQuiet((q) => ({ ...q, end }))} autoCapitalize="none" />
                </Field>
              </View>
              <Button disabled={savingQuiet || !quiet.start || !quiet.end} testID="save-quiet-hours" onPress={() => void saveQuietHours(false)}>
                {savingQuiet ? 'Saving…' : 'Save'}
              </Button>
              {prefs.push.quietHours && (
                <Button variant="outline" disabled={savingQuiet} onPress={() => void saveQuietHours(true)}>Clear</Button>
              )}
            </View>
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              {prefs.push.quietHours
                ? `Quiet between ${prefs.push.quietHours.start} and ${prefs.push.quietHours.end}, in your own time zone.`
                : 'No quiet hours set, so push can arrive at any time.'}
            </ThemedText>
          </CardContent>
        </View>
      </Card>

      {/* ─── Per category, per channel ─── */}
      <Card>
        <View testID="notification-preferences">
          <CardHeader style={styles.tight}>
            <CardTitle>What you hear about</CardTitle>
          </CardHeader>
          <CardContent>
            {prefs.categories.map((row, index) => (
              <View key={row.category} style={[styles.category, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }, index === 0 && { paddingTop: 0 }]}>
                <View>
                  <ThemedText style={styles.medium}>{categoryLabel[row.category] ?? row.category}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>{categoryHint[row.category]}</ThemedText>
                </View>
                <View style={styles.boxes}>
                  {COLUMNS.map((c) => {
                    const on = c.channel === 'IN_APP' ? row.inApp : c.channel === 'PUSH' ? row.push : row.email;
                    // Safety in-app is never switchable (BR-NOT-007), and a
                    // channel that cannot reach this hasher is shown but inert.
                    const locked = row.locked && c.channel === 'IN_APP';
                    const reachable = c.channel === 'IN_APP' ? true : c.channel === 'PUSH' ? live.push : live.email;
                    const id = `${row.category}:${c.channel}`;
                    const disabled = locked || !reachable || saving === id;
                    return (
                      <Pressable
                        key={c.channel}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled }}
                        accessibilityLabel={`${categoryLabel[row.category] ?? row.category} by ${c.label}`}
                        testID={`pref-${row.category}-${c.channel}`}
                        disabled={disabled}
                        onPress={() => void toggle(row.category, c.channel, !on)}
                        style={[styles.boxCell, disabled && { opacity: 0.4 }]}>
                        <View style={[styles.box, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : 'transparent' }]}>
                          {on && <Check size={14} color={theme.onPrimary} />}
                        </View>
                        <ThemedText themeColor="textSecondary" style={styles.xs}>{c.short}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <ThemedText themeColor="textSecondary" style={[styles.sm, styles.footnote]}>
              Safety notifications in the app cannot be switched off. A greyed switch means that channel cannot reach you yet.
            </ThemedText>
          </CardContent>
        </View>
      </Card>
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  errorCard: { padding: 32, alignItems: 'center' },
  intro: { padding: 20 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  tight: { paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channels: { gap: 12 },
  channel: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  channelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  devices: { marginTop: 8, gap: 4 },
  quietBody: { gap: 16 },
  tzRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tzInput: { width: 224 },
  quietRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  quietField: { width: 144 },
  category: { paddingVertical: 12, gap: 8 },
  boxes: { flexDirection: 'row', width: 192 },
  boxCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footnote: { marginTop: 16 },
});
