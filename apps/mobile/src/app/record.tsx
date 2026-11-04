import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import { Flag, Pause, Play, Square } from 'lucide-react-native';

import { RouteMap, type RouteSegment } from '@/components/record/route-map';
import { StatGrid } from '@/components/record/stat-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Segmented } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { computeStats, type TrackPoint } from '@/lib/activity-math';
import { flushPending } from '@/lib/activity-upload';
import {
  audienceLabel,
  audienceNote,
  defaultTitle,
  formatDistance,
  formatDuration,
  formatPace,
  kindLabel,
} from '@/lib/activities';
import {
  discardRecording,
  elapsedMs,
  ensurePermission,
  keepRecording,
  pauseRecording,
  reconcileActive,
  resumeRecording,
  startRecording,
  stopRecording,
  type PermissionResult,
} from '@/lib/recorder';
import { readPointsFrom, type ActiveRecording } from '@/lib/recording-store';
import { errorMessage } from '@/lib/api';
import type { ActivityAudience, ActivityKind } from '@/lib/types';

// Recording a run (D79): the screen a hasher watches, glances at, or leaves in a
// pocket. What it shows is read back from the file the location task writes
// (recording-store.ts), so the clock and the route are right when the app comes
// back from the background, or from being killed.
//
// Three stages: before Start; Recording / Paused; and the summary after Finish,
// where the hasher names it, picks who sees it and saves. Nothing is sent until
// they do, and a save with no signal waits on the phone (activity-upload.ts).

const KINDS: ActivityKind[] = ['HASH_RUN', 'TRAIL_LAYING', 'SOLO'];

function segmentsOf(points: TrackPoint[]): RouteSegment[][] {
  const out: RouteSegment[][] = [];
  let seg: number | undefined;
  for (const p of points) {
    if (p.seg !== seg || out.length === 0) {
      out.push([]);
      seg = p.seg;
    }
    out[out.length - 1].push({ latitude: p.lat, longitude: p.lng });
  }
  return out;
}

// How fast the hasher is going right now: the last half minute of the run.
function currentPace(points: TrackPoint[]) {
  const last = points[points.length - 1];
  if (!last) return null;
  const recent = points.filter((p) => p.seg === last.seg && p.t >= last.t - 30_000);
  if (recent.length < 3) return null;
  const s = computeStats(recent);
  return s.distanceM >= 15 ? s.avgPaceSPerKm : null;
}

function speakKm(km: number, timeS: number, paceS: number | null) {
  const minutes = Math.floor(timeS / 60);
  const seconds = Math.round(timeS % 60);
  const pace = paceS ? ` Pace ${Math.floor(paceS / 60)} minutes ${Math.round(paceS % 60)} seconds per kilometre.` : '';
  Speech.speak(`${km} ${km === 1 ? 'kilometre' : 'kilometres'}. Time ${minutes} minutes ${seconds} seconds.${pace}`, { language: 'en' });
}

export default function RecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; runId?: string; trailId?: string; runTitle?: string }>();

  const wanted: ActivityKind = KINDS.includes(params.kind as ActivityKind) ? (params.kind as ActivityKind) : 'SOLO';

  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const [permission, setPermission] = useState<PermissionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(true);
  const spokenKm = useRef(0);

  // Finished, and being named.
  const [review, setReview] = useState<{ active: ActiveRecording; points: TrackPoint[] } | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [audience, setAudience] = useState<ActivityAudience>('FOLLOWERS');

  // Pick up a recording already in progress (the app was closed or killed mid-run).
  useEffect(() => {
    let live = true;
    void (async () => {
      const found = await reconcileActive();
      if (!live) return;
      if (found) {
        const read = readPointsFrom(0);
        offset.current = read.next;
        setPoints(read.points);
        spokenKm.current = Math.floor(computeStats(read.points).distanceM / 1000);
      }
      setActive(found);
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  // While recording: a clock tick, and any fixes the task has written since.
  useEffect(() => {
    if (!active || review) return;
    const id = setInterval(() => {
      setNow(Date.now());
      const read = readPointsFrom(offset.current);
      if (read.points.length > 0) {
        offset.current = read.next;
        setPoints((prev) => [...prev, ...read.points]);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [active, review]);

  // The screen stays lit while recording, so it can be glanced at.
  const recording = active?.status === 'RECORDING' && !review;
  useEffect(() => {
    if (!recording) return;
    void KeepAwake.activateKeepAwakeAsync('hcp-recording');
    return () => {
      void KeepAwake.deactivateKeepAwake('hcp-recording').catch(() => undefined);
    };
  }, [recording]);

  const stats = useMemo(() => computeStats(points), [points]);
  const pace = useMemo(() => currentPace(points), [points]);

  // A voice cue at every whole kilometre.
  useEffect(() => {
    if (!voice || !recording) return;
    const km = Math.floor(stats.distanceM / 1000);
    if (km > spokenKm.current) {
      spokenKm.current = km;
      speakKm(km, stats.movingTimeS, stats.avgPaceSPerKm);
    }
  }, [voice, recording, stats]);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const result = await ensurePermission();
      setPermission(result);
      if (result !== 'granted') return;
      offset.current = 0;
      spokenKm.current = 0;
      setPoints([]);
      setActive(
        await startRecording({
          kind: wanted,
          runId: params.runId ?? null,
          trailId: params.trailId ?? null,
          runTitle: params.runTitle ?? null,
        }),
      );
      if (voice) Speech.speak('Recording started.', { language: 'en' });
    } catch (err) {
      Alert.alert('Could not start', errorMessage(err, 'Could not start recording.'));
    } finally {
      setBusy(false);
    }
  }, [wanted, params.runId, params.trailId, params.runTitle, voice]);

  async function togglePause() {
    setBusy(true);
    try {
      const next = active?.status === 'RECORDING' ? await pauseRecording() : await resumeRecording();
      if (next) setActive(next);
      if (voice && next) Speech.speak(next.status === 'PAUSED' ? 'Paused.' : 'Resumed.', { language: 'en' });
    } catch (err) {
      Alert.alert('Could not do that', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    Alert.alert('Finish this run?', 'You can name it and choose who sees it next.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const done = await stopRecording();
              if (!done.active) return;
              setTitle(defaultTitle(done.active.kind, new Date(done.active.startedAt), done.active.runTitle));
              setReview({ active: done.active, points: done.points });
            } catch (err) {
              Alert.alert('Could not finish', errorMessage(err));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  function discard() {
    Alert.alert('Throw this run away?', 'It will not be saved anywhere.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void discardRecording().then(() => router.back());
        },
      },
    ]);
  }

  async function save() {
    if (!review) return;
    setBusy(true);
    try {
      keepRecording(review.active, review.points, { title: title.trim() || null, notes: notes.trim() || null, audience });
      const result = await flushPending();
      if (result.uploaded[0]) {
        router.replace(`/activities/${result.uploaded[0].id}` as never);
      } else if (result.refused[0]) {
        Alert.alert('Could not keep that run', result.refused[0].message, [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Saved on your phone', 'It will go up as soon as you are back online.', [
          { text: 'OK', onPress: () => router.replace('/activities' as never) },
        ]);
      }
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <ThemedView type="canvas" style={styles.screen} />;

  // ─── After Finish: name it, choose who sees it, save ───
  if (review) {
    const final = computeStats(review.points);
    const tooShort = final.distanceM < 50 || final.movingTimeS < 10;
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <RouteMap segments={segmentsOf(review.points)} height={260} testID="review-map" />
          <StatGrid
            hero={{ label: 'Distance', value: formatDistance(final.distanceM), unit: 'km', testID: 'review-distance' }}
            stats={[
              { label: 'Time', value: formatDuration(final.movingTimeS) },
              { label: 'Avg pace', value: formatPace(final.avgPaceSPerKm), unit: '/km' },
              { label: 'Climb', value: String(final.elevationGainM), unit: 'm' },
              { label: 'Elapsed', value: formatDuration(final.elapsedTimeS) },
            ]}
          />
          {tooShort ? (
            <Card>
              <CardContent>
                <ThemedText themeColor="textSecondary" style={styles.sm}>
                  That was under 50 metres, too short to keep. Throw it away and start again when you are ready.
                </ThemedText>
              </CardContent>
              <CardContent>
                <Button variant="destructive" onPress={discard}>Discard</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Save this run</CardTitle>
                <CardDescription>{kindLabel[review.active.kind]}</CardDescription>
              </CardHeader>
              <CardContent style={styles.form}>
                <Field label="Name">
                  <Input value={title} maxLength={120} onChangeText={setTitle} testID="activity-title" />
                </Field>
                <Field label="Notes (optional)">
                  <Input value={notes} multiline maxLength={2000} style={styles.notes} onChangeText={setNotes} />
                </Field>
                <Field label="Who can see it">
                  <Segmented<ActivityAudience>
                    value={audience}
                    onChange={setAudience}
                    testIDPrefix="audience"
                    options={(['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] as const).map((value) => ({ value, label: audienceLabel[value] }))}
                  />
                </Field>
                <ThemedText themeColor="textSecondary" style={styles.sm}>{audienceNote[audience]}</ThemedText>
                {review.active.kind === 'TRAIL_LAYING' && (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    Nobody but you sees a trail you laid until the trail is released.
                  </ThemedText>
                )}
              </CardContent>
              <CardContent style={styles.row}>
                <Button variant="outline" disabled={busy} onPress={discard}>Discard</Button>
                <Button busy={busy} testID="activity-save" style={styles.grow} onPress={() => void save()}>Save run</Button>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </ThemedView>
    );
  }

  // ─── Before Start ───
  if (!active) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <CardHeader>
              <CardTitle>{kindLabel[wanted]}</CardTitle>
              <CardDescription>
                {params.runTitle
                  ? wanted === 'TRAIL_LAYING'
                    ? `Record the trail you lay for ${params.runTitle}.`
                    : `Record your run at ${params.runTitle}.`
                  : 'Record a run of your own. Time, distance, pace and your route.'}
              </CardDescription>
            </CardHeader>
            <CardContent style={styles.form}>
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                Shiggy Trails keeps recording with the screen off. Start it, put your phone in your pocket, and finish when you are back.
              </ThemedText>
              <View style={styles.between}>
                <ThemedText style={styles.sm}>Voice update every kilometre</ThemedText>
                <Switch value={voice} onValueChange={setVoice} trackColor={{ true: theme.primary }} />
              </View>
              {permission && permission !== 'granted' && (
                <View testID="record-permission" style={[styles.notice, { borderColor: theme.danger }]}>
                  <ThemedText style={styles.sm}>
                    {permission === 'blocked'
                      ? 'Location is turned off for Shiggy Trails. Turn it on in Settings to record a run.'
                      : 'Shiggy Trails needs your location to record a run.'}
                  </ThemedText>
                  {permission === 'blocked' && (
                    <Button variant="outline" size="sm" onPress={() => void Linking.openSettings()}>Open settings</Button>
                  )}
                </View>
              )}
              <Button size="lg" busy={busy} testID="record-start" onPress={() => void start()}>
                <Play size={20} color={theme.onPrimary} />
                <ThemedText style={[styles.startText, { color: theme.onPrimary }]}>Start</ThemedText>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </ThemedView>
    );
  }

  // ─── Recording or paused ───
  const paused = active.status === 'PAUSED';
  return (
    <ThemedView type="canvas" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <RouteMap segments={segmentsOf(points)} follow={!paused} height={300} testID="live-map" />
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: paused ? theme.accent : theme.danger }]} />
          <ThemedText testID="record-status" style={styles.sm}>
            {paused ? 'Paused' : 'Recording'} · {kindLabel[active.kind]}
            {active.runTitle ? ` · ${active.runTitle}` : ''}
          </ThemedText>
        </View>
        <StatGrid
          hero={{ label: 'Time', value: formatDuration(elapsedMs(active, now) / 1000), testID: 'record-time' }}
          stats={[
            { label: 'Distance', value: formatDistance(stats.distanceM), unit: 'km', testID: 'record-distance' },
            { label: 'Avg pace', value: formatPace(stats.avgPaceSPerKm), unit: '/km' },
            { label: 'Pace now', value: paused ? '–:––' : formatPace(pace), unit: '/km' },
            { label: 'Climb', value: String(stats.elevationGainM), unit: 'm' },
          ]}
        />
        <View style={styles.controls}>
          <Button size="lg" variant="outline" busy={busy} testID="record-pause" style={styles.grow} onPress={() => void togglePause()}>
            {paused ? <Play size={20} color={theme.text} /> : <Pause size={20} color={theme.text} />}
            <ThemedText style={styles.controlText}>{paused ? 'Resume' : 'Pause'}</ThemedText>
          </Button>
          <Button size="lg" disabled={busy} testID="record-finish" style={styles.grow} onPress={finish}>
            <Flag size={20} color={theme.onPrimary} />
            <ThemedText style={[styles.controlText, { color: theme.onPrimary }]}>Finish</ThemedText>
          </Button>
        </View>
        <View style={styles.between}>
          <ThemedText themeColor="textSecondary" style={styles.sm}>Voice update every kilometre</ThemedText>
          <Switch value={voice} onValueChange={setVoice} trackColor={{ true: theme.primary }} />
        </View>
        <Button variant="ghost" size="sm" onPress={discard}>
          <Square size={14} color={theme.danger} />
          <ThemedText style={[styles.sm, { color: theme.danger }]}>Discard this run</ThemedText>
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingVertical: 16, paddingBottom: 48 },
  form: { gap: 12 },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 },
  startText: { fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  controls: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  controlText: { fontSize: 16, fontWeight: '600' },
});
