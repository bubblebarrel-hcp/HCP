import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RunForm } from '@/components/runs/run-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { runHeading } from '@/lib/runs';
import type { RunDetail, RunPlanningContext } from '@/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');

// The run's own wall clock as "YYYY-MM-DDTHH:mm", for when the API did not send one.
function wallClock(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${pad(Number(get('hour')))}:${get('minute')}`;
}

// Edit a run, as the web lays it out (app/runs/[id]/edit/page.tsx): a header card with
// the way back, then the shared run form. Every change is recorded with its previous value.
export default function EditRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [context, setContext] = useState<RunPlanningContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ run: RunDetail }>(`/runs/${id}`)
      .then(async (data) => {
        const detail = data.run;
        // Officers choose hares, which needs the kennel's member list.
        const ctx = detail.viewer.canManage
          ? await api<RunPlanningContext>(`/kennels/${encodeURIComponent(detail.kennel.slug)}/runs/planning`)
          : null;
        if (!alive) return;
        setRun(detail);
        setContext(ctx);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Could not load the run')));
    return () => {
      alive = false;
    };
  }, [user, id]);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.safe}>
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.forbidden}>
        <ThemedText style={styles.bold}>{error}</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace('/runs')}>Back to runs</Button>
      </Card>,
    );
  }
  if (!user || !run) return shell(<Skeleton height={384} />);

  if (!run.viewer.canEdit) {
    return shell(
      <Card style={styles.forbidden}>
        <ThemedText testID="edit-run-forbidden" style={styles.bold}>This run can’t be edited by you right now.</ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.center, styles.mt4]}>
          Hares edit while the run is a draft, scheduled or in planning; officers until it starts.
        </ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace(`/run/${id}`)}>Back to the run</Button>
      </Card>,
    );
  }

  const lead = run.hares?.find((h) => h.isLead);

  return shell(
    <>
      <Card style={styles.head}>
        <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={16} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.sm}>{runHeading(run)}</ThemedText>
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.h1}>Edit run</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>Every change is recorded with its previous value.</ThemedText>
      </Card>
      <RunForm
        canManage={run.viewer.canManage}
        canChangeVisibility={run.viewer.canChangeVisibility}
        members={context?.members}
        submitLabel="Save changes"
        defaults={{
          runNumber: String(run.runNumber),
          title: run.title,
          runType: run.runType ?? 'REGULAR',
          theme: run.theme ?? '',
          description: run.description ?? '',
          startsAtLocal: run.startsAtLocal ?? wallClock(run.startsAt, run.timeZone),
          timeZone: run.timeZone,
          meetingPointName: run.meetingPointName ?? '',
          meetingAddress: run.meetingAddress ?? '',
          visibility: run.visibility ?? 'PUBLIC',
          capacity: run.capacity ? String(run.capacity) : '',
          hashCash: run.hashCash ?? '',
          allowGuests: run.allowGuests ?? true,
          allowVisitors: run.allowVisitors,
          leadHareId: lead?.userId ?? '',
          coHareIds: (run.hares ?? []).filter((h) => !h.isLead).map((h) => h.userId),
        }}
        onSubmit={async (payload) => {
          try {
            await api(`/runs/${id}`, { method: 'PATCH', body: payload });
            router.replace(`/run/${id}`);
          } catch (err) {
            Alert.alert('Could not save the run', errorMessage(err, 'Could not save the run'));
          }
        }}
      />
    </>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  forbidden: { padding: 32, alignItems: 'center' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  center: { textAlign: 'center' },
  mt4: { marginTop: 4 },
  mt16: { marginTop: 16 },
  head: { padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
});
