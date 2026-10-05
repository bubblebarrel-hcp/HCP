import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Award, Pencil } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { CheckRow } from '@/components/ui/check-row';
import { FormDialog } from '@/components/ui/form-dialog';
import { Select } from '@/components/ui/select';
import { Button, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import type { RunDetail } from '@/lib/types';

type Send = (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: object) => Promise<void>;

// The Circle record and awards (Annex 08E-04), as the web's two dialogs
// (components/runs/RunPanels.tsx CircleEditDialog and AwardDialog).
export function CircleEditDialog({ run, send }: { run: RunDetail; send: Send }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = () => ({
    songs: (run.circle?.songs ?? []).join('\n'),
    announcements: run.circle?.announcements ?? '',
    notes: run.circle?.notes ?? '',
  });
  const [values, setValues] = useState(initial);

  async function save() {
    setBusy(true);
    try {
      await send('PATCH', `/runs/${run.id}/circle`, {
        songs: values.songs.split('\n').map((s) => s.trim()).filter(Boolean),
        announcements: values.announcements,
        notes: values.notes,
      });
      setOpen(false);
    } catch {
      // The run screen has already said why.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        testID="circle-edit"
        onPress={() => {
          setValues(initial());
          setOpen(true);
        }}>
        <Pencil size={16} color={theme.text} />
        <ThemedText style={styles.buttonText}>Record</ThemedText>
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Circle record"
        description="Songs, announcements and notes become part of the Run Capsule."
        submitLabel={busy ? 'Saving…' : 'Save'}
        onSubmit={() => void save()}>
        <Field label="Songs" hint="One song per line.">
          <Input value={values.songs} onChangeText={(songs) => setValues((v) => ({ ...v, songs }))} multiline accessibilityLabel="Songs" style={styles.area4} />
        </Field>
        <Field label="Announcements">
          <Input value={values.announcements} onChangeText={(announcements) => setValues((v) => ({ ...v, announcements }))} multiline accessibilityLabel="Announcements" style={styles.area3} />
        </Field>
        <Field label="Notes" hint="For the Hash Scribe's trail report.">
          <Input value={values.notes} onChangeText={(notes) => setValues((v) => ({ ...v, notes }))} multiline accessibilityLabel="Notes" style={styles.area4} />
        </Field>
      </FormDialog>
    </>
  );
}

export function AwardDialog({ run, send }: { run: RunDetail; send: Send }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { title: '', recipient: '', otherName: '', reason: '', isDownDown: false };
  const [values, setValues] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const candidates = (run.participants ?? []).filter((p) => p.checkedInAt || p.rsvpStatus === 'GOING');

  function close() {
    setOpen(false);
    setValues(blank);
    setError(null);
  }

  async function submit() {
    if (values.title.trim().length < 2) return setError('Give the award a title.');
    if (!values.recipient) return setError('Choose who it is for.');
    if (values.recipient === '__other' && !values.otherName.trim()) return setError('Enter a name.');
    setError(null);
    setBusy(true);
    try {
      await send('POST', `/runs/${run.id}/circle/awards`, {
        title: values.title,
        reason: values.reason,
        isDownDown: values.isDownDown,
        ...(values.recipient === '__other' ? { recipientName: values.otherName } : { participationId: values.recipient }),
      });
      close();
    } catch {
      // The run screen has already said why.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" testID="award-add" onPress={() => setOpen(true)}>
        <Award size={16} color={theme.text} />
        <ThemedText style={styles.buttonText}>Add award</ThemedText>
      </Button>
      <FormDialog
        open={open}
        onClose={close}
        busy={busy}
        submitTestID="award-submit"
        title="Add an award or down-down"
        description="Recognition, not ranking."
        submitLabel={busy ? 'Saving…' : 'Add award'}
        onSubmit={() => void submit()}>
        {error ? <ThemedText accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</ThemedText> : null}
        <Field label="Title">
          <Input
            value={values.title}
            onChangeText={(title) => setValues((v) => ({ ...v, title }))}
            placeholder="Down-down, Best trail, Hare recognition…"
            accessibilityLabel="Title"
          />
        </Field>
        <Field label="For">
          <Select
            value={values.recipient}
            onChange={(recipient) => setValues((v) => ({ ...v, recipient }))}
            options={[
              { value: '', label: 'Choose…' },
              ...candidates.map((p) => ({ value: p.id, label: p.displayName })),
              { value: '__other', label: 'Someone else' },
            ]}
          />
        </Field>
        {values.recipient === '__other' ? (
          <Field label="Name">
            <Input value={values.otherName} onChangeText={(otherName) => setValues((v) => ({ ...v, otherName }))} accessibilityLabel="Name" />
          </Field>
        ) : null}
        <Field label="Reason (optional)">
          <Input value={values.reason} onChangeText={(reason) => setValues((v) => ({ ...v, reason }))} multiline accessibilityLabel="Reason (optional)" style={styles.area2} />
        </Field>
        {run.kennel.downDownsEnabled ? (
          <CheckRow label="This is a down-down" checked={values.isDownDown} onChange={(isDownDown) => setValues((v) => ({ ...v, isDownDown }))} />
        ) : null}
      </FormDialog>
    </>
  );
}

const styles = StyleSheet.create({
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  area2: { minHeight: 64, textAlignVertical: 'top', paddingTop: 10 },
  area3: { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
  area4: { minHeight: 104, textAlignVertical: 'top', paddingTop: 10 },
});
