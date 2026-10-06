'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import type { Page, ReportRow } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// The moderation queue (D61): what hashers have reported, most urgent first. A
// report is a request for a person to look; nothing here has been hidden, removed
// or suspended by being reported.

const LIMIT = 20;
const REASONS = ['SPAM', 'SCAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'SEXUAL', 'PRIVATE_INFO', 'SELF_HARM', 'IMPERSONATION', 'OTHER'];
const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
] as const;

function PriorityBadge({ priority }: { priority: number }) {
  if (priority >= 2) return <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Urgent</Badge>;
  if (priority === 1) return <Badge className="border-accent/40 bg-accent/10 text-accent-strong">High</Badge>;
  return <Badge>Normal</Badge>;
}

export default function ReportsPage() {
  const [filter, setFilter] = useState<(typeof TABS)[number]['value']>('open');
  const [reason, setReason] = useState('');
  const [data, setData] = useState<Page<ReportRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Page<ReportRow> }>('/admin/reports', {
        params: { filter, page, limit: LIMIT, ...(reason ? { reason } : {}) },
      });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load reports'));
    } finally {
      setLoading(false);
    }
  }, [filter, reason, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  const columns: Column<ReportRow>[] = [
    {
      key: 'priority',
      header: 'Priority',
      cell: (r) => <PriorityBadge priority={r.priority} />,
    },
    {
      key: 'what',
      header: 'Reported',
      cell: (r) => (
        <div className="max-w-md">
          <p className="font-medium">
            {humanize(r.targetType)}
            {r.target.name ? <span className="font-normal text-muted-foreground"> · {r.target.name}</span> : null}
          </p>
          {r.summary && <p className="truncate text-xs text-muted-foreground">{r.summary}</p>}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (r) => (
        <div>
          <p>{r.reasonLabel}</p>
          {r.openReportsOnTarget > 1 && r.status !== 'ACTIONED' && r.status !== 'DISMISSED' && (
            <p className="text-xs text-destructive">{r.openReportsOnTarget} reports on this</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge className={cn(r.status === 'ACTIONED' && 'border-trail/30 bg-trail/10 text-trail')}>
          {humanize(r.status)}
          {r.escalated ? ' · handed up' : ''}
        </Badge>
      ),
    },
    { key: 'when', header: 'Filed', cell: (r) => formatDate(r.createdAt) },
    {
      key: 'open',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/reports/${r.id}`} data-testid="report-open">
            Review
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          What hashers have reported. Reports about hashers, including every impersonation, are only seen here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Report state" className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={filter === tab.value}
              onClick={() => {
                setFilter(tab.value);
                setPage(1);
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                filter === tab.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              data-testid={`reports-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Select
          aria-label="Filter by reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setPage(1);
          }}
          className="h-9 w-56"
        >
          <option value="">Every reason</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        testId="reports"
        columns={columns}
        rows={data?.items ?? []}
        loading={loading}
        error={error}
        onRetry={load}
        emptyMessage={filter === 'open' ? 'No open reports. All clear.' : 'Nothing here.'}
        page={page}
        limit={LIMIT}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
