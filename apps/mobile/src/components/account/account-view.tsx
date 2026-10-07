import { LegalFooter } from '@/components/legal/legal-footer';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { Branding } from '@/components/profile/branding';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { isPending, statusLabel, statusTone, typeLabel } from '@/lib/membership';
import type { OwnMembership, Page } from '@/lib/types';

// The signed-in account page, as the web app lays it out on a phone
// (app/account/page.tsx): a banner with the picture overlapping it, the name,
// "Find a kennel" and "Log out", then Details, Your kennels and the passport.

// Mirrors USERNAME_PATTERN in apps/api/src/utils/entities.ts: change both together.
const USERNAME = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

function UsernameForm() {
  const theme = useTheme();
  const { user, refreshUser } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (!user) return null;
  const next = value.trim().replace(/^@/, '').toLowerCase();
  const changed = next !== (user.username ?? '');

  async function save() {
    if (!USERNAME.test(next) || next.includes('..')) {
      setError('3 to 30 letters, numbers, "_" or ".", starting and ending on a letter or number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/me/username', { method: 'PATCH', body: { username: next } });
      await refreshUser();
      setSaved(`You are @${next} now.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not change your username.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.usernameForm, { borderTopColor: theme.border }]} testID="username-form">
      <Field
        label="Username"
        hint={saved ?? 'How other hashers @mention you. Your hash handle is still the name people see.'}
        error={error ?? undefined}>
        <View style={styles.usernameRow}>
          <View style={styles.usernameInput}>
            <ThemedText themeColor="textSecondary" style={styles.at}>@</ThemedText>
            <Input
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={31}
              testID="username-input"
              style={styles.usernameField}
            />
          </View>
          <Button size="sm" disabled={busy || !changed} busy={busy} onPress={() => void save()} testID="username-save" style={styles.usernameSave}>
            Save
          </Button>
        </View>
      </Field>
    </View>
  );
}

function detail(m: OwnMembership) {
  if (isPending(m.status)) return 'Waiting for the mismanagement';
  if (m.status === 'ACTIVE') return `since ${formatDate(m.startDate ?? m.approvedAt ?? m.createdAt)}`;
  if (m.status === 'SUSPENDED') return m.suspendedUntil ? `until ${formatDate(m.suspendedUntil)}` : 'until reinstated';
  return formatDate(m.endDate ?? m.updatedAt);
}

function MyMemberships() {
  const theme = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [memberships, setMemberships] = useState<(OwnMembership & { canManage?: boolean })[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [settingHome, setSettingHome] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const page = await api<Page<OwnMembership & { canManage?: boolean }>>('/me/memberships');
      setMemberships(page.items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function makeHome(m: OwnMembership) {
    setSettingHome(m.id);
    try {
      await api('/me/home-kennel', { method: 'PATCH', body: { kennelId: m.kennel.id } });
      await Promise.all([reload(), refreshUser()]);
    } catch (err) {
      Alert.alert('Could not set your home kennel', errorMessage(err));
    } finally {
      setSettingHome(null);
    }
  }

  function withdraw(m: OwnMembership) {
    Alert.alert(`Withdraw your request to join ${m.kennel.name}?`, 'You can ask again any time. Withdrawing does not start a waiting period.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw request',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/memberships/${m.id}/withdraw`, { method: 'POST', body: {} });
            await reload();
          } catch (err) {
            Alert.alert('Could not withdraw your request', errorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <Card>
      <CardHeader style={styles.cardHeaderTight}>
        <CardTitle>Your kennels</CardTitle>
      </CardHeader>
      <CardContent>
        {failed ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.plain}>
            Could not load your kennels.{' '}
            <ThemedText type="smallBold" style={{ color: theme.primaryStrong, textDecorationLine: 'underline' }} onPress={() => void reload()}>
              Try again
            </ThemedText>
          </ThemedText>
        ) : memberships === null ? (
          <View style={[styles.pulse, { backgroundColor: theme.backgroundElement }]} />
        ) : memberships.length === 0 ? (
          <View style={styles.noKennels}>
            <ThemedText themeColor="textSecondary" style={styles.plain}>You haven&apos;t joined a kennel yet.</ThemedText>
            <Button onPress={() => router.push('/kennels')} style={styles.findKennel}>Find a kennel</Button>
          </View>
        ) : (
          memberships.map((m, index) => (
            <View
              key={m.id}
              testID="membership"
              style={[
                styles.membership,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                index === 0 && { paddingTop: 0 },
                index === memberships.length - 1 && { paddingBottom: 0 },
              ]}>
              <Avatar name={m.kennel.shortName} color={brandColor(m.kennel.primaryColor)} size={40} />
              <View style={styles.membershipMain}>
                <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${m.kennel.slug}`)}>
                  <ThemedText style={styles.kennelName}>{m.kennel.name}</ThemedText>
                </Pressable>
                <ThemedText themeColor="textSecondary" style={styles.plain}>
                  {typeLabel[m.type] ?? m.type} · {detail(m)}
                </ThemedText>
              </View>
              <View style={styles.membershipActions}>
                <Badge tone={statusTone(m.status)}>{statusLabel[m.status]}</Badge>
                {m.isHomeKennel ? (
                  <Badge tone="soft-primary">Home</Badge>
                ) : (
                  m.status === 'ACTIVE' && (
                    <Button variant="outline" size="sm" disabled={settingHome === m.id} onPress={() => void makeHome(m)}>
                      {settingHome === m.id ? 'Setting…' : 'Make home'}
                    </Button>
                  )
                )}
                {m.canManage && (
                  <Button variant="outline" size="sm" onPress={() => router.push(`/kennels/${m.kennel.slug}/members` as never)}>
                    Manage
                  </Button>
                )}
                {isPending(m.status) && (
                  <Button variant="outline" size="sm" onPress={() => withdraw(m)}>
                    Withdraw
                  </Button>
                )}
              </View>
            </View>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function AccountView() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  if (!user) return null;

  const since = new Date(user.createdAt).toLocaleDateString();

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={[]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* border-b border-border bg-card shadow-sm */}
          <View style={[styles.top, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <Branding
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              avatarPosition={user.avatarPosition}
              bannerUrl={user.bannerUrl}
              bannerPosition={user.bannerPosition}
              edit={{ kind: 'hasher', id: user.id }}>
              <View style={styles.nameBlock}>
                <ThemedText accessibilityRole="header" testID="account-display-name" style={styles.h1}>
                  {user.displayName}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sub}>
                  {user.hashHandle ? 'Hasher' : 'Not named yet'} · on Shiggy Trails since {since}
                </ThemedText>
              </View>
              <View style={styles.topButtons}>
                <Button onPress={() => router.push('/kennels')} style={styles.flex}>Find a kennel</Button>
                <Button
                  variant="secondary"
                  style={styles.flex}
                  onPress={async () => {
                    await logout();
                    router.replace('/');
                  }}>
                  Log out
                </Button>
              </View>
            </Branding>
          </View>

          <View style={styles.grid}>
            <Card>
              <CardHeader style={[styles.cardHeaderTight, styles.detailsHeader]}>
                <CardTitle>Details</CardTitle>
                <View style={styles.detailsButtons}>
                  <Button variant="outline" size="sm" testID="to-privacy" onPress={() => router.push('/privacy')}>
                    Privacy
                  </Button>
                  <Button variant="outline" size="sm" onPress={() => router.push("/account/profile" as never)}>
                    Edit profile
                  </Button>
                </View>
              </CardHeader>
              <CardContent>
                <View style={styles.dl}>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>Email</ThemedText>
                  <ThemedText testID="account-email" style={styles.sm}>{user.email}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>Hash handle</ThemedText>
                  {user.hashHandle ? (
                    <ThemedText style={styles.sm}>{user.hashHandle}</ThemedText>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.sm}>Not named yet</ThemedText>
                  )}
                  <ThemedText themeColor="textSecondary" style={styles.sm}>Email verified</ThemedText>
                  {user.emailVerified ? <ThemedText style={styles.sm}>Yes</ThemedText> : <Badge>Pending</Badge>}
                  <ThemedText themeColor="textSecondary" style={styles.sm}>Member since</ThemedText>
                  <ThemedText style={styles.sm}>{since}</ThemedText>
                </View>
                <UsernameForm />
                {/* Who follows you and who you follow live on your profile page,
                    which opens on the right list (D57). */}
                <View style={styles.links}>
                  <Button variant="outline" size="sm" testID="account-followers" onPress={() => router.push(`/hashers/${user.id}?tab=followers`)}>
                    Followers
                  </Button>
                  <Button variant="outline" size="sm" testID="account-following" onPress={() => router.push(`/hashers/${user.id}?tab=following`)}>
                    Following
                  </Button>
                  <Button variant="outline" size="sm" testID="account-saved" onPress={() => router.push('/saved')}>
                    Saved
                  </Button>
                  <Button variant="outline" size="sm" testID="account-view-profile" onPress={() => router.push(`/hashers/${user.id}`)}>
                    View my profile
                  </Button>
                </View>
              </CardContent>
            </Card>

            <MyMemberships />

            <Card style={styles.passport}>
              <ThemedText style={styles.bold}>Your Hash Passport</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.passportText}>
                Every run you check in to, every trail you hare, everywhere you hash.
              </ThemedText>
              <Button onPress={() => router.push('/passport')} style={styles.findKennel}>Open your passport</Button>
            </Card>
          </View>
          <LegalFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: { paddingBottom: 32 },
  top: { borderBottomWidth: 1 },
  banner: { height: 160, overflow: 'hidden' },
  // flex-col items-center gap-3 px-4 pb-4, avatar -mt-16
  identity: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  avatarRing: { marginTop: -64, borderWidth: 4, borderRadius: 68, overflow: 'hidden' },
  nameBlock: { alignItems: 'center' },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' },
  sub: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400', textAlign: 'center' },
  topButtons: { flexDirection: 'row', gap: 8, width: '100%' },
  flex: { flex: 1 },
  grid: { paddingVertical: 16, gap: 16 },
  cardHeaderTight: { paddingBottom: 12 },
  detailsHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailsButtons: { flexDirection: 'row', gap: 8 },
  dl: { gap: 12 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  usernameForm: { marginTop: 16, borderTopWidth: 1, paddingTop: 16 },
  usernameRow: { flexDirection: 'row', gap: 8 },
  usernameInput: { flex: 1, justifyContent: 'center' },
  at: { position: 'absolute', left: 12, zIndex: 1, fontSize: 14, fontWeight: '400' },
  usernameField: { paddingLeft: 28 },
  usernameSave: { minHeight: 40 },
  links: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plain: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  noKennels: { alignItems: 'center', paddingVertical: 8 },
  findKennel: { marginTop: 12 },
  pulse: { height: 64, borderRadius: 8 },
  membership: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 12 },
  membershipMain: { flex: 1, minWidth: 140 },
  membershipActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  kennelName: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  passport: { padding: 32, alignItems: 'center' },
  bold: { fontWeight: '600' },
  passportText: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '400', textAlign: 'center' },
});
