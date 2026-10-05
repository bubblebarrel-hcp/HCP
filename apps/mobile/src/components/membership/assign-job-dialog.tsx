import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { grantableRoles, roleLabel } from '@/lib/membership';
import type { GrantableRole, KennelMember, OfficerPosition } from '@/lib/types';

// Giving a member a job in the kennel (D39, D40), as the web has it
// (components/membership/AssignJobDialog.tsx). Two shapes of job, deliberately kept
// apart because the API does: an office (a seat this kennel defined, with a title and a
// term) and a role (a standing job carrying platform authority). Kennels name things
// their own way, so an office title is free text and a role carries the kennel's own
// word for it alongside the authority it grants.
const NEW_OFFICE = 'new-office';

export function AssignJobDialog({
  member,
  slug,
  positions,
  canAppoint,
  canGrantRoles,
  roleTitles,
  onDone,
}: {
  member: KennelMember;
  slug: string;
  positions: OfficerPosition[];
  canAppoint: boolean;
  canGrantRoles: boolean;
  roleTitles: Record<string, string>;
  onDone: () => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState('');
  const [title, setTitle] = useState('');
  const [mismanagement, setMismanagement] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const name = member.member.displayName;

  const options = useMemo(() => {
    // What they already hold never appears as something to give them again.
    const heldPositions = new Set(member.offices.map((o) => o.positionId));
    const heldRoles = new Set(member.roles.map((r) => r.role));
    const offices = canAppoint
      ? positions
          .filter((p) => !p.archived && !heldPositions.has(p.id))
          .map((p) => ({
            value: `office:${p.id}`,
            label: p.title,
            hint: p.isMismanagement ? 'A mismanagement office of this kennel' : 'An office of this kennel',
          }))
      : [];
    const roles = canGrantRoles
      ? grantableRoles
          .filter((r) => !heldRoles.has(r.value))
          .map((r) => ({ value: `role:${r.value}`, label: roleTitles[r.value] ?? r.label, hint: r.hint }))
      : [];
    return { offices, roles };
  }, [positions, canAppoint, canGrantRoles, roleTitles, member]);

  const selected = choice || options.offices[0]?.value || options.roles[0]?.value || (canGrantRoles ? NEW_OFFICE : '');
  const kind = selected === NEW_OFFICE ? 'new' : selected.startsWith('office:') ? 'office' : 'role';
  const role = kind === 'role' ? (selected.split(':')[1] as GrantableRole) : null;
  const hint =
    kind === 'new'
      ? 'A seat of your own: Hash Cash, Beer Meister, Hash Haberdasher — whatever this kennel calls it.'
      : [...options.offices, ...options.roles].find((o) => o.value === selected)?.hint;

  function close() {
    if (busy) return;
    setOpen(false);
    setChoice('');
    setTitle('');
    setMismanagement(true);
    setError(null);
  }

  async function submit() {
    const trimmed = title.trim();
    if (kind === 'new' && trimmed.length < 2) {
      setError('Give the office a name of at least 2 characters.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'new') {
        // Defining the seat and filling it are two API calls because they are two
        // different powers (D32); the dialog just does them in order.
        const created = await api<{ items: OfficerPosition[] }>(`/kennels/${encodeURIComponent(slug)}/positions`, {
          method: 'POST',
          body: { title: trimmed, permissions: [], isMismanagement: mismanagement },
        });
        const position = created.items.find((p) => p.title === trimmed);
        if (!position) throw new Error('The office was created but could not be found to fill it');
        await api(`/positions/${position.id}/appointments`, { method: 'POST', body: { userId: member.member.id } });
      } else if (kind === 'office') {
        await api(`/positions/${selected.split(':')[1]}/appointments`, { method: 'POST', body: { userId: member.member.id } });
      } else if (role) {
        await api(`/kennels/${encodeURIComponent(slug)}/roles`, {
          method: 'POST',
          // Empty means "call it what the platform calls it".
          body: { userId: member.member.id, role, title: trimmed || null },
        });
      }
      await onDone();
      close();
    } catch (err) {
      Alert.alert('Could not assign that', errorMessage(err, 'Could not assign that'));
    } finally {
      setBusy(false);
    }
  }

  if (!canAppoint && !canGrantRoles) return null;
  if (options.offices.length === 0 && options.roles.length === 0 && !canGrantRoles) return null;

  const group = (label: string, items: { value: string; label: string }[]) =>
    items.length === 0 ? null : (
      <View style={styles.group}>
        <ThemedText themeColor="textSecondary" style={styles.groupLabel}>{label}</ThemedText>
        {items.map((o) => {
          const on = selected === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID="assign-job-choice"
              onPress={() => {
                setChoice(o.value);
                setTitle('');
                setError(null);
              }}
              style={[styles.option, { borderColor: on ? theme.primary : theme.border }]}>
              <ThemedText style={styles.optionText}>{o.label}</ThemedText>
              {on ? <Check size={16} color={theme.primaryStrong} /> : null}
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <>
      <Button variant="outline" testID="member-assign" onPress={() => setOpen(true)}>Give a job</Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
          <View testID="assign-job-dialog" style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cardBody}>
              <ThemedText accessibilityRole="header" style={styles.title}>What does {name} do for the kennel?</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>
                An office is a seat this kennel defines and can name however it likes. A role carries authority across Shiggy Trails —
                you can still call it whatever your kennel calls it.
              </ThemedText>

              <Field label="Job" hint={hint}>
                <View style={styles.groups}>
                  {group('Offices of this kennel', options.offices)}
                  {group('Standing roles', options.roles)}
                  {canGrantRoles ? group('Something else', [{ value: NEW_OFFICE, label: 'New office…' }]) : null}
                </View>
              </Field>

              {kind === 'new' && (
                <>
                  <Field label="What this kennel calls it" error={error ?? undefined}>
                    <Input
                      testID="assign-job-title"
                      value={title}
                      placeholder="Hash Flash"
                      maxLength={80}
                      onChangeText={(t) => {
                        setTitle(t);
                        if (error) setError(null);
                      }}
                    />
                  </Field>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: mismanagement }}
                    testID="assign-job-mismanagement"
                    onPress={() => setMismanagement(!mismanagement)}
                    style={styles.check}>
                    <View style={[styles.box, { borderColor: mismanagement ? theme.primary : theme.border, backgroundColor: mismanagement ? theme.primary : 'transparent' }]}>
                      {mismanagement ? <Check size={12} color={theme.onPrimary} strokeWidth={3} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <ThemedText style={styles.sm}>Part of the mismanagement</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.sm}>
                        Mismanagement offices are what a kennel needs four of to be verified.
                      </ThemedText>
                    </View>
                  </Pressable>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    The office starts with no permissions. Add them on the offices screen once it exists.
                  </ThemedText>
                </>
              )}

              {kind === 'role' && role && (
                <Field
                  label="What this kennel calls it (optional)"
                  hint={`Leave it empty to use “${roleLabel[role]}”. The authority is the same either way.`}>
                  <Input
                    testID="assign-role-title"
                    value={title}
                    placeholder={roleTitles[role] ?? roleLabel[role]}
                    maxLength={60}
                    onChangeText={setTitle}
                  />
                </Field>
              )}

              <View style={styles.footer}>
                <Button variant="ghost" disabled={busy} onPress={close}>Cancel</Button>
                <Button testID="assign-job-submit" disabled={busy} busy={busy} onPress={() => void submit()}>
                  {busy ? 'Assigning…' : 'Assign'}
                </Button>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 448, maxHeight: '90%', borderWidth: 1, borderRadius: 12 },
  cardBody: { padding: 24, gap: 16 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  groups: { gap: 12 },
  group: { gap: 6 },
  groupLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  option: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  box: { marginTop: 2, width: 16, height: 16, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
