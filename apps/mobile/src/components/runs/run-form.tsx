import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CheckRow } from '@/components/ui/check-row';
import { DateField } from '@/components/ui/date-field';
import { Select } from '@/components/ui/select';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { runTypeLabel, runVisibilityLabel } from '@/lib/runs';
import type { RunType, RunVisibility } from '@/lib/types';

// Plan or edit a run, as the web lays it out (components/runs/RunForm.tsx): four cards
// (The run, When and where, Who can come, Hares) and a large submit button. Officers
// with run.manage see hares and the run number; hares editing their own run do not.
// Visibility is only editable with run.visibility.change (D3/D13). Mirrors
// apps/api/src/validators/run.validator.ts and the web's lib/run-schema.ts: change
// all three together.

export const RUN_TYPES: RunType[] = ['REGULAR', 'FULL_MOON', 'RED_DRESS', 'CAMPOUT', 'CHARITY', 'INTERHASH', 'NASH_HASH', 'THEMED', 'SPECIAL'];
export const RUN_VISIBILITIES: RunVisibility[] = ['PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY'];

export interface RunFormValues {
  runNumber: string;
  title: string;
  runType: RunType;
  theme: string;
  description: string;
  startsAtLocal: string;
  timeZone: string;
  meetingPointName: string;
  meetingAddress: string;
  visibility: RunVisibility;
  capacity: string;
  hashCash: string;
  allowGuests: boolean;
  allowVisitors: boolean;
  leadHareId: string;
  coHareIds: string[];
}

export interface RunFormMember {
  userId: string;
  displayName: string;
}

type Errors = Partial<Record<keyof RunFormValues, string>>;

function validate(v: RunFormValues): Errors {
  const e: Errors = {};
  if (!/^[1-9]\d{0,6}$/.test(v.runNumber)) e.runNumber = 'Run number is a whole number from 1';
  const title = v.title.trim();
  if (title.length < 2) e.title = 'Give the run a title';
  else if (title.length > 120) e.title = 'Keep the title under 120 characters';
  if (v.theme.trim().length > 120) e.theme = 'Keep the theme under 120 characters';
  if (v.description.trim().length > 4000) e.description = 'Keep the description under 4000 characters';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.startsAtLocal)) e.startsAtLocal = 'Choose the date and start time';
  if (!v.timeZone.trim()) e.timeZone = 'Time zone is required';
  else if (v.timeZone.trim().length > 60) e.timeZone = 'Time zone is too long';
  const point = v.meetingPointName.trim();
  if (point.length < 2) e.meetingPointName = 'Where does the pack meet?';
  else if (point.length > 160) e.meetingPointName = 'Meeting point is too long';
  if (v.meetingAddress.trim().length > 300) e.meetingAddress = 'Keep the address under 300 characters';
  if (!/^(|[1-9]\d{0,3}|10000)$/.test(v.capacity)) e.capacity = 'Leave empty for no limit, or a number from 1 to 10000';
  if (v.hashCash.trim().length > 60) e.hashCash = 'Keep hash cash under 60 characters';
  if (v.coHareIds.length > 9) e.coHareIds = 'A run has at most 10 hares';
  return e;
}

export function RunForm({
  defaults,
  members,
  canManage,
  canChangeVisibility,
  submitLabel,
  onSubmit,
}: {
  defaults: RunFormValues;
  members?: RunFormMember[];
  canManage: boolean;
  canChangeVisibility: boolean;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const theme = useTheme();
  const [v, setV] = useState<RunFormValues>(defaults);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof RunFormValues>(key: K) => (value: RunFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const payload: Record<string, unknown> = {
      title: v.title.trim(),
      runType: v.runType,
      theme: v.theme.trim(),
      description: v.description.trim(),
      startsAtLocal: v.startsAtLocal,
      timeZone: v.timeZone.trim(),
      meetingPointName: v.meetingPointName.trim(),
      meetingAddress: v.meetingAddress.trim(),
      capacity: v.capacity ? Number(v.capacity) : null,
      hashCash: v.hashCash.trim(),
      allowGuests: v.allowGuests,
      allowVisitors: v.allowVisitors,
      ...(canChangeVisibility ? { visibility: v.visibility } : {}),
    };
    if (canManage) {
      payload.runNumber = Number(v.runNumber);
      if (members) {
        const others = v.coHareIds.filter((id) => id !== v.leadHareId);
        payload.hares = v.leadHareId
          ? [{ userId: v.leadHareId, isLead: true }, ...others.map((userId) => ({ userId, isLead: false }))]
          : others.map((userId, i) => ({ userId, isLead: i === 0 }));
      }
    }
    setBusy(true);
    try {
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  }

  const text = (
    name: 'runNumber' | 'title' | 'theme' | 'meetingPointName' | 'meetingAddress' | 'timeZone' | 'capacity' | 'hashCash',
    label: string,
    opts: { hint?: string; numeric?: boolean; placeholder?: string } = {},
  ) => (
    <Field label={label} error={errors[name]} hint={opts.hint}>
      <Input
        testID={`run-form-${name}`}
        value={v[name]}
        onChangeText={set(name)}
        keyboardType={opts.numeric ? 'number-pad' : 'default'}
        autoCapitalize={name === 'timeZone' ? 'none' : 'sentences'}
        autoCorrect={false}
        placeholder={opts.placeholder}
        accessibilityLabel={label}
      />
    </Field>
  );

  const toggleCoHare = (id: string) =>
    setV((prev) => ({
      ...prev,
      coHareIds: prev.coHareIds.includes(id) ? prev.coHareIds.filter((x) => x !== id) : [...prev.coHareIds, id],
    }));

  return (
    <View style={styles.form} testID="run-form">
      <Card>
        <CardHeader style={styles.tight}>
          <CardTitle>The run</CardTitle>
        </CardHeader>
        <CardContent style={styles.fields}>
          {canManage ? text('runNumber', 'Run number', { numeric: true }) : null}
          {text('title', 'Title')}
          <Field label="Run type" error={errors.runType}>
            <Select
              testID="run-form-runType"
              value={v.runType}
              onChange={(value) => set('runType')(value as RunType)}
              options={RUN_TYPES.map((t) => ({ value: t, label: runTypeLabel[t] }))}
            />
          </Field>
          {text('theme', 'Theme (optional)')}
          <Field label="Description (optional)" error={errors.description} hint="Never describe the trail itself: it stays secret until release.">
            <Input
              testID="run-form-description"
              value={v.description}
              onChangeText={set('description')}
              multiline
              accessibilityLabel="Description (optional)"
              style={styles.textarea}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader style={styles.tight}>
          <CardTitle>When and where</CardTitle>
        </CardHeader>
        <CardContent style={styles.fields}>
          <Field label="Start" error={errors.startsAtLocal} hint="In the run's local time.">
            <DateField testID="run-form-startsAtLocal" withTime value={v.startsAtLocal} onChange={set('startsAtLocal')} />
          </Field>
          {text('timeZone', 'Time zone', { hint: 'IANA name, e.g. Africa/Lagos.' })}
          {text('meetingPointName', 'Meeting point')}
          {text('meetingAddress', 'Address (optional)')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader style={styles.tight}>
          <CardTitle>Who can come</CardTitle>
        </CardHeader>
        <CardContent style={styles.fields}>
          {canChangeVisibility ? (
            <Field label="Visibility" error={errors.visibility}>
              <Select
                testID="run-form-visibility"
                value={v.visibility}
                onChange={(value) => set('visibility')(value as RunVisibility)}
                options={RUN_VISIBILITIES.map((x) => ({ value: x, label: runVisibilityLabel[x] }))}
              />
            </Field>
          ) : (
            <View style={styles.readonly}>
              <ThemedText style={[styles.sm, styles.medium]}>Visibility</ThemedText>
              <ThemedText style={styles.sm}>{runVisibilityLabel[defaults.visibility]}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.xs}>Set by the kennel admin (D3).</ThemedText>
            </View>
          )}
          {text('capacity', 'Capacity (optional)', { numeric: true, hint: 'No waitlist: when full, Going is closed.' })}
          {text('hashCash', 'Hash cash (optional)', { placeholder: '₦2,000' })}
          <View style={styles.open}>
            <ThemedText style={[styles.sm, styles.medium]}>Open to</ThemedText>
            <CheckRow testID="run-form-allowVisitors" label="Visiting hashers from other kennels" checked={v.allowVisitors} onChange={set('allowVisitors')} />
            <CheckRow testID="run-form-allowGuests" label="Guests without an account" checked={v.allowGuests} onChange={set('allowGuests')} />
          </View>
        </CardContent>
      </Card>

      {canManage && members ? (
        <Card>
          <CardHeader style={styles.tight}>
            <CardTitle>Hares</CardTitle>
            <CardDescription>Hares are active members of the kennel. At least one is needed before the run is published.</CardDescription>
          </CardHeader>
          <CardContent style={styles.fields}>
            <Field label="Lead hare" error={errors.leadHareId}>
              <Select
                testID="run-form-leadHareId"
                value={v.leadHareId}
                onChange={(value) =>
                  setV((prev) => ({ ...prev, leadHareId: value, coHareIds: prev.coHareIds.filter((id) => id !== value) }))
                }
                options={[{ value: '', label: 'No hare yet' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
              />
            </Field>
            <View>
              <ThemedText style={[styles.sm, styles.medium]}>Co-hares</ThemedText>
              {errors.coHareIds ? (
                <ThemedText accessibilityRole="alert" style={[styles.xs, { color: theme.danger }]}>{errors.coHareIds}</ThemedText>
              ) : null}
              <CoHares members={members.filter((m) => m.userId !== v.leadHareId)} selected={v.coHareIds} onToggle={toggleCoHare} />
            </View>
          </CardContent>
        </Card>
      ) : null}

      <View style={styles.submit}>
        <Button size="lg" testID="run-form-submit" disabled={busy} onPress={() => void submit()}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </View>
    </View>
  );
}

function CoHares({ members, selected, onToggle }: { members: RunFormMember[]; selected: string[]; onToggle: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.coBox, { borderColor: t.border }]}>
      {members.map((m) => (
        <CheckRow key={m.userId} label={m.displayName} checked={selected.includes(m.userId)} onChange={() => onToggle(m.userId)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  tight: { paddingBottom: 12 },
  fields: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  medium: { fontWeight: '500' },
  textarea: { minHeight: 104, textAlignVertical: 'top', paddingTop: 10 },
  readonly: { gap: 4 },
  open: { gap: 8 },
  coBox: { marginTop: 8, borderWidth: 1, borderRadius: 8, padding: 8, maxHeight: 256 },
  submit: { alignItems: 'flex-end', paddingHorizontal: 16 },
});
