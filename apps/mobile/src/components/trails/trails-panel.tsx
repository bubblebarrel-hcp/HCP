import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Lock, Map as MapIcon, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Select } from '@/components/ui/select';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDistance, releaseModeLabel, trailStatusLabel, trailStatusTone, trailStyleLabel } from '@/lib/trails';
import type { Page, Trail } from '@/lib/types';

function PlanTrailDialog({ runId, onCreated }: { runId: string; onCreated: (trail: Trail) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: 'Main Trail', style: 'DEAD_HARE', releaseMode: 'AT_RUN_START' });

  async function create() {
    setBusy(true);
    try {
      const data = await api<{ trail: Trail }>(`/runs/${runId}/trails`, { method: 'POST', body: values });
      onCreated(data.trail);
      setOpen(false);
    } catch (err) {
      Alert.alert('Could not create the trail', errorMessage(err, 'Could not create the trail'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" testID="plan-trail" onPress={() => setOpen(true)}>
        <Plus size={16} color={theme.onPrimary} />
        <ThemedText style={[styles.buttonText, { color: theme.onPrimary }]}>Plan a trail</ThemedText>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText accessibilityRole="header" style={styles.dialogTitle}>Plan a trail</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sm}>Only the hares see it until it is released.</ThemedText>
            <View style={styles.fields}>
              <Field label="Name" hint="Main Trail, Walkers Trail, B Trail…">
                <Input value={values.name} onChangeText={(name) => setValues((v) => ({ ...v, name }))} />
              </Field>
              <Field label="Style">
                <Select
                  value={values.style}
                  onChange={(style) => setValues((v) => ({ ...v, style }))}
                  options={Object.entries(trailStyleLabel).map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <Field label="Release the trail" hint="You can change this while planning.">
                <Select
                  value={values.releaseMode}
                  onChange={(releaseMode) => setValues((v) => ({ ...v, releaseMode }))}
                  options={(['AT_RUN_START', 'CHECK_IN', 'SCHEDULED', 'MANUAL'] as const).map((mode) => ({ value: mode, label: releaseModeLabel[mode] }))}
                />
              </Field>
            </View>
            <View style={styles.footer}>
              <Button variant="outline" disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
              <Button testID="plan-trail-submit" disabled={busy} busy={busy} onPress={() => void create()}>
                {busy ? 'Saving…' : 'Create trail'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// The run page's view of its trails (components/trails/TrailsPanel.tsx). What it shows
// before release is deliberately thin: that a trail exists, how long it is, and when it
// opens.
export function TrailsPanel({ runId, canPlan }: { runId: string; canPlan: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Page<Trail>>(`/runs/${runId}/trails`)
      .then((page) => alive && setTrails(page.items))
      .catch((err) => alive && setError(errorMessage(err, 'Could not load trails')));
    return () => {
      alive = false;
    };
  }, [runId]);

  if (!canPlan && trails !== null && trails.length === 0) return null;

  return (
    <Card>
      <View testID="trails-panel">
        <CardHeader style={styles.header}>
          <CardTitle>Trails</CardTitle>
          {canPlan ? <PlanTrailDialog runId={runId} onCreated={(trail) => router.push(`/trails/${trail.id}` as never)} /> : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>{error}</ThemedText>
          ) : trails === null ? (
            <View style={[styles.skeleton, { backgroundColor: theme.backgroundElement }]} />
          ) : trails.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.sm}>No trail yet. The hares lay it before the run.</ThemedText>
          ) : (
            trails.map((trail, i) => {
              const distance = formatDistance(trail.estimatedDistanceM);
              return (
                <View key={trail.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={[styles.icon, { backgroundColor: trail.isReleased ? theme.primary + '1a' : theme.backgroundElement }]}>
                    {trail.isReleased ? <MapIcon size={20} color={theme.primaryStrong} /> : <Lock size={20} color={theme.textSecondary} />}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText
                      accessibilityRole="link"
                      testID="trail-link"
                      onPress={() => router.push(`/trails/${trail.id}` as never)}
                      style={styles.name}>
                      {trail.name}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {trailStyleLabel[trail.style]}
                      {distance ? ` · ${distance}` : ''}
                      {!trail.isReleased ? ` · releases ${releaseModeLabel[trail.releaseMode].toLowerCase()}` : ''}
                    </ThemedText>
                  </View>
                  <Badge tone={trailStatusTone(trail.status)}>{trailStatusLabel[trail.status]}</Badge>
                </View>
              );
            })
          )}
        </CardContent>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  skeleton: { height: 64, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 448, borderWidth: 1, borderRadius: 12, padding: 24, gap: 6 },
  dialogTitle: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  fields: { marginTop: 12, gap: 16 },
  footer: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
