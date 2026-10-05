import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Check, Clock, Settings2, ShieldCheck, Sliders } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { typeLabel } from '@/lib/membership';
import type { MembershipViewer } from '@/lib/types';

// What a hasher may choose when asking to join (D20). Mirrors
// SELF_SELECTABLE_TYPES in apps/api/src/validators/membership.validator.ts.
const SELF_SELECTABLE = [
  { value: 'FULL', label: typeLabel.FULL, hint: 'You hash with this kennel regularly.' },
  { value: 'ASSOCIATE', label: typeLabel.ASSOCIATE, hint: 'You hash here now and then.' },
  { value: 'VISITING', label: typeLabel.VISITING, hint: 'Your home kennel is somewhere else.' },
  { value: 'VIRGIN', label: typeLabel.VIRGIN, hint: 'You have not hashed before. Welcome!' },
];

// The kennel page's call to action, as the web button works it
// (components/membership/JoinKennelButton.tsx): join, request pending, member
// (with leave), suspended, or blocked with a reason. Officers also get the
// "How it's run", settings and manage-members links.
export function JoinKennelButton({ slug, shortName }: { slug: string; shortName: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [viewer, setViewer] = useState<MembershipViewer | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setViewer(await api<MembershipViewer>(`/kennels/${encodeURIComponent(slug)}/membership`));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user, load]);

  if (loading || (user && !viewer && !failed)) {
    return <View style={[styles.skeleton, { backgroundColor: theme.backgroundElement }]} />;
  }

  if (!user) {
    return (
      <View style={styles.wrap}>
        <Button size="lg" onPress={() => router.push('/auth/register')}>{`Join to hash with ${shortName}`}</Button>
        <Button size="lg" variant="ghost" onPress={() => router.push('/account')}>Log in</Button>
      </View>
    );
  }

  if (failed || !viewer) {
    return (
      <View style={styles.wrap}>
        <Button size="lg" variant="outline" onPress={() => void load()}>Could not load membership. Try again</Button>
      </View>
    );
  }

  const m = viewer.membership;
  const canManage = viewer.permissions.includes('membership.review');
  const canRunKennel = viewer.permissions.includes('kennel.manage');
  const pill = [styles.pill, { backgroundColor: theme.backgroundSelected }];

  let primary: React.ReactNode;
  if (m && (m.status === 'ACTIVE' || m.status === 'INACTIVE')) {
    primary = (
      <View style={styles.pairRow}>
        <View style={[pill, styles.flex]} testID="membership-member">
          <Check size={20} color={theme.text} />
          <ThemedText style={styles.pillText}>Member</ThemedText>
        </View>
        <ActionDialog
          title={`Leave ${shortName}?`}
          description="Your runs, trail reports and Hash Passport history stay with you. You can ask to join again later."
          confirmLabel="Leave kennel"
          destructive
          text={{ label: 'Reason', placeholder: 'Anything the mismanagement should know' }}
          onConfirm={async ({ text }) => {
            try {
              await api(`/memberships/${m.id}/resign`, { method: 'POST', body: { reason: text } });
              await load();
            } catch (err) {
              Alert.alert('Could not leave the kennel', errorMessage(err));
              throw err;
            }
          }}
          trigger={(open) => (
            <Button size="lg" variant="ghost" testID="leave-kennel" onPress={open}>Leave</Button>
          )}
        />
      </View>
    );
  } else if (m && (m.status === 'PENDING_REVIEW' || m.status === 'APPLICANT')) {
    primary = (
      <View style={styles.pairRow}>
        <View style={[pill, styles.flex]} testID="membership-pending">
          <Clock size={20} color={theme.text} />
          <ThemedText style={styles.pillText}>Request sent</ThemedText>
        </View>
        <ActionDialog
          title={`Withdraw your request to join ${shortName}?`}
          description="You can ask again any time. Withdrawing does not start a waiting period."
          confirmLabel="Withdraw request"
          destructive
          text={{ label: 'Reason', placeholder: 'Optional' }}
          onConfirm={async ({ text }) => {
            try {
              await api(`/memberships/${m.id}/withdraw`, { method: 'POST', body: { reason: text } });
              await load();
            } catch (err) {
              Alert.alert('Could not withdraw your request', errorMessage(err));
              throw err;
            }
          }}
          trigger={(open) => (
            <Button size="lg" variant="ghost" testID="withdraw-request" onPress={open}>Withdraw</Button>
          )}
        />
      </View>
    );
  } else if (m?.status === 'SUSPENDED') {
    primary = (
      <View style={pill} testID="membership-suspended">
        <ThemedText style={styles.pillText}>Membership suspended</ThemedText>
      </View>
    );
  } else if (viewer.canRequest) {
    primary = (
      <ActionDialog
        title={`Join ${shortName}`}
        description="The kennel's mismanagement reviews every request."
        confirmLabel="Send request"
        types={SELF_SELECTABLE}
        text={{ label: 'Message to the mismanagement', placeholder: 'Where you hash now, who told you about the kennel…' }}
        onConfirm={async ({ text, type }) => {
          try {
            await api(`/kennels/${encodeURIComponent(slug)}/memberships`, { method: 'POST', body: { type, message: text } });
            await load();
          } catch (err) {
            Alert.alert('Could not send your request', errorMessage(err));
            throw err;
          }
        }}
        trigger={(open) => (
          <Button size="lg" testID="join-kennel" onPress={open}>{`Join to hash with ${shortName}`}</Button>
        )}
      />
    );
  } else {
    primary = (
      <View style={styles.blocked}>
        <Button size="lg" disabled>{`Join to hash with ${shortName}`}</Button>
        {viewer.reason ? (
          <ThemedText themeColor="textSecondary" style={styles.reason} testID="join-blocked-reason">{viewer.reason}</ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {primary}
      {/* Offices and the leadership timeline are members' business (D32). */}
      {m?.status === 'ACTIVE' && (
        <Button size="lg" variant="outline" testID="kennel-officers-link" onPress={() => router.push(`/kennels/${slug}/officers`)}>
          <ShieldCheck size={16} color={theme.text} />
          <ThemedText style={styles.label}>How it&rsquo;s run</ThemedText>
        </Button>
      )}
      {/* Running the kennel itself, as opposed to its membership roll (D34). */}
      {canRunKennel && (
        <Button size="lg" variant="outline" testID="kennel-settings-link" onPress={() => router.push(`/kennels/${slug}/settings` as never)}>
          <Sliders size={16} color={theme.text} />
          <ThemedText style={styles.label}>Kennel settings</ThemedText>
        </Button>
      )}
      {canManage && (
        <Button size="lg" variant="outline" testID="manage-members" onPress={() => router.push(`/kennels/${slug}/members` as never)}>
          <Settings2 size={16} color={theme.text} />
          <ThemedText style={styles.label}>Manage members</ThemedText>
          {viewer.pendingCount > 0 && (
            <View style={[styles.count, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.countText, { color: theme.onPrimary }]}>{viewer.pendingCount}</ThemedText>
            </View>
          )}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex w-full flex-col gap-2 on a phone.
  wrap: { width: '100%', gap: 8 },
  skeleton: { height: 44, borderRadius: 6 },
  flex: { flex: 1 },
  pairRow: { flexDirection: 'row', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 24, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pillText: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  blocked: { gap: 4 },
  reason: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  count: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
