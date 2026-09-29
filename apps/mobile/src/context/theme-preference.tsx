import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform, useColorScheme } from 'react-native';

// Light and dark are both first-class (D24). The hasher's choice is kept on the
// device; "System" follows the phone. Mirrors the web/admin theme control.
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'hcp.theme';

// SecureStore has no web implementation; the Expo web target keeps the choice
// in memory, the same trick lib/api.ts uses for tokens.
const memory = new Map<string, string>();
const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(memory.get(k) ?? null) : SecureStore.getItemAsync(k)),
  set: async (k: string, v: string) => {
    if (Platform.OS === 'web') memory.set(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
};

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

interface ThemePreferenceValue {
  preference: ThemePreference;
  scheme: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setStoredPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    (async () => {
      const stored = await store.get(KEY).catch(() => null);
      if (isPreference(stored)) setStoredPreference(stored);
    })();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStoredPreference(next);
    void store.set(KEY, next).catch(() => undefined);
  }, []);

  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(() => ({ preference, scheme, setPreference }), [preference, scheme, setPreference]);

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside <ThemePreferenceProvider>');
  return ctx;
}
