'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/card';
import { KENNEL_STATUSES, type AdminKennel, type Page } from '@/lib/types';
import { formatDate, humanize } from '@/lib/utils';

const LIMIT = 20;

const columns: Column<AdminKennel>[] = [
  {
    key: 'name',
    header: 'Kennel',
    cell: (k) => (
      <Link href={`/kennels/${k.id}`} className="font-medium hover:underline" data-testid="kennel-row-link">
        {k.shortName}
        <span className="block text-xs font-normal text-muted-foreground">{k.name}</span>
      </Link>
    ),
  },
  { key: 'location', header: 'Location', cell: (k) => `${k.city}, ${k.country}` },
  { key: 'status', header: 'Status', cell: (k) => <Badge>{humanize(k.status)}</Badge> },
  {
    key: 'verification',
    header: 'Verification',
    cell: (k) =>
      k.verificationLevel === 'PENDING' ? (
        <span className="text-muted-foreground">Unverified</span>
      ) : (
        <Badge className="border-primary/30 bg-primary/10 text-primary-strong">{humanize(k.verificationLevel)}</Badge>
      ),
  },
  { key: 'members', header: 'Members', cell: (k) => k._count.memberships, className: 'tabular-nums' },
  { key: 'created', header: 'Created', cell: (k) => formatDate(k.createdAt) },
];

export default function KennelsPage() {
  const [data, setData] = useState<Page<AdminKennel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Page<AdminKennel> }>('/admin/kennels', {
        // Empty filters are omitted: the API validates status against the enum.
        params: { page, limit: LIMIT, ...(search ? { q: search } : {}), ...(status ? { status } : {}) },
      });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load kennels'));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kennels</h1>
          <p className="text-muted-foreground">Create, verify and archive kennels.</p>
        </div>
        <Button asChild data-testid="new-kennel">
          <Link href="/kennels/new">New kennel</Link>
        </Button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <label htmlFor="q" className="sr-only">Search</label>
        <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city or country" className="w-64" />
        <label htmlFor="status" className="sr-only">Status</label>
        <Select
          id="status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="w-52"
        >
          <option value="">All statuses</option>
          {KENNEL_STATUSES.map((s) => (
            <option key={s} value={s}>{humanize(s)}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <DataTable
        testId="kennels"
        columns={columns}
        rows={data?.items ?? []}
        loading={loading}
        error={error}
        onRetry={load}
        emptyMessage="No kennels match these filters."
        page={page}
        limit={LIMIT}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
