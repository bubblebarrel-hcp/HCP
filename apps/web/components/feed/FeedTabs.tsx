'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { FeedCard } from '@/components/feed/FeedCard';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import type { FeedEntry, FeedPage } from '@/lib/types';
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

  const load = useCallback(async (which: 'ALL' | 'FOLLOWING') => {
    setBusy(true);
    try {
      const res = await api.get<{ data: FeedPage }>(`/feed?limit=12&scope=${which}`);
      if (which === 'FOLLOWING') setFollowing(res.data.data.items);
      else setEverything(res.data.data.items);
    } catch {
      if (which === 'FOLLOWING') setFollowing([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (scope === 'FOLLOWING' && following === null) void load('FOLLOWING');
  }, [scope, following, load]);

  // Posting and pull-to-refresh both raise this. The page is cached for a
  // minute (D42) and the API's own eviction rides the outbox on a five-second
  // tick, so without this the hasher who just posted comes back to a feed that
  // does not have their post in it.
  useEffect(() => {
    const onRefresh = () => void load(scope);
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh);
  }, [scope, load]);

  const items = scope === 'ALL' ? (everything ?? initial) : (following ?? []);
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

      {scope === 'ALL' && hasMore && items.length > 0 && (
        <p className="px-4 pb-2 text-center text-sm text-muted-foreground sm:px-0">More as the hash keeps running.</p>
      )}
    </div>
  );
}
