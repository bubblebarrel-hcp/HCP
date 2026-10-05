import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Beer, Clock, Flag, Footprints, Lock, MapPin, Ruler, type LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { TrailMap } from '@/components/map/trail-map';
import { TrailPlanner } from '@/components/trails/trail-planner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatRunDate } from '@/lib/format';
import { runHeading } from '@/lib/runs';
import {
  chalkLabel,
  formatDistance,
  formatDuration,
  releaseModeLabel,
  trailPoints,
  trailStatusLabel,
  trailStatusTone,
  trailSteps,
  trailStyleLabel,
  waypointKindLabel,
} from '@/lib/trails';
import type { Page, RunDetail, Trail, TrailRevision } from '@/lib/types';

// A trail, as the web lays it out (app/trails/[id]/page.tsx): the header, the lifecycle
// step for those who may take it, planning history, then either the hare's workspace, the
// released map, or the "hares are keeping this one quiet" card. Secrecy is the server's
// job: `secret` and `viewer.canSeeSecret` come from the API, and nothing is drawn that it
// did not send.
const PLANNING_STATES = ['DRAFT', 'PLANNING', 'REVIEW'];

function Line({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.line}>
      <Icon size={20} color={theme.textSecondary} />
      <ThemedText style={styles.lineText}>{children}</ThemedText>
    </View>
  );
}

export default function TrailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading, user } = useAuth();
  const [trail, setTrail] = useState<Trail | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [revisions, setRevisions] = useState<TrailRevision[] | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<{ trail: Trail }>(`/trails/${id}`)
      .then(async (data) => {
        const runData = await api<{ run: RunDetail }>(`/runs/${data.trail.runId}`);
        if (!alive) return;
        setTrail(data.trail);
        setRun(runData.run);
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Trail not found')));
    return () => {
      alive = false;
    };
  }, [id, loading, user]);

  const act = useCallback(
    async (action: string, reason?: string) => {
      try {
        const data = await api<{ trail: Trail }>(`/trails/${id}/actions/${action}`, { method: 'POST', body: { reason } });
        setTrail(data.trail);
      } catch (err) {
        Alert.alert('That did not work', errorMessage(err, 'That did not work'));
        throw err;
      }
    },
    [id],
  );

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText testID="trail-not-found" style={styles.bold}>{error}</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace('/runs')}>Back to runs</Button>
      </Card>,
    );
  }
  if (!trail || !run) return shell(<Skeleton height={384} />);

  const v = trail.viewer;
  const secret = trail.secret;
  const step = trailSteps[trail.status];
  const canStep = step && (step.needsLead ? v.canRelease : v.canPlan);
  const editable = v.canPlan && PLANNING_STATES.includes(trail.status);
  const center: [number, number] | null =
    run.meetingLongitude != null && run.meetingLatitude != null
      ? [run.meetingLongitude, run.meetingLatitude]
      : (secret?.routeGeoJson?.coordinates[0] ?? null);

  const distance = formatDistance(trail.estimatedDistanceM);
  const duration = formatDuration(trail.estimatedDurationMin);

  async function toggleRevisions() {
    const next = !showRevisions;
    setShowRevisions(next);
    if (next && !revisions) {
      try {
        const data = await api<Page<TrailRevision>>(`/trails/${id}/revisions`);
        setRevisions(data.items);
      } catch (err) {
        Alert.alert('Could not load the history', errorMessage(err, 'Could not load the history'));
        setShowRevisions(false);
      }
    }
  }

  return shell(
    <>
      <Card style={styles.head}>
        <View testID="trail-header">
          <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${trail.runId}`)} style={styles.back}>
            <ArrowLeft size={16} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.sm}>{runHeading(run)}</ThemedText>
          </Pressable>
          <View style={styles.badges}>
            <View testID="trail-status"><Badge tone={trailStatusTone(trail.status)}>{trailStatusLabel[trail.status]}</Badge></View>
            <Badge>{trailStyleLabel[trail.style]}</Badge>
          </View>
          <ThemedText accessibilityRole="header" testID="trail-name" style={styles.h1}>{trail.name}</ThemedText>
          <View style={styles.lines}>
            <Line icon={Footprints}>
              {trail.hares.length === 0
                ? 'No hares'
                : `Hare${trail.hares.length > 1 ? 's' : ''}: ${trail.hares
                    .map((h) => (h.isLead && trail.hares.length > 1 ? `${h.displayName} (lead)` : h.displayName))
                    .join(', ')}`}
            </Line>
            {(distance || duration) && (
              <Line icon={Ruler}>
                {[distance, duration].filter(Boolean).join(' · ')}
                {trail.terrain ? ` · ${trail.terrain}` : ''}
              </Line>
            )}
            <Line icon={Clock}>
              {trail.isReleased
                ? `Released ${formatDate(trail.releasedAt ?? trail.createdAt)}`
                : `Releases: ${releaseModeLabel[trail.releaseMode].toLowerCase()}${
                    trail.releaseMode === 'SCHEDULED' && trail.releaseAt ? ` (${formatRunDate(trail.releaseAt, run.timeZone)})` : ''
                  }`}
            </Line>
          </View>
        </View>
      </Card>

      {(canStep || v.canArchive) && (
        <Card>
          <View testID="trail-lifecycle" style={styles.lifecycle}>
            {canStep && (
              <ActionDialog
                trigger={(open) => <Button testID="trail-next-step" onPress={open}>{step.label}</Button>}
                title={`${step.label}?`}
                description={
                  step.action === 'release'
                    ? 'Everyone who can see the run will see the route, waypoints, beer checks and chalk.'
                    : step.action === 'hide'
                      ? 'The trail becomes secret until its release condition is met. This cannot be undone.'
                      : step.action === 'lock'
                        ? 'Planning stops. A hare can unlock it again before it is hidden.'
                        : undefined
                }
                confirmLabel={step.label}
                text={step.action === 'release' ? { label: 'Note', marked: true } : undefined}
                onConfirm={({ text }) => act(step.action, text)}
              />
            )}
            {trail.status === 'LOCKED' && v.canPlan && (
              <Button variant="outline" onPress={() => void act('restore-draft').catch(() => undefined)}>Unlock for editing</Button>
            )}
            {v.canArchive && ['RELEASED', 'LIVE', 'COMPLETED'].includes(trail.status) && (
              <ActionDialog
                trigger={(open) => <Button variant="ghost" onPress={open}>Archive trail</Button>}
                title="Archive this trail?"
                description="It becomes part of the run's history and stops changing."
                confirmLabel="Archive"
                onConfirm={() => act('archive')}
              />
            )}
            {v.canPlan && (
              <Button variant="ghost" style={styles.history} onPress={() => void toggleRevisions()}>History</Button>
            )}
          </View>
        </Card>
      )}

      {showRevisions && (
        <Card>
          <View testID="trail-revisions">
            <CardHeader style={styles.tight}>
              <CardTitle>Planning history</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                {(revisions ?? []).map((revision) => (
                  <ThemedText key={revision.id} style={styles.sm}>
                    <ThemedText style={[styles.sm, styles.medium]}>{Object.keys(revision.changes).join(', ') || 'Edited'}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {' · '}{formatDate(revision.createdAt)} · {revision.editor}
                    </ThemedText>
                  </ThemedText>
                ))}
                {revisions?.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>No edits recorded yet.</ThemedText>}
              </View>
            </CardContent>
          </View>
        </Card>
      )}

      {!v.canSeeSecret ? (
        <Card style={styles.hidden}>
          <View testID="trail-hidden" style={styles.center}>
            <Lock size={32} color={theme.textSecondary} />
            <ThemedText style={[styles.bold, styles.mt8]}>The hares are keeping this one quiet</ThemedText>
            <ThemedText themeColor="textSecondary" style={[styles.sm, styles.centerText, styles.mt4]}>
              The route, waypoints, beer checks and chalk appear when the trail is released:{' '}
              {releaseModeLabel[trail.releaseMode].toLowerCase()}
              {trail.releaseMode === 'SCHEDULED' && trail.releaseAt ? `, ${formatRunDate(trail.releaseAt, run.timeZone)}` : ''}.
            </ThemedText>
          </View>
        </Card>
      ) : editable ? (
        <TrailPlanner trail={trail} center={center} onTrail={setTrail} />
      ) : (
        <TrailMap route={secret?.routeGeoJson ?? null} points={trailPoints(trail)} center={center} />
      )}

      {v.canSeeSecret && secret && (
        <>
          <Card>
            <View testID="trail-waypoints">
              <CardHeader style={styles.tight}>
                <CardTitle>Waypoints and beer checks</CardTitle>
              </CardHeader>
              <CardContent style={styles.gap8}>
                {secret.waypoints.length === 0 && secret.beerChecks.length === 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing placed yet.</ThemedText>
                ) : (
                  <>
                    {secret.waypoints.map((w) => (
                      <View key={w.id} style={styles.item}>
                        {w.kind === 'HAZARD' ? <MapPin size={16} color={theme.danger} /> : <Flag size={16} color={theme.primaryStrong} />}
                        <View style={styles.flex}>
                          <ThemedText style={styles.sm}>
                            <ThemedText style={[styles.sm, styles.medium]}>{waypointKindLabel[w.kind]}</ThemedText>
                            {w.label ? ` · ${w.label}` : ''}
                          </ThemedText>
                          {w.notes ? <ThemedText themeColor="textSecondary" style={styles.sm}>{w.notes}</ThemedText> : null}
                        </View>
                      </View>
                    ))}
                    {secret.beerChecks.map((b) => (
                      <View key={b.id} style={styles.item}>
                        <Beer size={16} color={theme.accentStrong} />
                        <View style={styles.flex}>
                          <ThemedText style={[styles.sm, styles.medium]}>{b.name}</ThemedText>
                          {b.notes ? <ThemedText themeColor="textSecondary" style={styles.sm}>{b.notes}</ThemedText> : null}
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </CardContent>
            </View>
          </Card>

          <Card>
            <View testID="trail-chalk">
              <CardHeader style={styles.tight}>
                <CardTitle>Digital chalk</CardTitle>
              </CardHeader>
              <CardContent style={styles.gap8}>
                {secret.chalk.length === 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>No chalk laid yet.</ThemedText>
                ) : (
                  secret.chalk.map((c) => (
                    <View key={c.id} style={styles.chalkRow}>
                      <ThemedText style={[styles.sm, styles.flex]}>
                        <ThemedText style={[styles.sm, styles.medium]}>{chalkLabel[c.symbol]}</ThemedText>
                        {c.customLabel ? ` · ${c.customLabel}` : ''}
                      </ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.sm}>{c.placedBy}</ThemedText>
                    </View>
                  ))
                )}
                {secret.notes ? (
                  <View style={[styles.notes, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.sm}>
                      <ThemedText style={[styles.sm, styles.medium]}>Hare notes:</ThemedText> {secret.notes}
                    </ThemedText>
                  </View>
                ) : null}
              </CardContent>
            </View>
          </Card>
        </>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  notFound: { padding: 32, alignItems: 'center' },
  hidden: { padding: 32 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  head: { padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  badges: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lines: { marginTop: 12, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  lifecycle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 16 },
  history: { marginLeft: 'auto' },
  tight: { paddingBottom: 12 },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
  gap8: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  chalkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  notes: { marginTop: 8, borderRadius: 8, padding: 12 },
});
