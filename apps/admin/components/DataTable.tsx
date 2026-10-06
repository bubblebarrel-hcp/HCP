'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Render one layout, not both hidden by CSS: a duplicated control would be in the DOM twice.
const WIDE = '(min-width: 768px)';
function useWide() {
  return React.useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  // Under `md` the table becomes a card list: the first column is the card's
  // title, headed columns are its fields, and a column with no header is kept as
  // the row's actions. Set this to leave a column out of the card entirely.
  hideOnCard?: boolean;
}

// One table for every resource: loading skeleton, error with retry, empty
// state, pagination, optional row selection, and a card list on narrow screens.
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyMessage = 'Nothing here yet.',
  page,
  limit,
  total,
  onPageChange,
  onRowClick,
  rowLabel,
  testId = 'data-table',
}: {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  // Opens a detail view. Rows become keyboard-focusable buttons-in-effect.
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  testId?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clickable = Boolean(onRowClick);
  const wide = useWide();
  const [first, ...rest] = columns;

  const state = loading ? (
    <div className="space-y-2 p-4 md:hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  ) : error ? (
    <div className="px-4 py-10 text-center md:hidden">
      <p className="text-destructive" role="alert">{error}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  ) : rows.length === 0 ? (
    <p className="px-4 py-10 text-center text-muted-foreground md:hidden" data-testid={`${testId}-empty-card`}>{emptyMessage}</p>
  ) : null;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Narrow screens: one card per row. */}
      {!wide && state}
      {!wide && !loading && !error && rows.length > 0 && (
        <ul className="divide-y divide-border md:hidden" data-testid={`${testId}-cards`}>
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn('space-y-2 p-4', clickable && 'cursor-pointer hover:bg-muted/40')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="font-medium">{first.cell(row)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {rest
                  .filter((c) => c.header && !c.hideOnCard)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{c.header}</dt>
                      <dd className="truncate">{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
              {/* A column with no header is a row-actions cell: keep it, under the fields. */}
              {rest.filter((c) => !c.header && !c.hideOnCard).map((c) => (
                <div key={c.key} onClick={(e) => e.stopPropagation()}>{c.cell(row)}</div>
              ))}
              {clickable && (
                <button
                  type="button"
                  className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowClick?.(row);
                  }}
                >
                  View details<span className="sr-only"> for {rowLabel?.(row) ?? 'this row'}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* md and up: the table. */}
      {wide && (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid={`${testId}-rows`}>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <div className="h-4 w-full max-w-40 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <p className="text-destructive" role="alert">{error}</p>
                  {onRetry && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                      Try again
                    </Button>
                  )}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground" data-testid={`${testId}-empty`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn('border-b border-border last:border-0 hover:bg-muted/40', clickable && 'cursor-pointer')}
                  data-testid={`${testId}-row`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                      {clickable && i === 0 ? (
                        // The keyboard and screen-reader way in; the row click is the mouse shortcut.
                        <button
                          type="button"
                          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={rowLabel ? `Open ${rowLabel(row)}` : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowClick?.(row);
                          }}
                        >
                          {c.cell(row)}
                        </button>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span data-testid={`${testId}-total`}>{total} total</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
