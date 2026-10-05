import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { History } from 'lucide-react-native';

import { Avatar } from '@/components/feed/avatar';
import { AssignJobDialog } from '@/components/membership/assign-job-dialog';
import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge, Button, Card } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { allTypes, isPending, roleLabel, statusLabel, statusTone, timelineLabel, typeLabel } from '@/lib/membership';
import type { KennelMember, MembershipTimelineItem, OfficerPosition, Page } from '@/lib/types';

function describe(m: KennelMember) {
  if (isPending(m.status)) return `Asked to join ${formatDate(m.createdAt)}`;
  if (m.status === 'ACTIVE') return `Member since ${formatDate(m.startDate ?? m.approvedAt ?? m.createdAt)}`;
  if (m.status === 'SUSPENDED') {
    return m.suspendedUntil ? `Suspended until ${formatDate(m.suspendedUntil)}` : 'Suspended until reinstated';
  }
  return `${statusLabel[m.status]} ${formatDate(m.endDate ?? m.updatedAt)}`;
}

// One membership in the officer's members list, with the decisions the viewer is allowed
// to make (components/membership/MemberCard.tsx). The server re-checks every permission.
export function MemberCard({
  membership: m,
  viewerId,
  permissions,
  positions,
  roleTitles,
  slug,
  onChanged,
}: {
  membership: KennelMember;
  viewerId: string;
  permissions: Set<string>;
  positions: OfficerPosition[];
  roleTitles: Record<string, string>;
  slug: string;
  onChanged: () => Promise<void>;
}) {
  const theme = useTheme();
  const [timeline, setTimeline] = useState<MembershipTimelineItem[] | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const name = m.member.displayName;
  const self = m.member.id === viewerId;
  const pending = isPending(m.status);
  const current = m.status === 'ACTIVE' || m.status === 'INACTIVE';

  async function decide(action: string, body: Record<string, unknown>) {
    try {
      await api(`/memberships/${m.id}/${action}`, { method: 'POST', body });
      await onChanged();
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  // Offices and roles are both "what this member does here", so they are handed out from
  // one control; the API keeps them apart and re-checks the permission for each.
  const canAppoint = permissions.has('officer.appoint') && current;
  const canGrantRoles = permissions.has('kennel.manage') && current;

  async function toggleTimeline() {
    const next = !showTimeline;
    setShowTimeline(next);
    if (next && !timeline) {
      try {
        const data = await api<Page<MembershipTimelineItem>>(`/memberships/${m.id}/timeline`);
        setTimeline(data.items);
      } catch (err) {
        Alert.alert('Could not load the timeline', errorMessage(err, 'Could not load the timeline'));
        setShowTimeline(false);
      }
    }
  }

  const actions: React.ReactNode[] = [];
  if (!self) {
    if (pending && permissions.has('membership.review')) {
      actions.push(
        <ActionDialog
          key="approve"
          trigger={(open) => <Button testID="member-approve" onPress={open}>Approve</Button>}
          title={`Approve ${name}?`}
          description="They become an active member straight away."
          confirmLabel="Approve"
          types={allTypes}
          typesLabel="Membership type"
          defaultType={m.type}
          text={{ label: 'Note', placeholder: 'Visible in their membership timeline', marked: true }}
          onConfirm={({ type, text }) => decide('approve', { type, notes: text })}
        />,
        <ActionDialog
          key="reject"
          trigger={(open) => <Button variant="outline" testID="member-reject" onPress={open}>Decline</Button>}
          title={`Decline ${name}'s request?`}
          description="They can ask again after the cooldown period."
          confirmLabel="Decline request"
          destructive
          text={{ label: 'Note to the hasher', placeholder: 'Why the request was declined', marked: true }}
          onConfirm={({ text }) => decide('reject', { notes: text })}
        />,
      );
    }
    if (current && permissions.has('membership.suspend')) {
      actions.push(
        <ActionDialog
          key="suspend"
          trigger={(open) => <Button variant="outline" testID="member-suspend" onPress={open}>Suspend</Button>}
          title={`Suspend ${name}?`}
          description="Their history stays. While suspended they hold no kennel roles or permissions."
          confirmLabel="Suspend"
          destructive
          text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log and their timeline', marked: true }}
          until={{ label: 'Suspended until', hint: 'Leave empty to suspend until someone reinstates them.' }}
          onConfirm={({ text, until }) =>
            decide('suspend', { reason: text, until: until ? new Date(`${until}T23:59:59`).toISOString() : null })
          }
        />,
      );
    }
    if ((m.status === 'SUSPENDED' || m.status === 'INACTIVE') && permissions.has('membership.suspend')) {
      actions.push(
        <ActionDialog
          key="reinstate"
          trigger={(open) => <Button testID="member-reinstate" onPress={open}>Reinstate</Button>}
          title={`Reinstate ${name}?`}
          description="They return as an active member with their original join date."
          confirmLabel="Reinstate"
          text={{ label: 'Note', marked: true }}
          onConfirm={({ text }) => decide('reinstate', { notes: text })}
        />,
      );
    }
    if ((current || m.status === 'SUSPENDED') && permissions.has('membership.remove')) {
      actions.push(
        <ActionDialog
          key="remove"
          trigger={(open) => (
            <Button variant="ghost" testID="member-remove" onPress={open}>
              <ThemedText style={[styles.ghostText, { color: theme.danger }]}>Remove</ThemedText>
            </Button>
          )}
          title={`Remove ${name} from the kennel?`}
          description="Their past runs and reports stay attributed to them. They can ask to join again after the cooldown period."
          confirmLabel="Remove member"
          destructive
          text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log and their timeline', marked: true }}
          onConfirm={({ text }) => decide('remove', { reason: text })}
        />,
      );
    }
  }

  // The small × and ✎ the web puts inside a badge.
  const chipAction = (glyph: string, label: string, testID: string, dialog: Omit<React.ComponentProps<typeof ActionDialog>, 'trigger'>) => (
    <ActionDialog
      {...dialog}
      trigger={(open) => (
        <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={open} hitSlop={10} style={styles.chipAction}>
          <ThemedText style={styles.chipGlyph}>{glyph}</ThemedText>
        </Pressable>
      )}
    />
  );

  return (
    <Card style={styles.card}>
      <View testID="member-card">
        <View style={styles.top}>
          <Avatar name={name} src={m.member.avatarUrl} size={40} />
          <View style={styles.flex}>
            <View style={styles.wrapRow}>
              <ThemedText style={styles.name}>{name}</ThemedText>
              <Badge tone={statusTone(m.status)}>{statusLabel[m.status]}</Badge>
              <Badge>{typeLabel[m.type]}</Badge>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.sm}>{describe(m)}</ThemedText>

            {/* What they do here. An office carries a title and a term; a role is a standing
                job. Both are shown to anyone who can see the roll. */}
            {(m.offices.length > 0 || m.roles.length > 0) && (
              <View testID="member-offices" style={[styles.wrapRow, styles.mt8]}>
                {m.offices.map((office) => (
                  <Badge key={office.appointmentId} tone="accent" style={styles.chip}>
                    {office.title}
                    {canAppoint
                      ? chipAction('×', `End ${name}'s term as ${office.title}`, 'member-office-end', {
                          title: `End ${name}'s term as ${office.title}?`,
                          description: "The appointment is recorded as ended and stays on the kennel's leadership timeline.",
                          confirmLabel: 'End the term',
                          destructive: true,
                          text: { label: 'Reason', required: true, placeholder: 'Recorded in the audit log', marked: true },
                          onConfirm: async ({ text }) => {
                            try {
                              await api(`/appointments/${office.appointmentId}/term-ended`, { method: 'POST', body: { reason: text } });
                              await onChanged();
                            } catch (err) {
                              Alert.alert('Could not end that appointment', errorMessage(err, 'Could not end that appointment'));
                              throw err;
                            }
                          },
                        })
                      : null}
                  </Badge>
                ))}
                {m.roles.map((role) => (
                  <Badge key={role.assignmentId} style={styles.chip}>
                    {role.title ?? roleLabel[role.role]}
                    {canGrantRoles
                      ? chipAction('×', `Take ${roleLabel[role.role]} from ${name}`, 'member-role-revoke', {
                          title: `Take ${roleLabel[role.role]} from ${name}?`,
                          description: 'The grant is recorded as revoked rather than deleted, so the history stays readable.',
                          confirmLabel: 'Revoke the role',
                          destructive: true,
                          text: { label: 'Reason', required: true, placeholder: 'Recorded in the audit log', marked: true },
                          onConfirm: async ({ text }) => {
                            try {
                              await api(`/roles/${role.assignmentId}/revoke`, { method: 'POST', body: { reason: text } });
                              await onChanged();
                            } catch (err) {
                              Alert.alert('Could not revoke that role', errorMessage(err, 'Could not revoke that role'));
                              throw err;
                            }
                          },
                        })
                      : null}
                    {/* Kennels rename things. The authority is untouched; only the word for it
                        changes (D40). */}
                    {canGrantRoles
                      ? chipAction('✎', `Rename ${role.title ?? roleLabel[role.role]}`, 'member-role-rename', {
                          title: `Rename “${role.title ?? roleLabel[role.role]}”`,
                          description: `${name} keeps exactly the same authority — this is only the name your kennel uses for it. Leave it empty to go back to “${roleLabel[role.role]}”.`,
                          confirmLabel: 'Save the name',
                          text: { label: 'Name', placeholder: roleLabel[role.role] },
                          onConfirm: async ({ text }) => {
                            try {
                              await api(`/roles/${role.assignmentId}`, { method: 'PATCH', body: { title: text.trim() || null } });
                              await onChanged();
                            } catch (err) {
                              Alert.alert('Could not rename that role', errorMessage(err, 'Could not rename that role'));
                              throw err;
                            }
                          },
                        })
                      : null}
                  </Badge>
                ))}
              </View>
            )}
            {pending && m.requestNote ? (
              <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.sm}>“{m.requestNote}”</ThemedText>
              </View>
            ) : null}
            {m.status === 'SUSPENDED' && m.suspensionReason ? (
              <ThemedText style={[styles.sm, styles.mt8]}>
                <ThemedText themeColor="textSecondary" style={styles.sm}>Reason:</ThemedText> {m.suspensionReason}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {self ? <ThemedText themeColor="textSecondary" style={styles.sm}>This is your membership.</ThemedText> : actions}
          {!self && (canAppoint || canGrantRoles) ? (
            <AssignJobDialog
              member={m}
              slug={slug}
              positions={positions}
              canAppoint={canAppoint}
              canGrantRoles={canGrantRoles}
              roleTitles={roleTitles}
              onDone={onChanged}
            />
          ) : null}
          <Button variant="ghost" testID="member-timeline" style={styles.timelineButton} onPress={() => void toggleTimeline()}>
            <History size={16} color={theme.text} />
            <ThemedText style={styles.ghostText}>Timeline</ThemedText>
          </Button>
        </View>

        {showTimeline && (
          <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
            {timeline === null ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Loading…</ThemedText>
            ) : (
              timeline.map((e) => (
                <View key={e.id}>
                  <ThemedText style={styles.sm}>
                    <ThemedText style={[styles.sm, styles.medium]}>{timelineLabel[e.type] ?? e.type}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {' · '}{formatDate(e.occurredAt)}{e.actor ? ` · by ${e.actor.displayName}` : ''}
                    </ThemedText>
                  </ThemedText>
                  {e.note ? <ThemedText themeColor="textSecondary" style={styles.sm}>“{e.note}”</ThemedText> : null}
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  medium: { fontWeight: '500' },
  mt8: { marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center' },
  chipAction: { marginLeft: 6, paddingHorizontal: 2 },
  chipGlyph: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  note: { marginTop: 8, borderRadius: 8, padding: 12 },
  footer: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 12 },
  timelineButton: { marginLeft: 'auto' },
  ghostText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  timeline: { marginTop: 12, borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
});
