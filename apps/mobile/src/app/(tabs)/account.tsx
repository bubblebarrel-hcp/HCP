import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useThemePreference, type ThemePreference } from '@/context/theme-preference';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, WEB_URL, api, errorMessage } from '@/lib/api';
import { brandColor, membershipStatusLabels } from '@/lib/format';
import { registerForPush } from '@/lib/push';
import type { MyMembership, NotificationPreferences, Page } from '@/lib/types';

function useUnreadCount(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    api<{ unread: number }>('/me/notifications/unread-count')
      .then((data) => setUnread(data.unread))
      .catch(() => {});
  }, [enabled]);
  return unread;
}

// Who is waiting on this hasher's yes (D57); zero unless the profile is locked.
function usePendingRequests(enabled: boolean) {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    api<{ pendingRequests: number }>('/me/privacy')
      .then((data) => setPending(data.pendingRequests))
      .catch(() => {});
  }, [enabled]);
  return pending;
}

function PrimaryButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed || busy ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>{label}</ThemedText>}
    </Pressable>
  );
}

function LoginForm() {
  const theme = useTheme();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D31: an unconfirmed address is a fixable state, not a dead end.
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }];

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    setUnverified(null);
    setResent(false);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(email.trim().toLowerCase());
      } else {
        setError(errorMessage(err, 'Could not log in'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!unverified) return;
    setBusy(true);
    try {
      await api('/auth/verification/resend', { method: 'POST', body: { email: unverified } });
      setResent(true);
    } catch {
      // The endpoint answers the same way for any address, so there is nothing
      // useful to report beyond "try again".
      setError('Could not send it just now. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <ThemedText type="subtitle">Welcome back</ThemedText>
      <ThemedText themeColor="textSecondary">Log in to follow your kennels and runs.</ThemedText>
      {unverified ? (
        <View style={[styles.notice, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Confirm your email first</ThemedText>
          <ThemedText themeColor="textSecondary">
            We sent a link to {unverified} when you registered. Open it and you are in.
          </ThemedText>
          {resent ? (
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
              A fresh link is on its way.
            </ThemedText>
          ) : (
            <Pressable accessibilityRole="button" onPress={resend} disabled={busy} style={styles.noticeAction}>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>
                Send the link again
              </ThemedText>
            </Pressable>
          )}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Email"
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
      />
      <TextInput
        accessibilityLabel="Password"
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        style={inputStyle}
      />
      {error && <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText>}
      <PrimaryButton label="Log in" onPress={submit} busy={busy} />
      <Pressable onPress={() => router.push('/auth/forgot-password')} style={styles.link}>
        <ThemedText type="small" style={{ color: theme.primaryStrong }}>Forgot password?</ThemedText>
      </Pressable>
      <Pressable onPress={() => router.push('/auth/register')} style={styles.link}>
        <ThemedText type="small" style={{ color: theme.primaryStrong }}>New to HCP? Create an account</ThemedText>
      </Pressable>
    </View>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

interface Shortcut {
  label: string;
  icon: SymbolViewProps['name'];
  // No onPress means the feature has not landed yet.
  onPress?: () => void;
  badge?: number;
}

function ShortcutTile({ item }: { item: Shortcut }) {
  const theme = useTheme();
  const soon = !item.onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: soon }}
      accessibilityLabel={soon ? `${item.label}, coming soon` : item.label}
      disabled={soon}
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.card, opacity: soon ? 0.55 : pressed ? 0.8 : 1 },
      ]}>
      <View style={styles.tileIconRow}>
        <Icon name={item.icon} size={24} color={theme.primary} />
        {Boolean(item.badge) && (
          <View style={[styles.badge, { backgroundColor: theme.danger }]}>
            <ThemedText type="small" style={styles.badgeText}>{item.badge! > 9 ? '9+' : item.badge}</ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="smallBold">{item.label}</ThemedText>
      {soon && <ThemedText type="small" themeColor="textSecondary" style={styles.soon}>Soon</ThemedText>}
    </Pressable>
  );
}

// What this handset can hear, and the one button that fixes it (D12). The
// server is the source of truth for whether push is on; the OS is the source of
// truth for whether this device may be told.
function PushSettings() {
  const theme = useTheme();
  const [state, setState] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api<NotificationPreferences>('/me/notification-preferences')
      .then(setState)
      .catch(() => setState(null));
  }, []);

  useEffect(load, [load]);

  async function enable() {
    setBusy(true);
    setNote(null);
    const result = await registerForPush();
    if (!result.ok) setNote(result.message);
    load();
    setBusy(false);
  }

  if (!state) return null;

  const on = state.channels.push;
  const quiet = state.push.quietHours;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">Notifications</ThemedText>
      <View style={[styles.kennelRow, { backgroundColor: theme.card }]}>
        <View style={styles.profileText}>
          <ThemedText type="smallBold">
            {on ? 'This device gets push' : 'Push is off on this device'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {!state.push.enabledPlatformWide
              ? 'Push is switched off for HCP right now.'
              : on
                ? quiet
                  ? `Quiet between ${quiet.start} and ${quiet.end}. Everything still waits in the app.`
                  : 'Runs, trails and anything about safety.'
                : 'Turn it on to hear when a trail goes live.'}
          </ThemedText>
        </View>
        {!on && state.push.enabledPlatformWide && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn on push notifications"
            onPress={enable}
            disabled={busy}
            style={({ pressed }) => [styles.noticeAction, { opacity: pressed || busy ? 0.7 : 1 }]}>
            <ThemedText type="smallBold">{busy ? 'Working…' : 'Turn on'}</ThemedText>
          </Pressable>
        )}
      </View>
      {note && (
        <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>
      )}
    </View>
  );
}

function Menu() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const [memberships, setMemberships] = useState<MyMembership[] | null>(null);
  const unread = useUnreadCount(Boolean(user));
  const pendingRequests = usePendingRequests(Boolean(user));

  useEffect(() => {
    if (!user) return;
    api<Page<MyMembership>>('/me/memberships')
      .then((data) => setMemberships(data.items))
      .catch(() => setMemberships(null));
  }, [user]);

  if (!user) return null;

  const shortcuts: Shortcut[] = [
    { label: 'Kennels', icon: { ios: 'person.3.fill', android: 'groups', web: 'groups' }, onPress: () => router.push('/kennels') },
    { label: 'Runs', icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' }, onPress: () => router.push('/runs') },
    {
      label: 'Notifications',
      icon: { ios: 'bell', android: 'notifications', web: 'notifications' },
      onPress: () => router.push('/notifications'),
      badge: unread,
    },
    { label: 'Trail reports', icon: { ios: 'book', android: 'menu_book', web: 'menu_book' } },
    { label: 'Hash Passport', icon: { ios: 'person.text.rectangle', android: 'badge', web: 'badge' }, onPress: () => router.push('/passport') },
    { label: 'Privacy', icon: { ios: 'lock', android: 'lock', web: 'lock' }, onPress: () => router.push('/privacy') },
    {
      label: 'Follow requests',
      icon: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
      onPress: () => router.push('/follow-requests'),
      badge: pendingRequests,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.menu}>
      <ThemedText style={styles.heading} accessibilityRole="header">Menu</ThemedText>

      <View style={[styles.profile, { backgroundColor: theme.card }]}>
        <Avatar name={user.displayName} size={48} />
        <View style={styles.profileText}>
          <ThemedText type="smallBold" style={styles.profileName} numberOfLines={1}>{user.displayName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{user.email}</ThemedText>
        </View>
      </View>
      {!user.hashHandle && (
        <ThemedText type="small" themeColor="textSecondary">
          You will get a hash handle once your kennel names you.
        </ThemedText>
      )}

      {memberships && memberships.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">Your kennels</ThemedText>
          {memberships.map((m) => (
            <View key={m.id} style={[styles.kennelRow, { backgroundColor: theme.card }]}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${m.kennel.name}, ${membershipStatusLabels[m.status]}`}
                onPress={() => Linking.openURL(`${WEB_URL}/kennels/${m.kennel.slug}`)}
                style={({ pressed }) => [styles.kennelRowMain, { opacity: pressed ? 0.8 : 1 }]}>
                <Avatar name={m.kennel.shortName} color={brandColor(m.kennel.primaryColor)} />
                <View style={styles.profileText}>
                  <ThemedText type="smallBold" numberOfLines={1}>{m.kennel.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{membershipStatusLabels[m.status]}</ThemedText>
                </View>
              </Pressable>
              {m.status === 'ACTIVE' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Officers of ${m.kennel.name}`}
                  onPress={() => router.push(`/kennels/${m.kennel.slug}/officers`)}
                  style={styles.officersLink}>
                  <ThemedText type="small" style={{ color: theme.primaryStrong }}>Officers</ThemedText>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      <PushSettings />

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">Display</ThemedText>
        <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
          {THEME_OPTIONS.map(({ value, label }) => {
            const active = preference === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label} theme`}
                onPress={() => setPreference(value)}
                style={({ pressed }) => [
                  styles.segmentItem,
                  active && { backgroundColor: theme.card },
                  { opacity: pressed ? 0.8 : 1 },
                ]}>
                <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.grid}>
        {shortcuts.map((s) => (
          <ShortcutTile key={s.label} item={s} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={logout}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold">Log out</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

export default function AccountScreen() {
  const theme = useTheme();
  const { user, loading } = useAuth();

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={styles.flex} />
          ) : user ? (
            <Menu />
          ) : (
            <LoginForm />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset },
  form: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
  button: { borderRadius: Spacing.two, paddingVertical: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  notice: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
  noticeAction: { minHeight: 44, justifyContent: 'center' },
  link: { alignItems: 'center', padding: Spacing.two },
  menu: { gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { gap: Spacing.two },
  segment: { flexDirection: 'row', gap: Spacing.one, padding: Spacing.one, borderRadius: Spacing.three },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Spacing.two },
  kennelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three, minHeight: 64 },
  kennelRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minWidth: 0 },
  officersLink: { minHeight: 44, paddingHorizontal: Spacing.two, justifyContent: 'center' },
  tile: { flexBasis: '48%', flexGrow: 1, minHeight: 88, padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  tileIconRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#ffffff', fontSize: 11, lineHeight: 13 },
  soon: { fontSize: 12 },
});
