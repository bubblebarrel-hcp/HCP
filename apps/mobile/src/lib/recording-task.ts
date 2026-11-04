import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendPoints, readActive } from '@/lib/recording-store';

// The background half of run recording (D79). It must be defined in the global
// scope of the bundle (_layout.tsx imports this file first) because the app can be
// started in the background to deliver a fix, with no screen mounted.
//
// It does one thing: write each fix to the recording's file, tagged with the
// stretch of the recording it belongs to. Everything else (totals, the screen,
// the upload) reads the file.
export const RECORDING_TASK = 'hcp-run-recording';

TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const active = readActive();
  // Fixes that arrive after Pause, or after the recording was dropped, are not part of it.
  if (!active || active.status !== 'RECORDING') return;

  const { locations } = data as { locations: LocationObject[] };
  appendPoints(
    locations.map((l) => ({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      ele: l.coords.altitude != null ? Math.round(l.coords.altitude * 10) / 10 : null,
      t: l.timestamp,
      acc: l.coords.accuracy != null ? Math.round(l.coords.accuracy) : null,
      seg: active.seg,
    })),
  );
});
