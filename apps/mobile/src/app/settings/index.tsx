import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Segmented, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useThemePreference, type ThemePreference } from '@/context/theme-preference';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { useDevicePrefs } from '@/lib/device-prefs';
import { QUALITY_OPTIONS, type VideoQuality } from '@/lib/video-quality';

// Everything a hasher can tune, in one place (web app/settings/page.tsx). Where
// a setting already has a screen (notifications, privacy) this links to it; what
// is left is the theme, how this phone plays media, and the password.

const LINKS = [
  { href: '/settings/notifications', label: 'Notifications', hint: 'What reaches you, where, and when' },
  { href: '/privacy', label: 'Privacy and account', hint: 'Who sees your things, deactivate, delete your account' },
  { href: '/blocked', label: 'Blocked hashers', hint: 'People you have blocked' },
  { href: '/follow-requests', label: 'Follow requests', hint: 'Who is waiting for you to approve them' },
  { href: '/saved', label: 'Saved', hint: 'Everything you have bookmarked' },
];

function Row({
  label,
  hint,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>{hint}</ThemedText>
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: theme.primary }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, loading, logout } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const [prefs, setPrefs] = useDevicePrefs();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const changePassword = async () => {
    if (next !== again) {
      setMessage({ text: 'The two new passwords are not the same.', bad: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api('/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      await logout();
      router.replace('/account');
    } catch (error) {
      setMessage({ text: errorMessage(error, 'That did not change your password.'), bad: true });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <Subpage>{null}</Subpage>;

  return (
    <Subpage back="Back to account" onBack={() => router.replace('/account')}>
      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
        </CardHeader>
        <CardContent>
          {LINKS.map((link) => (
            <Pressable
              key={link.href}
              accessibilityRole="link"
              onPress={() => router.push(link.href as never)}
              style={[styles.link, { borderTopColor: theme.border }]}>
              <ThemedText style={styles.label}>{link.label}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.hint}>{link.hint}</ThemedText>
            </Pressable>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
          <CardDescription>Follows your phone unless you pick one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Segmented<ThemePreference>
            value={preference}
            onChange={setPreference}
            testIDPrefix="theme"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video and media</CardTitle>
          <CardDescription>Saved on this phone only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Row
            testID="pref-autoplay"
            label="Autoplay videos"
            hint="Clips play, without sound, as soon as a post opens."
            value={prefs.autoplay && !prefs.dataSaver}
            disabled={prefs.dataSaver}
            onChange={(autoplay) => setPrefs({ autoplay })}
          />
          <Row
            testID="pref-muted"
            label="Start videos muted"
            hint="Autoplay is always silent. Turn this off to hear a clip the moment you press play."
            value={prefs.startMuted || (prefs.autoplay && !prefs.dataSaver)}
            disabled={prefs.autoplay && !prefs.dataSaver}
            onChange={(startMuted) => setPrefs({ startMuted })}
          />
          <View style={styles.quality}>
            <ThemedText style={styles.label}>Video quality</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Auto plays 720p, or the small 360p copy with Data saver on. Pick 1080p for the sharpest copy when a video has
              one. A video with no other sizes plays as it is.
            </ThemedText>
            <Segmented<VideoQuality>
              value={prefs.quality}
              onChange={(quality) => setPrefs({ quality })}
              testIDPrefix="pref-quality"
              options={QUALITY_OPTIONS}
            />
          </View>
          <Row
            testID="pref-datasaver"
            label="Data saver"
            hint="Loads a video only when you press play and turns autoplay off. Use it on a slow or metered connection."
            value={prefs.dataSaver}
            onChange={(dataSaver) => setPrefs({ dataSaver })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Every device is signed out afterwards, this one included.</CardDescription>
        </CardHeader>
        <CardContent style={styles.form}>
          <Field label="Current password">
            <Input testID="pw-current" secureTextEntry autoComplete="current-password" value={current} onChangeText={setCurrent} />
          </Field>
          <Field label="New password" hint="At least 8 characters, with a letter and a number.">
            <Input testID="pw-new" secureTextEntry autoComplete="new-password" value={next} onChangeText={setNext} />
          </Field>
          <Field label="New password again">
            <Input testID="pw-again" secureTextEntry autoComplete="new-password" value={again} onChangeText={setAgain} />
          </Field>
          {message ? (
            <ThemedText style={[styles.hint, { color: message.bad ? theme.danger : theme.text }]} accessibilityRole="alert">
              {message.text}
            </ThemedText>
          ) : null}
          <Button testID="pw-submit" disabled={saving || !current || !next || !again} onPress={changePassword}>
            Change password
          </Button>
        </CardContent>
      </Card>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  rowText: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 18 },
  quality: { gap: 8, paddingVertical: 8 },
  // CardContent adds no space between its children: the three fields, the message
  // and the button would otherwise sit flush against each other.
  form: { gap: 16 },
  link: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
