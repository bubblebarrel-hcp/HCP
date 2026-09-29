import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Mobile holds tokens itself (the web BFF pattern doesn't apply): access and
// refresh tokens live in the OS keychain/keystore via expo-secure-store and go
// out as `Authorization: Bearer`.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5010/api/v1';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3010';

const ACCESS_KEY = 'hcp.access';
const REFRESH_KEY = 'hcp.refresh';

// SecureStore has no web implementation. The Expo web target keeps tokens in
// memory only (lost on reload); real web users use apps/web.
const memory = new Map<string, string>();
const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(memory.get(k) ?? null) : SecureStore.getItemAsync(k)),
  set: async (k: string, v: string) => {
    if (Platform.OS === 'web') memory.set(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
  del: async (k: string) => {
    if (Platform.OS === 'web') memory.delete(k);
    else await SecureStore.deleteItemAsync(k);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(t: Tokens) {
  await store.set(ACCESS_KEY, t.accessToken);
  await store.set(REFRESH_KEY, t.refreshToken);
}

export async function clearTokens() {
  await store.del(ACCESS_KEY);
  await store.del(REFRESH_KEY);
}

export const getRefreshToken = () => store.get(REFRESH_KEY);

// The API rotates the refresh token on every use and treats reuse as theft, so
// concurrent 401s must share one refresh instead of each firing their own.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await store.get(REFRESH_KEY);
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          await clearTokens();
          return false;
        }
        const json = (await res.json()) as { data: Tokens };
        await saveTokens(json.data);
        return true;
      } catch {
        // Offline: keep the tokens, the next attempt may succeed.
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const send = async () => {
    const token = await store.get(ACCESS_KEY);
    return fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  };

  let res = await send();
  // Auth endpoints report their own 401s (e.g. wrong password); never refresh on those.
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (await refreshSession()) res = await send();
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: T; error?: { message?: string; code?: string } }
    | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.message ?? 'Request failed', json?.error?.code ?? 'ERROR');
  }
  return json?.data as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return 'Cannot reach HCP. Check your connection.';
  return fallback;
}
