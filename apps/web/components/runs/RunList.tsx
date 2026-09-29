'use client';

import { useEffect, useState } from 'react';
import { RunCard } from '@/components/runs/RunCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Page, RunSummary } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

type Scope = 'upcoming' | 'past' | 'drafts';

const scopes: { value: Scope; label: string; empty: string }[] = [
  { value: 'upcoming', label: 'Upcoming', empty: 'No upcoming runs you can see yet.' },
  { value: 'past', label: 'Past', empty: 'No past runs yet.' },
  { value: 'drafts', label: 'Drafts', empty: 'No draft runs.' },
];

function fetchRuns(path: string, scope: Scope, pageNum: number) {
  const search = new URLSearchParams({ scope, page: String(pageNum), limit: '20' });
  return api.get<{ data: Page<RunSummary> }>(`${path}?${search}`).then((res) => res.data.data);
}

// Upcoming / past (/ drafts for planners) run lists. Uses the proxy, so a
// signed-in hasher also sees members-only runs of their kennels.
export function RunList({
  path,
  allowDrafts = false,
  showKennel = true,
  onMeta,
}: {
  path: string;
  allowDrafts?: boolean;
  showKennel?: boolean;
  onMeta?: (data: Page<RunSummary>) => void;
}) {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [data, setData] = useState<Page<RunSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchRuns(path, scope, 1)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        onMeta?.(d);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load runs'));
      });
    return () => {
      cancelled = true;
    };
  }, [path, scope, onMeta, reloadKey]);

  async function loadMore() {
    if (!data) return;
    setLoadingMore(true);
    try {
      const next = await fetchRuns(path, scope, data.page + 1);
      setData((prev) => (prev ? { ...next, items: [...prev.items, ...next.items] } : next));
    } catch (err) {
      setError(errorMessage(err, 'Could not load more runs'));
    } finally {
      setLoadingMore(false);
    }
  }

  const visible = scopes.filter((s) => s.value !== 'drafts' || allowDrafts);
  const current = scopes.find((s) => s.value === scope) ?? scopes[0];

  return (
    <>
      <nav
        aria-label="Run lists"
        className="mb-4 flex overflow-x-auto border-y border-border bg-card px-2 sm:rounded-xl sm:border"
      >
        {visible.map((s) => {
          const active = s.value === scope;
          return (
            <button
              key={s.value}
              type="button"
              aria-current={active ? 'page' : undefined}
              data-testid={`runs-tab-${s.value}`}
              onClick={() => {
                if (active) return;
                setScope(s.value);
                setData(null);
                setError(null);
              }}
              className={cn(
                'relative min-h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold',
                active
                  ? 'text-primary-strong after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      {error ? (
        <Card className={cn(bleedCard, 'p-8 text-center')}>
          <p className="font-semibold">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setError(null);
              setData(null);
              setReloadKey((k) => k + 1);
            }}
          >
            Try again
          </Button>
        </Card>
      ) : !data ? (
        <div className="space-y-3" aria-busy>
          <div className="h-24 animate-pulse bg-card sm:rounded-xl" />
          <div className="h-24 animate-pulse bg-card sm:rounded-xl" />
        </div>
      ) : data.items.length === 0 ? (
        <p
          className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x"
          data-testid="runs-empty"
        >
          {current.empty}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="run-list">
          {data.items.map((run) => (
            <li key={run.id}>
              <RunCard run={run} showKennel={showKennel} />
            </li>
          ))}
        </ul>
      )}

      {data && data.items.length < data.total && (
        <div className="mt-4 text-center">
          <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Show more runs'}
          </Button>
        </div>
      )}
    </>
  );
}
