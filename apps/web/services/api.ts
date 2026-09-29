'use client';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/proxy', withCredentials: true });

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

api.interceptors.response.use(
  r => r,
  err => {
    // The proxy already attempted a silent refresh server-side before returning
    // a 401, so a session-ending sign-out is the correct next step here.
    if (err.response?.status === 401) onUnauthorized?.();
    return Promise.reject(err);
  },
);

// The API's error envelope is { success: false, error: { message, code } }.
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (message) return message;
  }
  return fallback;
}

export default api;

// The envelope's machine-readable code, for the few places that branch on it
// rather than just showing the message (e.g. EMAIL_NOT_VERIFIED at login).
export function errorCode(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code ?? null;
  }
  return null;
}
