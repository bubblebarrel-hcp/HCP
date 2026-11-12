import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { elapsedMs } from '@/lib/recorder';
import { readActive, type ActiveRecording } from '@/lib/recording-store';

// The recording in progress, if any, and how long it has run. Read from the file
// the location task writes (recording-store.ts), so it is right after the app was
// in the background. It re-reads when the screen comes back into focus (a recording
// started or finished on the record screen), and ticks once a second only while
// one is being recorded.
export function useActiveRecording() {
  const [active, setActive] = useState<ActiveRecording | null>(() => readActive());
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setActive(readActive());
      setNow(Date.now());
    }, []),
  );

  const ticking = active?.status === 'RECORDING';
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setNow(Date.now());
      // Finished or discarded elsewhere: the file is gone, so stop showing it.
      setActive((prev) => {
        const fresh = readActive();
        return fresh?.clientId === prev?.clientId && fresh?.status === prev?.status ? prev : fresh;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ticking]);

  return { active, elapsedMs: active ? elapsedMs(active, now) : 0 };
}
