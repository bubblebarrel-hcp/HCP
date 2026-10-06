'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api, { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { PendingKennelQueue } from '@/components/PendingKennelQueue';
import type { AdminStats } from '@/lib/types';

interface Tile {
  key: keyof AdminStats;
  label: string;
  hint: string;
  href?: string;
  // A count above zero means somebody has something to do.
  attention?: boolean;
}

const community: Tile[] = [
  { key: 'kennels', label: 'Kennels', hint: 'All organizations on Shiggy Trails', href: '/kennels' },
  { key: 'activeKennels', label: 'Active kennels', hint: 'Status Active' },
  { key: 'verifiedKennels', label: 'Verified', hint: '4+ mismanagement members' },
  { key: 'users', label: 'Hashers', hint: 'Registered identities', href: '/users' },
  { key: 'recentSignups', label: 'New this week', hint: 'Signups in the last 7 days' },
  { key: 'runsThisWeek', label: 'Runs this week', hint: 'Scheduled in the next 7 days', href: '/runs' },
];

const needsAction: Tile[] = [
  { key: 'pendingKennels', label: 'Awaiting verification', hint: 'Kennels waiting for activation', attention: true },
  { key: 'pendingMemberships', label: 'Pending memberships', hint: 'Applications in kennel review', href: '/memberships', attention: true },
  { key: 'kennelsAtRisk', label: 'Kennels below D10', hint: 'Active, short of mismanagement members', href: '/memberships', attention: true },
  { key: 'unpublishedEvents', label: 'Unpublished events', hint: 'Outbox backlog', href: '/audit', attention: true },
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    load();
  }, [load]);

  const grid = (tiles: Tile[]) => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((t) => (
        <StatCard
          key={t.key}
          testId={`stat-${t.key}`}
          label={t.label}
          hint={t.hint}
          href={t.href}
          attention={t.attention}
          value={stats ? stats[t.key] : null}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="The state of Shiggy Trails."
        actions={
          <Button asChild>
            <Link href="/kennels/new">New kennel</Link>
          </Button>
        }
      />

      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive" role="alert">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="needs-action" className="space-y-3">
            <h2 id="needs-action" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Needs a person</h2>
            {grid(needsAction)}
          </section>
          <section aria-labelledby="community" className="space-y-3">
            <h2 id="community" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Community</h2>
            {grid(community)}
          </section>
        </>
      )}

      <PendingKennelQueue onChanged={load} />
    </div>
  );
}
