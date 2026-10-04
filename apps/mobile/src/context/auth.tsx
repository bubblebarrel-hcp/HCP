import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, clearTokens, getRefreshToken, saveTokens, type Tokens } from '@/lib/api';
import { registerForPush, unregisterForPush } from '@/lib/push';
import type { SessionUser } from '@/lib/types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Re-read who I am, after something about me changed (a username).
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore a stored session; api() silently refreshes an expired access token.
    (async () => {
      try {
        if (await getRefreshToken()) {
          const data = await api<{ user: SessionUser }>('/auth/me');
          setUser(data.user);
          // Tokens rotate when the OS reissues them, so re-register on every
          // start rather than only on the first login.
          void registerForPush();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: SessionUser } & Tokens>('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
    await saveTokens(data);
    setUser(data.user);
    // Deliberately not awaited: a permission prompt must not hold up the app,
    // and push failing is never a reason for a login to fail.
    void registerForPush();
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api<{ user: SessionUser }>('/auth/me');
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    // While the session is still valid: the API needs an authenticated caller
    // to know whose device this is.
    await unregisterForPush();
    const refreshToken = await getRefreshToken();
    await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
