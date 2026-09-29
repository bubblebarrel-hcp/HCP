'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AdminUser, Page } from '@/lib/types';
import { formatDate, humanize } from '@/lib/utils';

const LIMIT = 20;

export default function UsersPage() {
  const { user: me } = useAuth();
  const [data, setData] = useState<Page<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Page<AdminUser> }>('/admin/users', {
        params: { page, limit: LIMIT, ...(search ? { q: search } : {}) },
      });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load hashers'));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(u: AdminUser, platformRole: string) {
    try {
      await api.patch(`/admin/users/${u.id}/role`, { platformRole });
      toast.success(`${u.displayName} is now ${humanize(platformRole)}`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the role'));
    }
  }

  async function changeStatus(u: AdminUser, status: 'ACTIVE' | 'SUSPENDED') {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status });
      toast.success(status === 'SUSPENDED' ? `${u.displayName} suspended` : `${u.displayName} reinstated`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the status'));
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Hasher',
      cell: (u) => (
        <div>
          <p className="font-medium">{u.displayName}</p>
          <p className="text-xs text-muted-foreground">{u.fullName} · {u.email}</p>
        </div>
      ),
    },
    { key: 'kennel', header: 'Home kennel', cell: (u) => u.homeKennel?.shortName ?? <span className="text-muted-foreground">—</span> },
    {
      key: 'role',
      header: 'Platform role',
      cell: (u) => (
        <Select
          aria-label={`Platform role for ${u.displayName}`}
          value={u.role}
          disabled={u.id === me?.id}
          onChange={(e) => changeRole(u, e.target.value)}
          className="h-9 w-28"
          data-testid="user-role"
        >
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </Select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => (
        <Badge className={u.status === 'SUSPENDED' ? 'border-destructive/30 bg-destructive/10 text-destructive' : ''}>
          {humanize(u.status)}
        </Badge>
      ),
    },
    { key: 'joined', header: 'Joined', cell: (u) => formatDate(u.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (u) =>
        u.id === me?.id ? null : u.status === 'SUSPENDED' ? (
          <Button size="sm" variant="outline" onClick={() => changeStatus(u, 'ACTIVE')}>Reinstate</Button>
        ) : (
          <ConfirmDialog
            title={`Suspend ${u.displayName}?`}
            description="They are signed out everywhere immediately and cannot log in until reinstated. Their history is untouched."
            confirmLabel="Suspend"
            destructive
            trigger={<Button size="sm" variant="ghost" className="text-destructive">Suspend</Button>}
            onConfirm={() => changeStatus(u, 'SUSPENDED')}
          />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hashers</h1>
        <p className="text-muted-foreground">Platform roles and account status. Kennel roles are managed per kennel.</p>
      </div>

      <form
        className="flex gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <label htmlFor="q" className="sr-only">Search hashers</label>
        <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hash handle, name or email" className="w-72" />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <DataTable
        testId="users"
        columns={columns}
        rows={data?.items ?? []}
        loading={loading}
        error={error}
        onRetry={load}
        emptyMessage="No hashers match that search."
        page={page}
        limit={LIMIT}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
