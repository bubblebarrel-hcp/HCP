'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { Page, Reel } from '@/lib/types';
import { brandColor } from '@/lib/utils';
import api from '@/services/api';

// The API's cap on one page of reels (listReelsQuery).
const PAGE_SIZE = 30;

// The list on /reels (D57). Signed out it is the public reels, which is what the
// server rendered. Signed in it is the hashers you follow and your own: the page
// was served from the cache with no session, so it asks again once there is one
// and the server's version stands until that answers.
export function ReelsGrid({
  initial,
  query = '/reels?limit=30',
  emptyText,
}: {
  initial: Reel[];
  // Which list this is. A hashtag page asks for its own (D59).
  query?: string;
  emptyText?: string;
}) {
  const { user } = useAuth();
  const [reels, setReels] = useState(initial);
  // A full first page means there may be more; the API's own total settles it
  // once a page has been asked for.
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(initial.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: Page<Reel> }>(query)
      .then((res) => {
        if (cancelled) return;
        setReels(res.data.data.items);
        setPage(1);
        setMore(res.data.data.items.length < res.data.data.total);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, query]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await api.get<{ data: Page<Reel> }>(`${query}${query.includes('?') ? '&' : '?'}page=${next}`);
      const seen = new Set(reels.map((r) => r.id));
      const fresh = res.data.data.items.filter((r) => !seen.has(r.id));
      setReels((current) => [...current, ...fresh]);
      setPage(next);
      setMore(reels.length + fresh.length < res.data.data.total && res.data.data.items.length > 0);
    } catch {
      // Pressing it again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      {reels.length === 0 ? (
        <p
          className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x"
          data-testid="reels-empty"
        >
          {emptyText ??
            (user
            ? 'Nothing here yet. Follow hashers and their reels land here; post one of your own and it does too.'
            : 'No public reels yet. Sign in and follow hashers to fill this with theirs.')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-0 lg:grid-cols-4" data-testid="reels-grid">
          {reels.map((reel) => (
            <li key={reel.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {reel.items[0]?.kind === 'VIDEO' ? (
                <video
                  // No stored poster (a clip posted before frame grabs): fetch just
                  // enough of the clip to show its first moment, not a black box.
                  src={reel.items[0].posterUrl ? reel.items[0].url : `${reel.items[0].url}#t=0.2`}
                  poster={reel.items[0].posterUrl ?? undefined}
                  controls
                  playsInline
                  preload={reel.items[0].posterUrl ? 'none' : 'metadata'}
                  className="aspect-[3/4] w-full bg-black object-cover"
                />
              ) : reel.items[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reel.items[0].url}
                  alt={reel.caption ?? `Reel by ${reel.author.name}`}
                  loading="lazy"
                  className="aspect-[3/4] w-full bg-black object-cover"
                />
              ) : (
                <span
                  className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground"
                  style={
                    reel.kennel?.primaryColor
                      ? { backgroundColor: brandColor(reel.kennel.primaryColor) ?? undefined }
                      : undefined
                  }
                >
                  <Video className="h-6 w-6" aria-hidden />
                </span>
              )}
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={reel.author.name} size="sm" src={reel.author.avatarUrl} className="h-6 w-6 text-[10px]" />
                  <span className="truncate text-sm font-medium">{reel.author.name}</span>
                </div>
                {reel.itemCount > 1 && (
                  <p className="text-xs text-muted-foreground">{reel.itemCount} in this one</p>
                )}
                {reel.caption && <p className="line-clamp-2 text-sm text-muted-foreground">{reel.caption}</p>}
                {reel.kennel && (
                  <Link
                    href={`/kennels/${reel.kennel.slug}`}
                    className="block truncate text-xs font-medium text-primary-strong hover:underline"
                  >
                    {reel.kennel.shortName}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {more && reels.length > 0 && (
        <div className="mt-4 px-4 text-center sm:px-0">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore} data-testid="reels-more">
            {loadingMore ? 'Loading…' : 'More reels'}
          </Button>
        </div>
      )}
    </>
  );
}
