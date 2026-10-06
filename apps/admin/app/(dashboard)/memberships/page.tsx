'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, type FilterField, type FilterValues } from '@/components/FilterBar';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminList } from '@/hooks/useAdminList';
import type { MembershipRow, ReadinessRow } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// Read-only. A kennel decides who joins it (D3); the platform sees the whole
// picture and whether each kennel still meets the D10 floor.

const FIELDS: FilterField[] = [
  { name: 'q', label: 'Hasher or kennel', type: 'search', placeholder: 'Hash handle or kennel name' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: ['PENDING_REVIEW', 'APPLICANT', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RESIGNED', 'REMOVED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED'],
  },
];

function Readiness() {
  const [rows, setRows] = useState<ReadinessRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyShort, setOnlyShort] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: { items: ReadinessRow[] } }>('/admin/verification-readiness');
      setRows(res.data.data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load kennel readiness'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  const shown = (rows ?? []).filter((k) => !onlyShort || !k.meetsRule);

  return (
    <section aria-labelledby="readiness" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="readiness" className="font-semibold">Kennel verification readiness (D10)</h2>
          <p className="text-sm text-muted-foreground">
            Distinct active mismanagement members held, against the platform minimum.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} data-testid="readiness-only-short" />
          Only kennels below the minimum
        </label>
      </div>
      {error ? (
        <p className="text-destructive" role="alert">{error} <Button variant="link" size="sm" onClick={load}>Try again</Button></p>
      ) : !rows ? (
        <div className="h-12 animate-pulse rounded bg-muted" aria-busy />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="readiness-empty">
          {onlyShort ? 'Every kennel meets the minimum.' : 'No kennels.'}
        </p>
      ) : (
        <ul className="divide-y divide-border" data-testid="readiness-list">
          {shown.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/kennels/${k.id}`} className="font-medium text-primary-strong underline-offset-4 hover:underline">{k.name}</Link>
              <span className="flex items-center gap-3">
                <StatusBadge value={k.status} />
                <span className={cn('tabular-nums', !k.meetsRule && 'font-semibold text-destructive')}>
                  {k.mismanagementCount} / {k.mismanagementNeeded}
                  <span className="sr-only"> mismanagement members{k.meetsRule ? '' : ', below the minimum'}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MembershipsPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<MembershipRow>('/admin/memberships', filters);

  const columns: Column<MembershipRow>[] = [
    { key: 'hasher', header: 'Hasher', cell: (m) => <span className="font-medium">{m.hasher.displayName}</span> },
    {
      key: 'kennel',
      header: 'Kennel',
      cell: (m) => (
        <Link href={`/kennels/${m.kennel.id}`} className="text-primary-strong underline-offset-4 hover:underline">
          {m.kennel.shortName}
        </Link>
      ),
    },
    { key: 'status', header: 'Status', cell: (m) => <StatusBadge value={m.status} /> },
    { key: 'type', header: 'Type', cell: (m) => humanize(m.type) },
    { key: 'home', header: 'Home kennel', cell: (m) => (m.isHomeKennel ? 'Yes' : '—') },
    { key: 'since', header: 'Applied', cell: (m) => formatDate(m.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Memberships" description="Every kennel's members and applications. Decisions stay with each kennel." />
      <Readiness />
      <FilterBar fields={FIELDS} values={filters} onChange={setFilters} testId="memberships-filters" />
      <DataTable
        testId="memberships"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No memberships match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
      />
    </div>
  );
}
