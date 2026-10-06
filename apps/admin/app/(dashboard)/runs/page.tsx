'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, type FilterField, type FilterValues } from '@/components/FilterBar';
import { PageHeader } from '@/components/PageHeader';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminList } from '@/hooks/useAdminList';
import type { RunRow } from '@/lib/types';
import { humanize } from '@/lib/utils';

// Read-only, and trail secrecy holds here too: the API never returns the route,
// waypoints, beer checks or chalk, so there is nothing to leak from this page.

const FIELDS: FilterField[] = [
  { name: 'q', label: 'Run or kennel', type: 'search', placeholder: 'Title or kennel name' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: ['DRAFT', 'SCHEDULED', 'PLANNING', 'TRAIL_HIDDEN', 'TRAIL_RELEASED', 'CHECK_IN_OPEN', 'LIVE', 'CIRCLE', 'REPORTING', 'ARCHIVED', 'CANCELLED'],
  },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function RunsPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<RunRow>('/admin/runs', {
    ...filters,
    from: filters.from ? `${filters.from}T00:00:00.000` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999` : undefined,
  });
  const [open, setOpen] = useState<RunRow | null>(null);

  const columns: Column<RunRow>[] = [
    {
      key: 'run',
      header: 'Run',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted-foreground">{r.kennel.shortName} · #{r.runNumber}</p>
        </div>
      ),
    },
    { key: 'when', header: 'Starts', cell: (r) => <span className="whitespace-nowrap">{when(r.startsAt)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
    { key: 'visibility', header: 'Visibility', cell: (r) => humanize(r.visibility) },
    { key: 'report', header: 'Report', cell: (r) => (r.reportStatus ? <StatusBadge value={r.reportStatus} /> : <span className="text-muted-foreground">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Runs" description="Every kennel's runs and the state of their trail report and capsule." />
      <FilterBar fields={FIELDS} values={filters} onChange={setFilters} testId="runs-filters" />
      <DataTable
        testId="runs"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No runs match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
        onRowClick={setOpen}
        rowLabel={(r) => r.title}
      />
      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open?.title ?? ''} description={open ? `${open.kennel.shortName} · run #${open.runNumber}` : undefined}>
        {open && (
          <dl className="grid grid-cols-2 gap-3 text-sm" data-testid="run-detail">
            {[
              ['Status', <StatusBadge key="s" value={open.status} />],
              ['Type', humanize(open.runType)],
              ['Starts', when(open.startsAt)],
              ['Where', `${open.city}, ${open.country}`],
              ['Visibility', humanize(open.visibility)],
              ['Hares', String(open.hareCount)],
              ['Attendees', String(open.attendeeCount)],
              ['Trail', open.trailReleased ? 'Released' : 'Hidden'],
              ['Trail report', open.reportStatus ? <StatusBadge key="r" value={open.reportStatus} /> : 'None'],
              ['Capsule', open.capsuleStatus ? <StatusBadge key="c" value={open.capsuleStatus} /> : 'None'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {open.cancelReason && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Cancelled because</dt>
                <dd>{open.cancelReason}</dd>
              </div>
            )}
            <div className="col-span-2">
              <Link href={`/kennels/${open.kennel.id}`} className="text-primary-strong underline-offset-4 hover:underline">
                Open {open.kennel.shortName}
              </Link>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
