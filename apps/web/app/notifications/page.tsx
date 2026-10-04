'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { NOTIFICATIONS_CHANGED, notificationCategoryLabel, notificationHref, notificationTone } from '@/lib/notifications';
import type { NotificationItem, NotificationPage } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

const LIMIT = 20;

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const fetchPage = useCallback(
    (nextPage: number) =>
      api
        .get<{ data: NotificationPage }>(`/me/notifications?limit=${LIMIT}&page=${nextPage}${unreadOnly ? '&unread=true' : ''}`)
        .then((res) => res.data.data),
    [unreadOnly],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchPage(1)
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setItems(data.items);
        setTotal(data.total);
        setUnread(data.unread);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your notifications'));
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      setItems((prev) => [...(prev ?? []), ...data.items]);
      setTotal(data.total);
      setUnread(data.unread);
      setPage(page + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)) ?? prev);
      setUnread((u) => Math.max(0, u - 1));
      api
        .post(`/me/notifications/${item.id}/read`)
        .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
        .catch(() => undefined);
    }
    const href = notificationHref(item);
    if (href) router.push(href);
  }

  async function markAllRead() {
    setItems((prev) => prev?.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })) ?? prev);
    setUnread(0);
    try {
      await api.post('/me/notifications/read-all');
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setPage(1);
      fetchPage(1).then((data) => {
        setItems(data.items);
        setUnread(data.unread);
      });
    }
  }

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (!user) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  return shell(
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className={cn(bleedCard, 'p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-muted-foreground">Likes, comments, follows, runs and everything else for you.</p>
          </div>
          <Link
            href="/settings/notifications"
            aria-label="Notification settings"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={unreadOnly ? 'outline' : 'default'}
            onClick={() => {
              setItems(null);
              setUnreadOnly(false);
            }}
            data-testid="notifications-filter-all"
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={unreadOnly ? 'default' : 'outline'}
            onClick={() => {
              setItems(null);
              setUnreadOnly(true);
            }}
            data-testid="notifications-filter-unread"
          >
            Unread{unread > 0 ? ` (${unread})` : ''}
          </Button>
          {unread > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => void markAllRead()}
              data-testid="notifications-read-all"
            >
              Mark all read
            </Button>
          )}
        </div>
      </Card>

      <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="notifications-list">
        {error ? (
          <p className="p-8 text-center text-sm text-destructive">{error}</p>
        ) : items === null ? (
          <div className="space-y-2 p-3" aria-busy>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground" data-testid="notifications-empty">
            {unreadOnly ? 'You are all caught up. On On!' : 'Nothing yet. Likes, comments, follows and run news land here.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="notification-row"
                  onClick={() => void open(item)}
                  className={cn(
                    'flex w-full gap-3 p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !item.readAt && 'bg-primary/5',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-primary')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {item.priority === 'CRITICAL' && <Badge className={notificationTone(item.priority)}>Safety</Badge>}
                    </span>
                    <span className="block text-sm text-muted-foreground">{item.body}</span>
                    <span className="block text-xs text-muted-foreground">
                      {notificationCategoryLabel[item.category]} · {timeAgo(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {items && items.length < total && (
          <div className="border-t border-border p-3 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              data-testid="notifications-load-more"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </Card>
    </div>,
  );
}
