'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PendingKennelQueue } from '@/components/PendingKennelQueue';
import type { AdminStats } from '@/lib/types';

const tiles: { key: keyof AdminStats; label: string; hint: string }[] = [
  { key: 'kennels', label: 'Kennels', hint: 'All organizations on HCP' },
  { key: 'activeKennels', label: 'Active kennels', hint: 'Status Active' },
  { key: 'verifiedKennels', label: 'Verified', hint: '4+ mismanagement members' },
  { key: 'pendingKennels', label: 'Awaiting verification', hint: 'Status Pending Verification' },
  { key: 'users', label: 'Hashers', hint: 'Registered identities' },
  { key: 'recentSignups', label: 'New this week', hint: 'Signups in the last 7 days' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: AdminStats }>('/admin/stats');
      setStats(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load stats'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">The state of the Hash Community Platform.</p>
        </div>
        <Button asChild>
          <Link href="/kennels/new">New kennel</Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive" role="alert">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => (
            <Card key={t.key} data-testid={`stat-${t.key}`}>
              <CardHeader>
                <CardDescription>{t.label}</CardDescription>
                <CardTitle className="text-3xl tabular-nums" data-testid={`stat-${t.key}-value`}>
                  {stats ? stats[t.key] : <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{t.hint}</CardContent>
            </Card>
          ))}
        </div>
      )}

      <PendingKennelQueue onChanged={load} />
    </div>
  );
}
