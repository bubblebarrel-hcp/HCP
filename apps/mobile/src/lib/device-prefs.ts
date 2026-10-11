import { useCallback, useEffect, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { VideoQuality } from '@/lib/video-quality';

// How this phone plays media (web lib/device-prefs.ts). Kept on the device, not
// sent to the API: autoplay and data saving are about the connection in your
// hand. Theme and notifications have their own homes.

export interface DevicePrefs {
  autoplay: boolean;
  startMuted: boolean;
  dataSaver: boolean;
  // Which size of a clip to play (D69).
  quality: VideoQuality;
}

export const DEFAULT_PREFS: DevicePrefs = { autoplay: false, startMuted: true, dataSaver: false, quality: 'auto' };

const KEY = 'hcp.device-prefs';
const listeners = new Set<() => void>();
let current: DevicePrefs = DEFAULT_PREFS;
let loaded = false;
const memory = new Map<string, string>();

const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(memory.get(k) ?? null) : SecureStore.getItemAsync(k)),
  set: async (k: string, v: string) => {
    if (Platform.OS === 'web') memory.set(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
};

function emit() {
  listeners.forEach((listener) => listener());
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await store.get(KEY);
    if (raw) current = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DevicePrefs>) };
  } catch {
    // Unreadable: the defaults stand.
  }
  emit();
}

export function useDevicePrefs(): [DevicePrefs, (patch: Partial<DevicePrefs>) => void] {
  useEffect(() => {
    void load();
  }, []);
  const prefs = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => DEFAULT_PREFS,
  );
  const update = useCallback((patch: Partial<DevicePrefs>) => {
    current = { ...current, ...patch };
    void store.set(KEY, JSON.stringify(current)).catch(() => undefined);
    emit();
  }, []);
  return [prefs, update];
}
