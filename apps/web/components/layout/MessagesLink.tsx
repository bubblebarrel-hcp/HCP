'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { MESSAGES_CHANGED, unreadCounts } from '@/lib/messages';
import { isRealtimeConnected, useRealtimeConnection, useRealtimeEvent } from '@/lib/realtime';

const POLL_MS = 30_000;

// The inbox link in the top bar, with how many conversations are waiting on
// the hasher: unread ones plus message requests (D71). Pulled, not pushed, like
// the notification bell.
export function MessagesLink() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  // The header is on every page, so this is what keeps the socket open (D72).
  useRealtimeConnection(Boolean(user));
  useRealtimeEvent(['dm:unread'], (c: { unread: number; requests: number }) => setCount(c.unread + c.requests));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let tick = 0;
    const refresh = () => {
      unreadCounts()
        .then((c) => {
          if (!cancelled) setCount(c.unread + c.requests);
        })
        .catch(() => undefined);
    };
    refresh();
    // The socket pushes the count; the poll is the net, slower while it is up.
    const timer = setInterval(() => {
      if (!isRealtimeConnected() || ++tick % 4 === 0) refresh();
    }, POLL_MS);
    window.addEventListener(MESSAGES_CHANGED, refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(MESSAGES_CHANGED, refresh);
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      href="/messages"
      aria-label={count > 0 ? `Messages, ${count} waiting` : 'Messages'}
      data-testid="messages-link"
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
          data-testid="messages-count"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
