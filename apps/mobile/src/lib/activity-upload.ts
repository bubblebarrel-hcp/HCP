import { ApiError, api } from '@/lib/api';
import { listPending, removePending, type PendingRecording } from '@/lib/recording-store';
import type { RunActivity } from '@/lib/types';

// Sends finished recordings to the API (D79). A recording stays on the phone until
// the API has answered for it, so a run finished in a field with no signal is not
// lost; the same clientId makes a retry that already landed answer with the same
// recording instead of making a second one.

export interface UploadResult {
  uploaded: RunActivity[];
  // Recordings the API refused for good (too short, a run you are not on), with why.
  refused: { clientId: string; message: string }[];
  // Still waiting: no signal, or the API is having a bad moment.
  waiting: number;
}

let inFlight: Promise<UploadResult> | null = null;

// Not worth retrying: the same request would be refused again.
function permanent(err: unknown) {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

async function send(pending: PendingRecording) {
  const { clientId, kind, runId, trailId, title, notes, audience, points } = pending;
  const data = await api<{ activity: RunActivity }>('/me/activities', {
    method: 'POST',
    body: { clientId, kind, runId, trailId, title, notes, audience, points },
  });
  return data.activity;
}

export function flushPending(): Promise<UploadResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const result: UploadResult = { uploaded: [], refused: [], waiting: 0 };
    for (const pending of listPending()) {
      try {
        result.uploaded.push(await send(pending));
        removePending(pending.clientId);
      } catch (err) {
        if (permanent(err)) {
          result.refused.push({ clientId: pending.clientId, message: (err as ApiError).message });
          removePending(pending.clientId);
        } else {
          result.waiting += 1;
        }
      }
    }
    return result;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
