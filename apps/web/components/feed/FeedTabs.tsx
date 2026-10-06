'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { FeedCard } from '@/components/feed/FeedCard';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import type { FeedEntry, FeedPage } from '@/lib/types';

type Scope = 'ALL' | 'FOLLOWING';
import { cn } from '@/lib/utils';

// Two feeds (D50): everything the platform has, and the narrower one made of
// the hashers and kennels this reader chose to follow.
//
// "Everything" is already on the page, server-rendered without JavaScript, so
// this only fetches when the reader switches. Signed out there is nothing to
// switch to and the tabs are not rendered at all.

export function FeedTabs({ initial, hasMore }: { initial: FeedEntry[]; hasMore: boolean }) {
  const { user, loading } = useAuth();
  const [scope, setScope] = useState<'ALL' | 'FOLLOWING'>('ALL');
  const [following, setFollowing] = useState<FeedEntry[] | null>(null);
  // Null until something asks for a fresh copy. The server-rendered list stands
  // until then, which is what makes the home page work without JavaScript.
  const [everything, setEverything] = useState<FeedEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Pages after the first, per scope, and whether the API has more to give. A
  // fresh first page replaces all of it, so a refresh never leaves a seam.
  const [extra, setExtra] = useState<Record<Scope, FeedEntry[]>>({ ALL: [], FOLLOWING: [] });
  const [nextPage, setNextPage] = useState<Record<Scope, number>>({ ALL: 2, FOLLOWING: 2 });
  const [more, setMore] = useState<Record<Scope, boolean>>({ ALL: hasMore, FOLLOWING: false });
  const [loadingMore, setLoadingMore] = useState(false);

  const applyFirstPage = useCallback((which: Scope, data: FeedPage) => {
    if (which === 'FOLLOWING') setFollowing(data.items);
    else setEverything(data.items);
    setExtra((current) => ({ ...current, [which]: [] }));
    setNextPage((current) => ({ ...current, [which]: 2 }));
    setMore((current) => ({ ...current, [which]: data.hasMore }));
  }, []);

  const load = useCallback(async (which: 'ALL' | 'FOLLOWING') => {
    setBusy(true);
    try {
      const res = await api.get<{ data: FeedPage }>(`/feed?limit=12&scope=${which}`);
      applyFirstPage(which, res.data.data);
    } catch {
      if (which === 'FOLLOWING') setFollowing([]);
    } finally {
      setBusy(false);
    }
  }, [applyFirstPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    if (scope === 'FOLLOWING' && following === null) void load('FOLLOWING');
  }, [scope, following, load]);

  // The page is cached and anonymous, so what it rendered is the public view.
  // A member can see more (their kennels' members-only runs and reports), so
  // once there is a session the feed is asked for again as them, exactly as the
  // reels rail does. The server-rendered list stands until that answers, and a
  // failed ask leaves it in place.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .get<{ data: FeedPage }>('/feed?limit=12&scope=ALL')
      .then((res) => {
        if (!cancelled) applyFirstPage('ALL', res.data.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, applyFirstPage]);

  // Posting and pull-to-refresh both raise this. The page is cached for a
  // minute (D42) and the API's own eviction rides the outbox on a five-second
  // tick, so without this the hasher who just posted comes back to a feed that
  // does not have their post in it.
  useEffect(() => {
    const onRefresh = () => void load(scope);
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh);
  }, [scope, load]);

  const first = scope === 'ALL' ? (everything ?? initial) : (following ?? []);
  // A page boundary can shift while the reader scrolls (something new is posted),
  // so an entry that arrives twice is shown once.
  const seen = new Set(first.map((e) => `${e.kind}-${e.id}`));
  const items = [...first, ...extra[scope].filter((e) => !seen.has(`${e.kind}-${e.id}`))];

  async function loadMore() {
    const which = scope;
    setLoadingMore(true);
    try {
      const res = await api.get<{ data: FeedPage }>(`/feed?limit=12&scope=${which}&page=${nextPage[which]}`);
      setExtra((current) => ({ ...current, [which]: [...current[which], ...res.data.data.items] }));
      setNextPage((current) => ({ ...current, [which]: current[which] + 1 }));
      setMore((current) => ({ ...current, [which]: res.data.data.hasMore }));
    } catch {
      // Pressing it again retries.
    } finally {
      setLoadingMore(false);
    }
  }
  const tabClass = (active: boolean) =>
    cn(
      'flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
      active ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="space-y-4">
      {user && !loading && (
        <div className="flex rounded-none border-y border-border bg-card sm:rounded-xl sm:border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'ALL'}
            onClick={() => setScope('ALL')}
            className={tabClass(scope === 'ALL')}
            data-testid="feed-tab-all"
          >
            Everything
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'FOLLOWING'}
            onClick={() => setScope('FOLLOWING')}
            className={tabClass(scope === 'FOLLOWING')}
            data-testid="feed-tab-following"
          >
            Following
          </button>
        </div>
      )}

      {busy && items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-0">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : items.length === 0 ? (
        <div className="border-y border-dashed border-border bg-card p-10 text-center sm:rounded-xl sm:border-x">
          {scope === 'FOLLOWING' ? (
            <>
              <p className="font-medium">Nothing from the hashers you follow yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow a few hashers and kennels and this fills up.{' '}
                <Link href="/kennels" className="text-primary-strong hover:underline">
                  Find a kennel
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Nothing has been posted yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Trail reports and photos from every kennel land here.{' '}
                <Link href="/kennels" className="text-primary-strong hover:underline">
                  Find a kennel
                </Link>{' '}
                to hash with, and it starts filling up.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4" data-testid="home-feed">
          {items.map((item) => (
            <FeedCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {more[scope] && items.length > 0 && (
        <div className="px-4 pb-2 text-center sm:px-0">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore} data-testid="feed-more">
            {loadingMore ? 'Loading…' : 'More from the hash'}
          </Button>
        </div>
      )}
    </div>
  );
}
