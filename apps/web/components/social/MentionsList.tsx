'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import type { MentionItem, Page } from '@/lib/types';
import { cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Everywhere somebody has mentioned you (D60), as far as you can still open it.
// A notification can be missed or muted; this stays, and it only ever holds what
// you could read anyway.

const WHERE: Record<MentionItem['in'], string> = {
  POST: 'in a post',
  REEL: 'in a reel',
  COMMENT: 'in a comment',
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function MentionsList() {
  const [items, setItems] = useState<MentionItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ data: Page<MentionItem> }>('/me/mentions', { params: { limit: 20, page: 1 } })
      .then((res) => {
        if (!alive) return;
        setItems(res.data.data.items);
        setTotal(res.data.data.total);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Could not load your mentions')));
    return () => {
      alive = false;
    };
  }, []);

  async function more() {
    setLoadingMore(true);
    try {
      const res = await api.get<{ data: Page<MentionItem> }>('/me/mentions', { params: { limit: 20, page: page + 1 } });
      setItems((current) => [...(current ?? []), ...res.data.data.items]);
      setPage(page + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  }

  if (error) return <p className="p-8 text-center text-sm text-destructive">{error}</p>;
  if (items === null) return <div className="h-40 animate-pulse bg-muted" aria-busy />;
  if (items.length === 0) {
    return (
      <p className="p-10 text-center text-sm text-muted-foreground" data-testid="mentions-empty">
        Nobody has mentioned you yet. When they do, it is kept here.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y divide-border" data-testid="mentions-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/${item.segment}/${item.targetId}`}
              className={cn('flex gap-3 p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
              data-testid="mention-row"
            >
              <Avatar name={item.by.name} size="sm" src={item.by.avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.by.name}</span>{' '}
                <span className="text-muted-foreground">mentioned you {WHERE[item.in]}</span>
                <span className="block text-sm text-muted-foreground">{item.excerpt}</span>
                <span className="block text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className="border-t border-border p-3 text-center">
          <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void more()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
}
