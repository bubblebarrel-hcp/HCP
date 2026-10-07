'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler } from '@/services/api';
import type { SessionUser } from '@/lib/types';

export interface RegisterPayload {
  email: string;
  password: string;
  acceptTerms: boolean;
  // Which version of the Terms and Privacy Policy was read (lib/legal.ts).
  termsVersion?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  hashHandle?: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  nationality: string;
  country: string;
  stateProvince: string;
  city: string;
  addressLine?: string;
  occupation?: string;
  languages: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  // D31: registering creates an account, not a session.
  register: (payload: RegisterPayload) => Promise<{ verificationRequired: boolean; emailSentTo: string }>;
  logout: () => Promise<void>;
  // For a field on the session user that changed via a call this context did
  // not make (e.g. FR-MEMBER-007's home kennel), rather than duplicating /me.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Auth state is "who am I", never "what is my token". Tokens live in httpOnly
// cookies behind /api/proxy and are invisible to this code.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const json = (await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json())) as {
      data?: { user: SessionUser | null };
    };
    setUser(json.data?.user ?? null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ data: { user: SessionUser } }>('/auth/login', { email, password });
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    // No tokens come back and no session exists until the address is confirmed
    // (D31), so there is deliberately no user to set here. Setting one would
    // make the app look signed in until the next reload proved otherwise.
    const res = await api.post<{ data: { verificationRequired: boolean; emailSentTo: string } }>(
      '/auth/register',
      payload,
    );
    return res.data.data;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
