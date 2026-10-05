import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Camera, Check, Flag, ShieldBan, UserCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { AudiencePicker } from '@/components/profile/audience-picker';
import { PasswordConfirmDialog } from '@/components/profile/password-confirm-dialog';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { deactivateAccount, deleteAccount, getPrivacy, setMilestoneSharing, setPrivacy } from '@/lib/social';
import type { Audience } from '@/lib/types';

// Privacy and account (D57), as the web lays it out (app/account/privacy/page.tsx):
// who sees what a hasher makes, milestones in the feed, blocking and tags,
// stepping away for a while, and leaving for good.
export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading, logout, refreshUser } = useAuth();
  const [level, setLevel] = useState<Audience>('PUBLIC');
  const [pending, setPending] = useState(0);
  const [saving, setSaving] = useState(false);
  // Whether a milestone may appear in the feed as a card (D60).
  const [milestones, setMilestones] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getPrivacy()
      .then((data) => {
        if (!alive) return;
        setMilestones(data.shareMilestones);
        setLevel(data.profileVisibility);
        setPending(data.pendingRequests);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  async function change(next: Audience) {
    const before = level;
    setLevel(next);
    setSaving(true);
    try {
      const data = await setPrivacy(next);
      setPending(data.pendingRequests);
      await refreshUser();
    } catch (err) {
      setLevel(before);
      Alert.alert('Could not change your privacy', errorMessage(err, 'Could not change your privacy'));
    } finally {
      setSaving(false);
    }
  }

  async function changeMilestones(next: boolean) {
    setMilestones(next);
    try {
      await setMilestoneSharing(next);
    } catch (err) {
      setMilestones(!next);
      Alert.alert('Could not save that', errorMessage(err, 'Could not save that'));
    }
  }

  async function deactivate(password: string) {
    try {
      await deactivateAccount(password);
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not deactivate your account'));
    }
    await logout();
    router.replace('/');
  }

  async function removeAccount(password: string) {
    try {
      await deleteAccount(password);
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not delete your account'));
    }
    await logout();
    router.replace('/');
  }

  if (loading || !user) {
    return (
      <Subpage>
        <Skeleton height={384} />
      </Subpage>
    );
  }

  return (
    <Subpage back="Back to account" onBack={() => router.replace('/account')}>
      <Card bleed={false}>
        <View testID="privacy-visibility">
          <CardHeader>
            <CardTitle style={styles.title}>Who can see what I make</CardTitle>
            <CardDescription>
              This covers your photos, posts and reels. Each reel can be narrower than this, never wider. Your name, picture
              and bio stay visible so people can find you and ask to follow.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.body}>
            <AudiencePicker value={level} onChange={(next) => void change(next)} disabled={saving} />
            {level !== 'PUBLIC' && pending > 0 && (
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                {pending} {pending === 1 ? 'person is' : 'people are'} waiting for your yes. Making your profile public lets them all in.
              </ThemedText>
            )}
            <Button variant="outline" size="sm" testID="to-follow-requests" style={styles.start} onPress={() => router.push('/follow-requests')}>
              <UserCheck size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>{`Follow requests${pending > 0 ? ` (${pending})` : ''}`}</ThemedText>
            </Button>
          </CardContent>
        </View>
      </Card>

      <Card bleed={false}>
        <View testID="privacy-milestones">
          <CardHeader>
            <CardTitle>Milestones in the feed</CardTitle>
            <CardDescription>
              When you pass 10, 50 or 100 runs, the people who can see your profile may get a card for it. Turning it off only
              removes the card: the milestone stays on your Hash Passport.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: milestones }}
              testID="milestones-toggle"
              onPress={() => void changeMilestones(!milestones)}
              style={styles.checkRow}>
              <View style={[styles.box, { borderColor: milestones ? theme.primary : theme.border, backgroundColor: milestones ? theme.primary : 'transparent' }]}>
                {milestones && <Check size={12} color={theme.onPrimary} />}
              </View>
              <ThemedText style={styles.sm}>Show my milestones as cards in the feed</ThemedText>
            </Pressable>
          </CardContent>
        </View>
      </Card>

      <Card bleed={false}>
        <View testID="privacy-safety">
          <CardHeader>
            <CardTitle>Blocking and tags</CardTitle>
            <CardDescription>Who you have blocked or muted, and photo tags waiting for your yes.</CardDescription>
          </CardHeader>
          <CardContent style={styles.wrapRow}>
            <Button variant="outline" size="sm" testID="to-blocked" onPress={() => router.push('/blocked')}>
              <ShieldBan size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Blocked and muted</ThemedText>
            </Button>
            <Button variant="outline" size="sm" testID="to-photo-tags" onPress={() => router.push('/photo-tags')}>
              <Camera size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Photo tags</ThemedText>
            </Button>
            <Button variant="outline" size="sm" testID="to-my-reports" onPress={() => router.push('/reports')}>
              <Flag size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>My reports</ThemedText>
            </Button>
          </CardContent>
        </View>
      </Card>

      <Card bleed={false}>
        <View testID="privacy-deactivate">
          <CardHeader>
            <CardTitle>Step away for a while</CardTitle>
            <CardDescription>
              Deactivating takes your profile, photos, posts and reels off Shiggy Trails and signs you out. Kennel records that
              name you stay as they are. Nothing is removed: sign in again and everything is back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordConfirmDialog
              title="Deactivate your account?"
              description="Your profile, photos, posts and reels disappear and you are signed out. Signing in again brings everything back."
              confirmLabel="Deactivate"
              onConfirm={deactivate}
              trigger={(open) => (
                <Button variant="outline" testID="deactivate-open" style={styles.start} onPress={open}>
                  Deactivate my account
                </Button>
              )}
            />
          </CardContent>
        </View>
      </Card>

      <Card bleed={false} style={{ borderColor: theme.danger + '66' }}>
        <View testID="privacy-delete">
          <CardHeader>
            <CardTitle>Delete my account</CardTitle>
            <CardDescription>
              This cannot be undone. Your name, handle, picture, details, login, follows, posts, reels and their photos are
              removed. Runs you attended, trail reports and Run Capsules that mention you stay, because they are a kennel’s
              record, and show you as “Deleted hasher”. If you hold an office in a kennel, resign it first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordConfirmDialog
              title="Delete your account for good?"
              description="Everything described on the page is removed and you cannot get it back."
              confirmLabel="Delete my account"
              typeWord="DELETE"
              onConfirm={removeAccount}
              trigger={(open) => (
                <Button variant="destructive" testID="delete-open" style={styles.start} onPress={open}>
                  Delete my account
                </Button>
              )}
            />
          </CardContent>
        </View>
      </Card>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 32 },
  body: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  start: { alignSelf: 'flex-start' },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: { width: 16, height: 16, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
