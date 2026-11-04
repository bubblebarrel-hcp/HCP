import { Directory, File, Paths } from 'expo-file-system';

import type { TrackPoint } from '@/lib/activity-math';
import type { ActivityAudience, ActivityKind } from '@/lib/types';

// Where a recording lives on the phone (D79).
//
// A run is often out of signal and the app is often in a pocket, so nothing about
// a recording depends on the API or on a screen being open: the location task
// (recording-task.ts) appends each fix to a file as it arrives; Finish turns the
// file into a pending upload; and the upload waits on the phone until the API has
// answered. A recording is only deleted from here once it has been accepted.
//
// Three kinds of file in <documents>/recordings:
//   active.json           what is being recorded now (at most one)
//   active-points.ndjson  its fixes, one JSON object per line, appended
//   pending-<id>.json     a finished recording waiting to upload

export interface ActiveRecording {
  clientId: string;
  kind: ActivityKind;
  runId: string | null;
  trailId: string | null;
  // Shown on the recording screen; the API never needs it.
  runTitle: string | null;
  status: 'RECORDING' | 'PAUSED';
  // Bumped on every resume, so the way from where the hasher stopped to where they
  // restarted is not counted as running.
  seg: number;
  // Time spent recording in finished stretches, and when the current one began.
  accumulatedMs: number;
  segmentStartedAt: number | null;
  startedAt: number;
}

export interface PendingRecording {
  clientId: string;
  kind: ActivityKind;
  runId: string | null;
  trailId: string | null;
  title: string | null;
  notes: string | null;
  audience: ActivityAudience;
  points: TrackPoint[];
  savedAt: number;
}

// Beyond this the request would not fit the API's body limit; every nth fix is kept.
const MAX_UPLOAD_POINTS = 15000;

function root() {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

const activeFile = () => new File(root(), 'active.json');
const pointsFile = () => new File(root(), 'active-points.ndjson');
const pendingFile = (id: string) => new File(root(), `pending-${id}.json`);

// ─── The recording in progress ───

export function readActive(): ActiveRecording | null {
  const file = activeFile();
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as ActiveRecording;
  } catch {
    return null;
  }
}

export function writeActive(active: ActiveRecording) {
  const file = activeFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(active));
}

export function startActiveFiles(active: ActiveRecording) {
  const points = pointsFile();
  if (points.exists) points.delete();
  points.create({ intermediates: true });
  writeActive(active);
}

export function clearActive() {
  for (const file of [activeFile(), pointsFile()]) if (file.exists) file.delete();
}

export function appendPoints(points: TrackPoint[]) {
  if (points.length === 0) return;
  const file = pointsFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(points.map((p) => JSON.stringify(p)).join('\n') + '\n', { append: true });
}

// Everything past `offset` (a position in the file's text), and where to read from
// next time. Only whole lines are returned, so a fix still being written is picked
// up on the next read instead of half-parsed.
export function readPointsFrom(offset: number): { points: TrackPoint[]; next: number } {
  const file = pointsFile();
  if (!file.exists) return { points: [], next: 0 };
  const text = file.textSync();
  if (text.length <= offset) return { points: [], next: offset };
  const end = text.lastIndexOf('\n') + 1;
  if (end <= offset) return { points: [], next: offset };
  const points: TrackPoint[] = [];
  for (const line of text.slice(offset, end).split('\n')) {
    if (!line) continue;
    try {
      points.push(JSON.parse(line) as TrackPoint);
    } catch {
      // A torn line from a killed app is one fix lost, not a recording lost.
    }
  }
  return { points, next: end };
}

// ─── Waiting to upload ───

export function savePending(pending: PendingRecording) {
  const stride = Math.ceil(pending.points.length / MAX_UPLOAD_POINTS);
  const points = stride > 1 ? pending.points.filter((_, i) => i % stride === 0) : pending.points;
  const file = pendingFile(pending.clientId);
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify({ ...pending, points }));
}

export function listPending(): PendingRecording[] {
  const out: PendingRecording[] = [];
  for (const item of root().list()) {
    if (!(item instanceof File) || !item.name.startsWith('pending-')) continue;
    try {
      out.push(JSON.parse(item.textSync()) as PendingRecording);
    } catch {
      item.delete();
    }
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

export function removePending(clientId: string) {
  const file = pendingFile(clientId);
  if (file.exists) file.delete();
}
