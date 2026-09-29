'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/card';
import { notificationCategoryLabel, notificationHref, notificationTone } from '@/lib/notifications';
import type { NotificationItem, NotificationPage } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

const POLL_MS = 60_000;

function fetchUnread() {
  return api.get<{ data: { unread: number } }>('/me/notifications/unread-count').then((res) => res.data.data.unread);
}

function fetchRecent() {
  return api.get<{ data: NotificationPage }>('/me/notifications?limit=10').then((res) => res.data.data);
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Polling keeps the count honest without a socket. In-app notifications are
  // pulled, not pushed (D26).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = () => {
      fetchUnread()
        .then((count) => {
          if (!cancelled) setUnread(count);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const load = useCallback(async () => {
    try {
      const data = await fetchRecent();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      setItems([]);
    }
  }, []);

  if (!user) return null;

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? prev);
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/me/notifications/${item.id}/read`);
    } catch {
      void load();
    }
  }

  async function markAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    try {
      await api.post('/me/notifications/read-all');
    } catch {
      void load();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => void openPanel()}
        data-testid="notification-bell"
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
            data-testid="notification-count"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg"
          data-testid="notification-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border p-3">
            <p className="font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm font-medium text-primary-strong hover:bg-muted"
                  onClick={() => void markAllRead()}
                  data-testid="notification-read-all"
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/settings/notifications"
                onClick={() => setOpen(false)}
                aria-label="Notification settings"
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items === null ? (
              <div className="space-y-2 p-3" aria-busy>
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing yet. Membership decisions, run changes and trail releases land here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const href = notificationHref(item);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-testid="notification-item"
                        onClick={() => {
                          void markRead(item);
                          if (href) {
                            setOpen(false);
                            router.push(href);
                          }
                        }}
                        className={cn(
                          'flex w-full gap-3 p-3 text-left hover:bg-muted',
                          !item.readAt && 'bg-primary/5',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            item.readAt ? 'bg-transparent' : 'bg-primary',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            {item.priority === 'CRITICAL' && (
                              <Badge className={notificationTone(item.priority)}>Safety</Badge>
                            )}
                          </span>
                          <span className="block text-sm text-muted-foreground">{item.body}</span>
                          <span className="block text-xs text-muted-foreground">
                            {notificationCategoryLabel[item.category]} · {formatDate(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
