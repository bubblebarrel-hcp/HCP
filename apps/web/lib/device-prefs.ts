'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { VideoQuality } from '@/lib/video-quality';

// How this browser plays media. Per device on purpose: autoplay and data saving
// are about the connection in your hand, not about who you are, so they are not
// sent to the API and a phone and a laptop can disagree. Theme lives in
// next-themes and notifications on the server; this is the rest.

export interface DevicePrefs {
  // Clips in the feed start (silently) as they scroll into view.
  autoplay: boolean;
  // Clips start muted and stay that way until the viewer unmutes one.
  startMuted: boolean;
  // Do not fetch video until it is asked for, and no autoplay.
  dataSaver: boolean;
  // Which size of a clip to play (D69). Auto follows the connection.
  quality: VideoQuality;
}

export const DEFAULT_PREFS: DevicePrefs = { autoplay: true, startMuted: true, dataSaver: false, quality: 'auto' };

const KEY = 'hcp.device-prefs';
const listeners = new Set<() => void>();
let cache: DevicePrefs | null = null;

function read(): DevicePrefs {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<DevicePrefs>) : {}) };
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function setDevicePrefs(patch: Partial<DevicePrefs>) {
  cache = { ...read(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private window or blocked storage: the choice holds until the tab closes.
  }
  listeners.forEach((listener) => listener());
}

export function useDevicePrefs(): [DevicePrefs, (patch: Partial<DevicePrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
  const update = useCallback((patch: Partial<DevicePrefs>) => setDevicePrefs(patch), []);
  return [prefs, update];
}
