import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { History, ShieldCheck, UserPlus, Users } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Select } from '@/components/ui/select';
import { DateField } from '@/components/ui/date-field';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { LeadershipEntry, PositionsResponse } from '@/lib/types';

// How a kennel is run (Annex 08L, D32), as the web lays it out
// (app/kennels/[slug]/officers/page.tsx): the offices and who holds them, who is
// standing in, and the leadership timeline. Every control is gated on what the
// viewer holds, including defining an office and handing authority over.

const permissionLabel: Record<string, string> = {
  'membership.review': 'Review join requests',
  'membership.suspend': 'Suspend and reinstate members',
  'membership.remove': 'Remove members',
  'membership.invite': 'Invite new members',
  'officer.appoint': 'Appoint officers',
  'kennel.manage': 'Manage the kennel and its offices',
  'run.manage': 'Create and run the kennel’s runs',
  'run.visibility.change': 'Change run privacy',
  'trail.manage': 'Plan and release trails',
  'report.publish': 'Publish trail reports',
  'media.moderate': 'Moderate photos',
};

const appointmentStatusLabel: Record<string, string> = {
  NOMINATED: 'Nominated',
  APPOINTED: 'Appointed',
  ACTIVE: 'Serving',
  TERM_ENDED: 'Term ended',
  RESIGNED: 'Resigned',
  REVOKED: 'Revoked',
  HISTORICAL: 'Historical',
};

interface DelegationsPage {
  items: Delegation[];
  // Who you may hand something to, and for how long at most.
  members: { userId: string; name: string }[];
  viewer: { maxDays: number };
}

interface Delegation {
  id: string;
  permissions: string[];
  reason: string;
  expiresAt: string;
  revokedAt: string | null;
  from: string;
  to: string;
  live: boolean;
  canRevoke: boolean;
}

function delegationState(d: Delegation) {
  if (d.revokedAt) return { label: 'Revoked', tone: 'danger' as const };
  if (d.live) return { label: 'Live', tone: 'primary' as const };
  if (new Date(d.expiresAt) <= new Date()) return { label: 'Expired', tone: 'muted' as const };
  return { label: 'Scheduled', tone: 'accent' as const };
}

function PermissionChips({ keys, selected, onToggle }: { keys: string[]; selected: string[]; onToggle: (key: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {keys.map((key) => {
        const on = selected.includes(key);
        return (
          <Pressable
            key={key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(key)}
            style={[styles.chip, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary + '1a' : 'transparent' }]}>
            <ThemedText style={styles.sm}>{permissionLabel[key] ?? key}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OfficersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading } = useAuth();
  const [positions, setPositions] = useState<PositionsResponse | null>(null);
  const [leadership, setLeadership] = useState<LeadershipEntry[]>([]);
  const [delegations, setDelegations] = useState<DelegationsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appointTo, setAppointTo] = useState<Record<string, string>>({});
  const [newPosition, setNewPosition] = useState({ title: '', permissions: [] as string[], termMonths: '' });
  const [grant, setGrant] = useState({ delegateId: '', permissions: [] as string[], reason: '', expiresAt: '' });

  const load = useCallback(async () => {
    const [p, l, d] = await Promise.all([
      api<PositionsResponse>(`/kennels/${slug}/positions`),
      api<{ items: LeadershipEntry[] }>(`/kennels/${slug}/leadership`),
      api<DelegationsPage>(`/kennels/${slug}/delegations`),
    ]);
    setPositions(p);
    setLeadership(l.items);
    setDelegations(d);
  }, [slug]);

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then(() => setError(null))
      .catch((err) => setError(errorMessage(err, 'You cannot see how this kennel is run.')));
  }, [load, loading]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  // ActionDialog keeps itself open when onConfirm throws, so the failure surfaces
  // here and is then rethrown rather than swallowed.
  async function mutate(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.denied}>
        <ThemedText style={styles.semibold} testID="officers-denied">{error}</ThemedText>
        <Button variant="outline" style={styles.back} onPress={() => router.replace(`/kennels/${slug}`)}>
          Back to the kennel
        </Button>
      </Card>,
    );
  }
  if (!positions || !delegations) return shell(<Skeleton height={384} />);

  const { canAppoint, canDefinePositions, grantableKeys } = positions.viewer;

  return shell(
    <>
      <Card>
        <CardHeader>
          <View style={styles.titleRow}>
            <ShieldCheck size={20} color={theme.text} />
            <CardTitle>How this kennel is run</CardTitle>
          </View>
          <CardDescription>
            Offices, who holds them, and who is standing in. Defining an office and filling it are separate permissions.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ─── Positions ─── */}
      <Card>
        <View testID="positions-card">
          <CardHeader style={styles.tight}>
            <CardTitle>Offices</CardTitle>
          </CardHeader>
          <CardContent style={styles.stack}>
            {positions.items.map((position) => (
              <View
                key={position.id}
                testID="position-row"
                style={[styles.position, { borderColor: theme.border }, position.archived && { opacity: 0.6 }]}>
                <View style={styles.wrapRow}>
                  <ThemedText style={styles.semibold}>{position.title}</ThemedText>
                  {position.archived && <Badge>Archived</Badge>}
                  {position.isMismanagement && <Badge>Mismanagement</Badge>}
                  {position.termMonths ? (
                    <ThemedText themeColor="textSecondary" style={styles.sm}>{position.termMonths}-month term</ThemedText>
                  ) : null}
                </View>
                {position.permissions && (
                  <View style={styles.perms}>
                    {position.permissions.length === 0 ? (
                      <ThemedText themeColor="textSecondary" style={styles.sm}>No permissions</ThemedText>
                    ) : (
                      position.permissions.map((key) => (
                        <View key={key} style={[styles.perm, { backgroundColor: theme.backgroundElement }]}>
                          <ThemedText style={styles.permText}>{permissionLabel[key] ?? key}</ThemedText>
                        </View>
                      ))
                    )}
                  </View>
                )}
                <ThemedText style={[styles.sm, styles.holders]}>
                  {position.holders.length === 0 ? (
                    <ThemedText themeColor="textSecondary" style={styles.sm}>Vacant</ThemedText>
                  ) : (
                    position.holders.map((h) => h.name).join(', ')
                  )}
                </ThemedText>
                {canAppoint && !position.archived && (
                  <View style={styles.actions}>
                    <Field label="Appoint">
                      <Select
                        testID="appoint-select"
                        value={appointTo[position.id] ?? ''}
                        onChange={(value) => setAppointTo((s) => ({ ...s, [position.id]: value }))}
                        options={[{ value: '', label: 'Choose a member…' }, ...positions.members.map((m) => ({ value: m.userId, label: m.name }))]}
                      />
                    </Field>
                    <View style={styles.wrapRow}>
                      <Button
                        size="sm"
                        disabled={busy || !appointTo[position.id]}
                        testID="appoint-submit"
                        onPress={() =>
                          void run(() => api(`/positions/${position.id}/appointments`, { method: 'POST', body: { userId: appointTo[position.id] } }))
                        }>
                        <UserPlus size={16} color={theme.onPrimary} />
                        <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>Appoint</ThemedText>
                      </Button>
                      {position.holders.map((h) => (
                        <ActionDialog
                          key={h.appointmentId}
                          title={`End ${h.name} in ${position.title}`}
                          description="The appointment stays on the leadership timeline. Nothing is erased."
                          confirmLabel="End the appointment"
                          destructive
                          text={{ label: 'Why', required: true, placeholder: 'Term completed' }}
                          onConfirm={({ text }) => mutate(() => api(`/appointments/${h.appointmentId}/term-ended`, { method: 'POST', body: { reason: text } }))}
                          trigger={(open) => (
                            <Button size="sm" variant="outline" disabled={busy} testID="end-appointment" onPress={open}>
                              {`End ${h.name}`}
                            </Button>
                          )}
                        />
                      ))}
                      {canDefinePositions && (
                        <ActionDialog
                          title={`Retire ${position.title}`}
                          description="Anyone holding it stops holding it, on the record. The office and its history remain."
                          confirmLabel="Archive the office"
                          destructive
                          text={{ label: 'Why', required: true, placeholder: 'Folded into another role' }}
                          onConfirm={({ text }) => mutate(() => api(`/positions/${position.id}/archive`, { method: 'POST', body: { reason: text } }))}
                          trigger={(open) => (
                            <Button size="sm" variant="outline" disabled={busy} testID="archive-position" onPress={open}>Archive</Button>
                          )}
                        />
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
            {canDefinePositions && (
              <View style={[styles.define, { borderTopColor: theme.border }]} testID="define-position">
                <ThemedText style={styles.medium}>Define an office</ThemedText>
                <Field label="Title">
                  <Input
                    testID="new-position-title"
                    value={newPosition.title}
                    onChangeText={(title) => setNewPosition((p) => ({ ...p, title }))}
                    placeholder="Hash Cash"
                    accessibilityLabel="Title"
                  />
                </Field>
                <Field label="Term (months)">
                  <Input
                    value={newPosition.termMonths}
                    onChangeText={(termMonths) => setNewPosition((p) => ({ ...p, termMonths: termMonths.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                    accessibilityLabel="Term (months)"
                  />
                </Field>
                <View style={styles.stack}>
                  <ThemedText style={[styles.sm, styles.medium14]}>What it may do</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    Only what you hold yourself. You cannot give away authority you do not have.
                  </ThemedText>
                  <PermissionChips
                    keys={grantableKeys}
                    selected={newPosition.permissions}
                    onToggle={(key) =>
                      setNewPosition((p) => ({
                        ...p,
                        permissions: p.permissions.includes(key) ? p.permissions.filter((k) => k !== key) : [...p.permissions, key],
                      }))
                    }
                  />
                </View>
                <Button
                  style={styles.start}
                  testID="new-position-submit"
                  disabled={busy || newPosition.title.trim().length < 2}
                  onPress={() =>
                    void run(async () => {
                      await api(`/kennels/${slug}/positions`, {
                        method: 'POST',
                        body: {
                          title: newPosition.title,
                          permissions: newPosition.permissions,
                          ...(newPosition.termMonths ? { termMonths: Number(newPosition.termMonths) } : {}),
                        },
                      });
                      setNewPosition({ title: '', permissions: [], termMonths: '' });
                    })
                  }>
                  Define it
                </Button>
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      {/* ─── Delegations ─── */}
      <Card>
        <View testID="delegations-card">
          <CardHeader style={styles.tight}>
            <View style={styles.titleRow}>
              <Users size={16} color={theme.text} />
              <CardTitle>Standing in</CardTitle>
            </View>
            <CardDescription>
              A time-boxed loan of authority you hold. It expires by itself, and stops the moment you lose the permission yourself.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {delegations.items.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nobody is standing in.</ThemedText>
            )}
            {delegations.items.map((d) => {
              const state = delegationState(d);
              return (
                <View key={d.id} testID="delegation-row" style={[styles.delegation, { borderColor: theme.border }]}>
                  <View style={styles.wrapRow}>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <ThemedText style={[styles.sm, styles.medium14]}>{d.from} → {d.to}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>until {formatDate(d.expiresAt)}</ThemedText>
                  </View>
                  <ThemedText style={[styles.sm, styles.holders]}>{d.permissions.map((k) => permissionLabel[k] ?? k).join(', ')}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>“{d.reason}”</ThemedText>
                  {d.canRevoke && !d.revokedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      style={[styles.start, styles.top]}
                      testID="delegation-revoke"
                      onPress={() => void run(() => api(`/delegations/${d.id}/revoke`, { method: 'POST', body: {} }))}>
                      Take it back
                    </Button>
                  )}
                </View>
              );
            })}

            {grantableKeys.length > 0 && (
              <View style={[styles.define, { borderTopColor: theme.border }]} testID="grant-delegation">
                <ThemedText style={styles.medium}>Hand something over</ThemedText>
                <Field label="To">
                  <Select
                    testID="delegate-select"
                    value={grant.delegateId}
                    onChange={(delegateId) => setGrant((g) => ({ ...g, delegateId }))}
                    options={[{ value: '', label: 'Choose a member…' }, ...delegations.members.map((m) => ({ value: m.userId, label: m.name }))]}
                  />
                </Field>
                <Field label={`Until (max ${delegations.viewer.maxDays} days)`}>
                  <DateField testID="delegate-until" value={grant.expiresAt} onChange={(expiresAt) => setGrant((g) => ({ ...g, expiresAt }))} />
                </Field>
                <Field label="Why">
                  <Input
                    testID="delegate-reason"
                    value={grant.reason}
                    onChangeText={(reason) => setGrant((g) => ({ ...g, reason }))}
                    placeholder="Away for a fortnight"
                    accessibilityLabel="Why"
                  />
                </Field>
                <PermissionChips
                  keys={grantableKeys}
                  selected={grant.permissions}
                  onToggle={(key) =>
                    setGrant((g) => ({
                      ...g,
                      permissions: g.permissions.includes(key) ? g.permissions.filter((k) => k !== key) : [...g.permissions, key],
                    }))
                  }
                />
                <Button
                  style={styles.start}
                  testID="delegate-submit"
                  disabled={busy || !grant.delegateId || grant.permissions.length === 0 || grant.reason.trim().length < 3 || !grant.expiresAt}
                  onPress={() =>
                    void run(async () => {
                      await api(`/kennels/${slug}/delegations`, {
                        method: 'POST',
                        body: {
                          delegateId: grant.delegateId,
                          permissions: grant.permissions,
                          reason: grant.reason,
                          expiresAt: new Date(`${grant.expiresAt}T12:00:00`).toISOString(),
                        },
                      });
                      setGrant({ delegateId: '', permissions: [], reason: '', expiresAt: '' });
                    })
                  }>
                  Hand it over
                </Button>
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      {/* ─── Leadership timeline (FR-GOV-006) ─── */}
      <Card>
        <View testID="leadership-card">
          <CardHeader style={styles.tight}>
            <View style={styles.titleRow}>
              <History size={16} color={theme.text} />
              <CardTitle>Leadership timeline</CardTitle>
            </View>
            <CardDescription>Permanent history. Offices end, they are never erased.</CardDescription>
          </CardHeader>
          <CardContent>
            {leadership.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nobody has held office yet.</ThemedText>
            ) : (
              <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                {leadership.map((entry) => (
                  <View key={entry.id}>
                    <View style={styles.wrapRow}>
                      <ThemedText style={[styles.sm, styles.medium14]}>{entry.position.title}</ThemedText>
                      <ThemedText style={styles.sm}>{entry.officer}</ThemedText>
                      <Badge tone={entry.status === 'ACTIVE' ? 'primary' : entry.status === 'REVOKED' ? 'danger' : 'muted'}>
                        {appointmentStatusLabel[entry.status] ?? entry.status}
                      </Badge>
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {formatDate(entry.startDate)}
                      {entry.endDate ? ` to ${formatDate(entry.endDate)}` : ' to present'}
                    </ThemedText>
                    {entry.endedReason ? <ThemedText themeColor="textSecondary" style={styles.sm}>“{entry.endedReason}”</ThemedText> : null}
                  </View>
                ))}
              </View>
            )}
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
  denied: { padding: 32, alignItems: 'center' },
  back: { marginTop: 16 },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  medium14: { fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tight: { paddingBottom: 12 },
  stack: { gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  position: { borderWidth: 1, borderRadius: 8, padding: 16 },
  perms: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  perm: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  permText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  holders: { marginTop: 8 },
  actions: { marginTop: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  define: { gap: 12, borderTopWidth: 1, paddingTop: 16 },
  start: { alignSelf: 'flex-start' },
  top: { marginTop: 8 },
  delegation: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
