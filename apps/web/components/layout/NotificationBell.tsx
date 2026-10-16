'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/card';
import {
  NOTIFICATIONS_CHANGED,
  matchesTab,
  type NotificationTab,
  notificationCategoryLabel,
  notificationHref,
  notificationTabs,
  notificationTone,
} from '@/lib/notifications';
import type { NotificationItem, NotificationPage } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

const POLL_MS = 60_000;

function fetchUnread() {
  return api.get<{ data: { unread: number } }>('/me/notifications/unread-count').then((res) => res.data.data.unread);
}

function fetchRecent(tab: NotificationTab) {
  const def = notificationTabs.find((t) => t.id === tab);
  const params: Record<string, string | number | boolean> = { limit: 15 };
  if (tab === 'inbox') params.unread = true;
  if (def?.categories) params.categories = def.categories.join(',');
  return api.get<{ data: NotificationPage }>('/me/notifications', { params }).then((res) => res.data.data);
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [tab, setTab] = useState<NotificationTab>('inbox');
  const [byCategory, setByCategory] = useState<NotificationPage['unreadByCategory']>({});
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
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
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

  const load = useCallback(async (which: NotificationTab) => {
    try {
      const data = await fetchRecent(which);
      setItems(data.items.filter((i) => matchesTab(i, which)));
      setUnread(data.unread);
      setByCategory(data.unreadByCategory ?? {});
    } catch {
      setItems([]);
    }
  }, []);

  if (!user) return null;

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) await load(tab);
  }

  function chooseTab(next: NotificationTab) {
    if (next === tab) return;
    setTab(next);
    setItems(null);
    void load(next);
  }

  // What is waiting on a tab: the whole inbox, or its categories' share of it.
  function tabCount(id: NotificationTab) {
    if (id === 'inbox') return unread;
    if (id === 'all') return 0;
    const cats = notificationTabs.find((t) => t.id === id)?.categories ?? [];
    return cats.reduce((n, c) => n + (byCategory[c] ?? 0), 0);
  }

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? prev);
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/me/notifications/${item.id}/read`);
    } catch {
      void load(tab);
    }
  }

  async function markAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    try {
      await api.post('/me/notifications/read-all');
    } catch {
      void load(tab);
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
          className="fixed inset-x-4 top-16 z-50 rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[26rem] border border-border bg-card shadow-lg"
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

          <div role="tablist" aria-label="Notification groups" className="flex gap-0.5 overflow-x-auto border-b border-border px-2 py-2">
            {notificationTabs.map((t) => {
              const count = tabCount(t.id);
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`notification-tab-${t.id}`}
                  onClick={() => chooseTab(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium',
                    active ? 'border-border bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t.label}
                  {count > 0 && (
                    <span className="rounded-md border border-border bg-card px-1.5 text-xs" data-testid={`notification-tab-count-${t.id}`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items === null ? (
              <div className="space-y-2 p-3" aria-busy>
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {tab === 'inbox'
                  ? 'You are all caught up. Use the other tabs, or All, to look back.'
                  : 'Nothing here yet. Likes, comments, follows, run changes and trail releases land here.'}
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

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            data-testid="notification-see-all"
            className="block border-t border-border p-3 text-center text-sm font-medium text-primary-strong hover:bg-muted"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
