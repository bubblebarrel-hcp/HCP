'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import api from '@/services/api';

// The realtime socket (D72). One connection per tab, shared by everything that
// listens, opened while at least one component holds it and closed a few
// seconds after the last lets go.
//
// The browser never holds a token, so it cannot hand the API one. It asks the
// same-origin proxy for a ticket (60 seconds, one use) and the proxy adds the
// session. A ticket is fetched again on every reconnect, which is also what
// ends a connection whose session is gone: the server closes each one after
// ten minutes and the next ticket needs a live session.
//
// The socket is receive-only and only ever a faster way of hearing what REST
// would say: every screen keeps a slow poll as a net, and refetches on
// `resync` (fired on every reconnect) to catch whatever it missed while away.

const URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:5010';
const LINGER_MS = 5_000;

type Handler = (payload: unknown) => void;

let socket: Socket | null = null;
let holders = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let connected = false;
let hadConnection = false;

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

// What the server sends. Anything else is ignored.
const EVENTS = ['dm:message', 'dm:message-updated', 'dm:conversation', 'dm:read', 'dm:unread', 'dm:refresh'] as const;

function open() {
  if (socket) return;
  socket = io(URL, {
    // A ticket is single-use, so every (re)connect fetches its own.
    auth: (cb) => {
      api
        .post<{ data: { ticket: string } }>('/me/realtime-ticket')
        .then((res) => cb({ ticket: res.data.data.ticket }))
        .catch(() => cb({ ticket: '' }));
    },
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  });
  socket.on('connect', () => {
    setConnected(true);
    // Everything that happened while we were away: ask again.
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
  hadConnection = false;
  setConnected(false);
}

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

// Keep the socket open for as long as this component is mounted and `on`.
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

// Listen for server events (and `resync`). The latest handler is always the
// one called, so it can read current state without re-subscribing.
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
