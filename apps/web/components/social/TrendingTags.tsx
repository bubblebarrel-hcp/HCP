'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Hash } from 'lucide-react';
import api from '@/services/api';

// What hashers have been tagging this week (D59), for the right column. Counts
// are of public posts and reels only, so what a followers-only post is about is
// not leaked by a number here. Renders nothing until there is something to show.
export function TrendingTags() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { items: { tag: string; count: number }[] } }>('/tags/trending', { params: { limit: 6 } })
      .then((res) => {
        if (!cancelled) setTags(res.data.data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (tags.length === 0) return null;

  return (
    <section aria-labelledby="rail-trending" data-testid="trending-tags">
      <h2 id="rail-trending" className="px-2 text-[15px] font-semibold text-muted-foreground">
        Trending on trail
      </h2>
      <ul className="mt-1">
        {tags.map(({ tag, count }) => (
          <li key={tag}>
            <Link
              href={`/tags/${encodeURIComponent(tag)}`}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-foreground/5"
              data-testid="trending-tag"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-strong">
                <Hash className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold">#{tag}</span>
                <span className="text-muted-foreground">
                  {count} tagged this week
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
