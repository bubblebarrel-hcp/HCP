import * as Location from 'expo-location';

import { RECORDING_TASK } from '@/lib/recording-task';
import {
  clearActive,
  readActive,
  readPointsFrom,
  savePending,
  startActiveFiles,
  writeActive,
  type ActiveRecording,
} from '@/lib/recording-store';
import type { ActivityAudience, ActivityKind } from '@/lib/types';

// Run recording, driven from the screen (D79). The fixes themselves arrive in
// recording-task.ts; this starts and stops the stream and keeps the bookkeeping.
//
// Only the "while using" location permission is asked for. On Android the stream
// runs in a foreground service started while the app is on screen, which keeps it
// alive in a pocket without background-location access; on iOS the same permission
// plus the location background mode does it, with the blue status-bar pill.

export type PermissionResult = 'granted' | 'denied' | 'blocked';

export async function ensurePermission(): Promise<PermissionResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Location.requestForegroundPermissionsAsync();
  if (asked.granted) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}

function newClientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function startStream() {
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) return;
  await Location.startLocationUpdatesAsync(RECORDING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    // Closer than this is standing still (the server ignores steps under 3 m anyway).
    distanceInterval: 2,
    timeInterval: 1000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Recording your run',
      notificationBody: 'Shiggy Trails is keeping your time and route. Tap to open it.',
      notificationColor: '#F4511E',
    },
  });
}

async function stopStream() {
  if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(RECORDING_TASK);
  }
}

export async function startRecording(input: {
  kind: ActivityKind;
  runId?: string | null;
  trailId?: string | null;
  runTitle?: string | null;
}) {
  const now = Date.now();
  const active: ActiveRecording = {
    clientId: newClientId(),
    kind: input.kind,
    runId: input.runId ?? null,
    trailId: input.trailId ?? null,
    runTitle: input.runTitle ?? null,
    status: 'RECORDING',
    seg: 0,
    accumulatedMs: 0,
    segmentStartedAt: now,
    startedAt: now,
  };
  startActiveFiles(active);
  try {
    await startStream();
  } catch (err) {
    clearActive();
    throw err;
  }
  return active;
}

export async function pauseRecording() {
  const active = readActive();
  if (!active || active.status !== 'RECORDING') return active;
  // Status first, so a fix already on its way is dropped rather than recorded.
  const paused: ActiveRecording = {
    ...active,
    status: 'PAUSED',
    accumulatedMs: active.accumulatedMs + (active.segmentStartedAt ? Date.now() - active.segmentStartedAt : 0),
    segmentStartedAt: null,
  };
  writeActive(paused);
  await stopStream();
  return paused;
}

export async function resumeRecording() {
  const active = readActive();
  if (!active || active.status !== 'PAUSED') return active;
  const resumed: ActiveRecording = { ...active, status: 'RECORDING', seg: active.seg + 1, segmentStartedAt: Date.now() };
  writeActive(resumed);
  await startStream();
  return resumed;
}

// A recording found on launch whose stream is gone (the app was killed): treat it
// as paused, so the hasher chooses whether to carry on or finish.
export async function reconcileActive() {
  const active = readActive();
  if (!active) return null;
  const streaming = await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK).catch(() => false);
  if (active.status === 'RECORDING' && !streaming) {
    const paused: ActiveRecording = {
      ...active,
      status: 'PAUSED',
      accumulatedMs: active.accumulatedMs + (active.segmentStartedAt ? Math.max(0, Date.now() - active.segmentStartedAt) : 0),
      segmentStartedAt: null,
    };
    writeActive(paused);
    return paused;
  }
  return active;
}

// Time on the clock: finished stretches plus the one running now.
export function elapsedMs(active: ActiveRecording, now = Date.now()) {
  return active.accumulatedMs + (active.status === 'RECORDING' && active.segmentStartedAt ? now - active.segmentStartedAt : 0);
}

export async function stopRecording() {
  const active = (await pauseRecording()) ?? readActive();
  await stopStream();
  return { active, points: readPointsFrom(0).points };
}

export async function discardRecording() {
  await stopStream();
  clearActive();
}

// The recording is finished and named: it becomes a pending upload, and the
// working files go.
export function keepRecording(
  active: ActiveRecording,
  points: ReturnType<typeof readPointsFrom>['points'],
  details: { title: string | null; notes: string | null; audience: ActivityAudience },
) {
  savePending({
    clientId: active.clientId,
    kind: active.kind,
    runId: active.runId,
    trailId: active.trailId,
    title: details.title,
    notes: details.notes,
    audience: details.audience,
    points,
    savedAt: Date.now(),
  });
  clearActive();
}
