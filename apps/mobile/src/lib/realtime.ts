import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { API_URL, api } from '@/lib/api';

// The realtime socket (D72), as the web has it (apps/web/lib/realtime.ts). One
// connection, shared by every screen that listens, open while at least one
// holds it and the app is in the foreground. In the background push does the
// job.
//
// The phone holds its tokens, so it asks `POST /me/realtime-ticket` through the
// ordinary authenticated call (which also refreshes an expired access token) for
// a ticket good for 60 seconds and one connection, and fetches a new one on
// every reconnect. The socket is receive-only and only a faster way of hearing
// what REST would say: screens keep a slow poll and refetch on `resync`.

const URL = new globalThis.URL(API_URL).origin;
const LINGER_MS = 5_000;

type Handler = (payload: unknown) => void;

let socket: Socket | null = null;
let holders = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;
let hadConnection = false;
let foreground = AppState.currentState === 'active';

const listeners = new Map<string, Set<Handler>>();
const stateListeners = new Set<() => void>();

function emitLocal(event: string, payload?: unknown) {
  listeners.get(event)?.forEach((h) => {
    try {
      h(payload);
    } catch {
      // One listener's bug must not silence the rest.
    }
  });
}

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  stateListeners.forEach((l) => l());
}

const EVENTS = ['dm:message', 'dm:message-updated', 'dm:conversation', 'dm:read', 'dm:unread', 'dm:refresh'] as const;

function open() {
  if (socket || !foreground) return;
  socket = io(URL, {
    transports: ['websocket'],
    auth: (cb) => {
      api<{ ticket: string }>('/me/realtime-ticket', { method: 'POST' })
        .then((t) => cb({ ticket: t.ticket }))
        .catch(() => cb({ ticket: '' }));
    },
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  });
  socket.on('connect', () => {
    setConnected(true);
    if (hadConnection) emitLocal('resync');
    hadConnection = true;
  });
  socket.on('disconnect', () => setConnected(false));
  socket.on('connect_error', () => setConnected(false));
  for (const event of EVENTS) socket.on(event, (payload) => emitLocal(event, payload));
}

function close() {
  socket?.close();
  socket = null;
  setConnected(false);
}

// Coming back to the foreground after the socket was dropped: reconnect, and
// the `connect` handler fires `resync` for whatever was missed.
AppState.addEventListener('change', (state) => {
  foreground = state === 'active';
  if (!foreground) close();
  else if (holders > 0) open();
});

function retain() {
  holders++;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  open();
  return () => {
    holders--;
    if (holders === 0) closeTimer = setTimeout(close, LINGER_MS);
  };
}

export const isRealtimeConnected = () => connected;

export function useRealtimeConnection(on: boolean) {
  useEffect(() => {
    if (!on) return;
    return retain();
  }, [on]);
}

export function useRealtimeConnected() {
  return useSyncExternalStore(
    (cb) => {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
    () => connected,
    () => false,
  );
}

export function useRealtimeEvent<T = unknown>(events: string[], handler: (payload: T) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const key = events.join('|');
  useEffect(() => {
    const names = key.split('|');
    const call: Handler = (payload) => ref.current(payload as T);
    for (const name of names) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(call);
    }
    return () => {
      for (const name of names) listeners.get(name)?.delete(call);
    };
  }, [key]);
}
