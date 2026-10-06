'use client';

import { useEffect, useState } from 'react';
import api from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, type FilterField, type FilterValues } from '@/components/FilterBar';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Drawer } from '@/components/ui/drawer';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminList } from '@/hooks/useAdminList';
import type { AuditEntry, DomainEventRow, EventsHealth } from '@/lib/types';
import { cn } from '@/lib/utils';

// Both logs are append-only: this page reads them and never edits one.

const AUDIT_FIELDS: FilterField[] = [
  { name: 'q', label: 'Action', type: 'search', placeholder: 'e.g. user.status' },
  { name: 'resourceType', label: 'Resource', type: 'select', options: ['Identity', 'Kennel', 'Post', 'Reel', 'PlatformSetting', 'Membership', 'Run'] },
  { name: 'decision', label: 'Decision', type: 'select', options: ['ALLOWED', 'DENIED'] },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const EVENT_FIELDS: FilterField[] = [
  { name: 'q', label: 'Event type', type: 'search', placeholder: 'e.g. PostRemoved' },
  { name: 'aggregateType', label: 'Aggregate', type: 'select', options: ['Kennel', 'Run', 'Post', 'Reel', 'Membership', 'TrailReport', 'RunCapsule'] },
  {
    name: 'published',
    label: 'Outbox',
    type: 'select',
    options: [{ value: 'true', label: 'Published' }, { value: 'false', label: 'Unpublished' }],
  },
  { name: 'from', label: 'From', type: 'date' },
  { name: 'to', label: 'To', type: 'date' },
];

const stamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// "to" is a calendar day: include all of it.
const endOfDay = (day?: string) => (day ? `${day}T23:59:59.999` : undefined);
const startOfDay = (day?: string) => (day ? `${day}T00:00:00.000` : undefined);
const dateRange = (f: FilterValues) => ({ from: startOfDay(f.from), to: endOfDay(f.to) });

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children || '—'}</dd>
    </div>
  );
}

function AuditPane() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<AuditEntry>('/admin/audit', { ...filters, ...dateRange(filters) });
  const [open, setOpen] = useState<AuditEntry | null>(null);

  const columns: Column<AuditEntry>[] = [
    { key: 'when', header: 'When', cell: (e) => <span className="whitespace-nowrap">{stamp(e.createdAt)}</span> },
    { key: 'action', header: 'Action', cell: (e) => <span className="font-mono text-xs">{e.action}</span> },
    { key: 'actor', header: 'Actor', cell: (e) => e.actorName ?? (e.actorType === 'SYSTEM' ? 'System' : '—') },
    { key: 'resource', header: 'Resource', cell: (e) => e.resourceType },
    { key: 'decision', header: 'Decision', cell: (e) => <StatusBadge value={e.decision} /> },
  ];

  return (
    <div className="space-y-4">
      <FilterBar fields={AUDIT_FIELDS} values={filters} onChange={setFilters} testId="audit-filters" />
      <DataTable
        testId="audit"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No audit entries match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
        onRowClick={setOpen}
        rowLabel={(e) => e.action}
      />
      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open?.action ?? ''} description="Audit entry">
        {open && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="When">{stamp(open.createdAt)}</Field>
              <Field label="Decision"><StatusBadge value={open.decision} /></Field>
              <Field label="Actor">{open.actorName ?? (open.actorType === 'SYSTEM' ? 'System' : null)}</Field>
              <Field label="Authorised by">{open.policyRef}</Field>
              <Field label="Resource">{open.resourceType}</Field>
              <Field label="Resource id">{open.resourceId && <span className="font-mono text-xs">{open.resourceId}</span>}</Field>
              <Field label="Domain event">{open.domainEventId && <span className="font-mono text-xs">{open.domainEventId}</span>}</Field>
            </dl>
            {open.reason && <Field label="Reason">{open.reason}</Field>}
            <Json label="Before" value={open.previousState} />
            <Json label="After" value={open.newState} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function EventsPane() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<DomainEventRow>('/admin/events', { ...filters, ...dateRange(filters) });
  const [open, setOpen] = useState<DomainEventRow | null>(null);
  const [health, setHealth] = useState<EventsHealth | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ data: EventsHealth }>('/admin/events/health')
      .then((res) => alive && setHealth(res.data.data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const columns: Column<DomainEventRow>[] = [
    { key: 'when', header: 'Occurred', cell: (e) => <span className="whitespace-nowrap">{stamp(e.occurredAt)}</span> },
    { key: 'type', header: 'Event', cell: (e) => <span className="font-mono text-xs">{e.eventType}</span> },
    { key: 'agg', header: 'Aggregate', cell: (e) => e.aggregateType },
    { key: 'actor', header: 'Actor', cell: (e) => e.actorName ?? (e.actorType === 'SYSTEM' ? 'System' : '—') },
    {
      key: 'pub',
      header: 'Outbox',
      cell: (e) =>
        e.publishedAt ? <StatusBadge value="PUBLISHED" /> : <StatusBadge value={e.attempts > 0 ? 'Failing' : 'Waiting'} tone={e.attempts > 0 ? 'bad' : 'warn'} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="events-unpublished" label="Unpublished" hint="Waiting for the outbox worker" value={health?.unpublished ?? null} attention />
        <StatCard testId="events-stuck" label="Stuck" hint="Unpublished for over 5 minutes" value={health?.stuck ?? null} attention />
        <StatCard testId="events-failing" label="Failing" hint="At least one delivery attempt failed" value={health?.failing ?? null} attention />
        <div className="rounded-xl border border-border bg-card p-6 text-sm" data-testid="events-last-published">
          <p className="text-muted-foreground">Last published</p>
          <p className="mt-2 font-medium">{health ? (health.lastPublishedAt ? stamp(health.lastPublishedAt) : 'Never') : '…'}</p>
        </div>
      </div>
      <FilterBar fields={EVENT_FIELDS} values={filters} onChange={setFilters} testId="events-filters" />
      <DataTable
        testId="events"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No events match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
        onRowClick={setOpen}
        rowLabel={(e) => e.eventType}
      />
      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open?.eventType ?? ''} description="Domain event">
        {open && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Occurred">{stamp(open.occurredAt)}</Field>
              <Field label="Published">{open.publishedAt ? stamp(open.publishedAt) : 'Not yet'}</Field>
              <Field label="Actor">{open.actorName ?? (open.actorType === 'SYSTEM' ? 'System' : null)}</Field>
              <Field label="Delivery attempts">{String(open.attempts)}</Field>
              <Field label="Aggregate">{open.aggregateType}</Field>
              <Field label="Aggregate id"><span className="font-mono text-xs">{open.aggregateId}</span></Field>
            </dl>
            <Json label="Payload" value={open.payload} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

const TABS = [
  { id: 'audit', label: 'Audit log' },
  { id: 'events', label: 'Domain events' },
] as const;

export default function AuditPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('audit');
  return (
    <div className="space-y-6">
      <PageHeader title="Audit & events" description="Who was allowed to do what, and the events it produced. Append-only." />
      <div role="tablist" aria-label="Log" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            type="button"
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'audit' ? <AuditPane /> : <EventsPane />}
      </div>
    </div>
  );
}
