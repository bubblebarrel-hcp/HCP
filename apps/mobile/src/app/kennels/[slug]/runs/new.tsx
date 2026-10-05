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
import type { RunDetail, RunPlanningContext } from '@/lib/types';

// Plan a run, as the web lays it out (app/kennels/[slug]/runs/new/page.tsx): a header
// card with the way back, then the shared run form. It is saved as a draft.
export default function PlanRunScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [context, setContext] = useState<RunPlanningContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<RunPlanningContext>(`/kennels/${encodeURIComponent(slug)}/runs/planning`)
      .then((data) => alive && setContext(data))
      .catch((err) => alive && setError(errorMessage(err, 'Could not open run planning')));
    return () => {
      alive = false;
    };
  }, [user, slug]);

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
        <ThemedText testID="plan-run-forbidden" style={styles.bold}>{error}</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace(`/kennels/${slug}/runs` as never)}>Back to runs</Button>
      </Card>,
    );
  }
  if (!user || !context) return shell(<Skeleton height={384} />);

  const selfIsMember = context.members.some((m) => m.userId === user.id);

  return shell(
    <>
      <Card style={styles.head}>
        <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={16} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.sm}>{context.kennel.name}</ThemedText>
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.h1}>Plan a run</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>
          It is saved as a draft. Publish it when the hares and details are ready.
        </ThemedText>
      </Card>
      <RunForm
        canManage
        canChangeVisibility={context.canChangeVisibility}
        members={context.members}
        submitLabel="Save draft"
        defaults={{
          runNumber: String(context.nextRunNumber),
          title: '',
          runType: 'REGULAR',
          theme: '',
          description: '',
          startsAtLocal: '',
          timeZone: context.kennel.timeZone,
          meetingPointName: '',
          meetingAddress: '',
          visibility: context.kennel.defaultRunVisibility,
          capacity: '',
          hashCash: '',
          allowGuests: true,
          allowVisitors: true,
          leadHareId: selfIsMember ? user.id : '',
          coHareIds: [],
        }}
        onSubmit={async (payload) => {
          try {
            const data = await api<{ run: RunDetail }>(`/kennels/${encodeURIComponent(slug)}/runs`, { method: 'POST', body: payload });
            router.replace(`/run/${data.run.id}`);
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
  mt16: { marginTop: 16 },
  // mb-4 p-5
  head: { padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
});
