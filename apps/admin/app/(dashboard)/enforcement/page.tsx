'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReasonDialog } from '@/components/ui/reason-dialog';
import type { CoordinationRow, EnforcementRow, Page } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// What the platform did on its own (D74, D75): a warning, a hold for a few days, a
// hold until somebody decides. Nothing here ended an account. A hold ends by itself,
// or staff lift it (the reports were wrong), or confirm it (they were right, and it
// is now a staff decision that no timer will undo). A held hasher can appeal; the
// platform also asks about reporters that look like one, and does nothing about the
// person reported until a human says which it was.

const LIMIT = 20;
type Tab = 'active' | 'appeals' | 'coordination' | 'all';

const STATE: Record<EnforcementRow['state'], { label: string; tone: string }> = {
  WARNED: { label: 'Warned', tone: 'border-accent/40 bg-accent/10 text-accent-strong' },
  ON_HOLD: { label: 'On hold', tone: 'border-destructive/30 bg-destructive/10 text-destructive' },
  UNDER_REVIEW: { label: 'Held for review', tone: 'border-destructive/30 bg-destructive/10 text-destructive' },
  LIFTED: { label: 'Lifted', tone: '' },
  CONFIRMED: { label: 'Confirmed by staff', tone: 'border-trail/30 bg-trail/10 text-trail' },
};

export default function EnforcementPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [data, setData] = useState<Page<EnforcementRow> | null>(null);
  const [flags, setFlags] = useState<Page<CoordinationRow> | null>(null);
  const [counts, setCounts] = useState<{ appeals: number; coordination: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, list] = await Promise.all([
        api.get<{ data: { appeals: number; coordination: number } }>('/admin/enforcements/counts'),
        tab === 'coordination'
          ? api.get<{ data: Page<CoordinationRow> }>('/admin/coordination', { params: { filter: 'pending', page, limit: LIMIT } })
          : api.get<{ data: Page<EnforcementRow> }>('/admin/enforcements', { params: { filter: tab, page, limit: LIMIT } }),
      ]);
      setCounts(c.data.data);
      if (tab === 'coordination') setFlags(list.data.data as Page<CoordinationRow>);
      else setData(list.data.data as Page<EnforcementRow>);
    } catch (err) {
      setError(errorMessage(err, 'Could not load automatic actions'));
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  async function post(url: string, body: unknown, done: string) {
    try {
      await api.post(url, body);
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  const columns: Column<EnforcementRow>[] = [
    {
      key: 'who',
      header: 'Hasher',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.user.name}</p>
          {r.user.username && <p className="text-xs text-muted-foreground">@{r.user.username}</p>}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'What happened',
      cell: (r) => (
        <div>
          <Badge className={cn(STATE[r.state].tone)}>{STATE[r.state].label}</Badge>
          {r.state === 'ON_HOLD' && r.endsAt && <p className="mt-1 text-xs text-muted-foreground">Lifts itself {formatDate(r.endsAt)}</p>}
          {r.appeal?.status === 'OPEN' && <Badge className="mt-1 border-primary/40 bg-primary/10 text-primary-strong">Appealed</Badge>}
          {r.appeal && r.appeal.status !== 'OPEN' && <p className="mt-1 text-xs text-muted-foreground">Appeal {r.appeal.status.toLowerCase()}</p>}
        </div>
      ),
    },
    {
      key: 'why',
      header: 'Why',
      cell: (r) => (
        <div className="max-w-md text-sm">
          <p>
            {r.reporterCount} independent reporters · score {r.score}
          </p>
          <p className="text-xs text-muted-foreground">
            {Object.entries(r.reasons)
              .map(([reason, n]) => `${humanize(reason)} ×${n}`)
              .join(', ')}
          </p>
          {r.appeal && (
            <blockquote className="mt-2 whitespace-pre-line border-l-2 border-border pl-3 text-sm" data-testid="appeal-message">
              {r.appeal.message}
            </blockquote>
          )}
        </div>
      ),
    },
    { key: 'when', header: 'When', cell: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => {
        const open = r.appeal?.status === 'OPEN';
        const holding = r.state === 'ON_HOLD' || r.state === 'UNDER_REVIEW';
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/reports?filter=open">Reports</Link>
            </Button>
            {open ? (
              <>
                <ReasonDialog
                  title="Turn this appeal down?"
                  description="The hold stands and the hasher is told, in the words you write here. They will read them. Be plain, and do not name who reported."
                  confirmLabel="Turn it down"
                  destructive
                  onConfirm={(note) => post(`/admin/appeals/${r.appeal!.id}/decide`, { outcome: 'DENY', note }, 'Turned down. The hasher is told.')}
                  trigger={
                    <Button size="sm" variant="outline" data-testid="appeal-deny">
                      Turn down
                    </Button>
                  }
                />
                <ReasonDialog
                  title="Grant this appeal?"
                  description="The account is restored now and the hasher is told. The reports so far stop counting, so the same reports cannot hold them again."
                  confirmLabel="Grant and restore"
                  required={false}
                  onConfirm={(note) => post(`/admin/appeals/${r.appeal!.id}/decide`, { outcome: 'GRANT', note }, 'Granted. The account is restored.')}
                  trigger={
                    <Button size="sm" data-testid="appeal-grant">
                      Grant
                    </Button>
                  }
                />
              </>
            ) : (
              <>
                {holding && (
                  <ReasonDialog
                    title="Keep this hold?"
                    description="You looked at the reports and agree. The account stays suspended until you change it, and no timer will lift it."
                    confirmLabel="Keep suspended"
                    required={false}
                    onConfirm={(note) => post(`/admin/enforcements/${r.id}/confirm`, { note }, 'Confirmed. It no longer lifts by itself.')}
                    trigger={
                      <Button size="sm" variant="outline" data-testid="enforcement-confirm">
                        Keep
                      </Button>
                    }
                  />
                )}
                {(holding || r.state === 'CONFIRMED' || r.state === 'WARNED') && (
                  <ReasonDialog
                    title={r.state === 'WARNED' ? 'Dismiss this warning?' : 'Lift this hold?'}
                    description={
                      r.state === 'WARNED'
                        ? 'The reports will stop counting towards a hold. The hasher is not told.'
                        : 'The account is restored now and the hasher is told. The reports so far stop counting, so the same reports cannot hold them again.'
                    }
                    confirmLabel={r.state === 'WARNED' ? 'Dismiss' : 'Lift the hold'}
                    required={false}
                    onConfirm={(note) => post(`/admin/enforcements/${r.id}/lift`, { note }, 'Lifted.')}
                    trigger={
                      <Button size="sm" data-testid="enforcement-lift">
                        {r.state === 'WARNED' ? 'Dismiss' : 'Lift'}
                      </Button>
                    }
                  />
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  const flagColumns: Column<CoordinationRow>[] = [
    {
      key: 'target',
      header: 'Reported',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.target.name}</p>
          {r.target.username && <p className="text-xs text-muted-foreground">@{r.target.username}</p>}
        </div>
      ),
    },
    {
      key: 'what',
      header: 'What the platform saw',
      cell: (r) => (
        <div className="max-w-xl space-y-3 text-sm">
          <p>
            Counted separately these reports add up to <strong>{r.rawScore}</strong>; counting linked reporters as one they add up to{' '}
            <strong>{r.effectiveScore}</strong>. Nothing has been done to {r.target.name}.
          </p>
          {r.groups.map((g, i) => (
            <div key={i} className="rounded-md border border-border p-2" data-testid="coordination-group">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked because they {g.signals.join(' and ')}</p>
              <ul className="mt-1 space-y-0.5">
                {g.reporters.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.username && <span className="text-muted-foreground"> @{p.username}</span>}
                    {p.joined && <span className="text-xs text-muted-foreground"> · joined {formatDate(p.joined)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    { key: 'when', header: 'Raised', cell: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-2">
          <ReasonDialog
            title="They are independent"
            description="These reporters really are separate people. They count separately again for this hasher, and the platform looks again straight away, which may warn or hold them."
            confirmLabel="They are independent"
            required={false}
            onConfirm={(note) => post(`/admin/coordination/${r.id}/review`, { outcome: 'CLEARED', note }, 'Counted separately. The platform has looked again.')}
            trigger={
              <Button size="sm" variant="outline" data-testid="coordination-clear">
                Independent
              </Button>
            }
          />
          <ReasonDialog
            title="This was a campaign"
            description="These reporters stop counting, for any hasher, for six months. Nothing happens to the hasher they reported. You may want to warn them separately, from their own page."
            confirmLabel="Confirm a campaign"
            destructive
            required={false}
            onConfirm={(note) => post(`/admin/coordination/${r.id}/review`, { outcome: 'CONFIRMED', note }, 'Confirmed. Those reporters no longer count.')}
            trigger={
              <Button size="sm" data-testid="coordination-confirm">
                Campaign
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  const tabs: { value: Tab; label: string; badge?: number }[] = [
    { value: 'active', label: 'Needs a decision' },
    { value: 'appeals', label: 'Appeals', badge: counts?.appeals },
    { value: 'coordination', label: 'Suspected coordination', badge: counts?.coordination },
    { value: 'all', label: 'Everything' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automatic actions</h1>
        <p className="max-w-2xl text-muted-foreground">
          When enough different hashers report the same person, the platform warns them, then holds the account for a few
          days, then holds it until you decide. It never ends an account. Reporters who look like one count as one, and
          when that changes the outcome it asks you before doing anything. A held hasher can appeal; their words are here.
        </p>
      </div>

      <div role="tablist" aria-label="Automatic actions" className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={tab === t.value}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            data-testid={`enforcement-tab-${t.value}`}
          >
            {t.label}
            {t.badge ? <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'coordination' ? (
        <DataTable
          testId="coordination"
          columns={flagColumns}
          rows={flags?.items ?? []}
          loading={loading}
          error={error}
          onRetry={load}
          emptyMessage="No reports look coordinated."
          page={page}
          limit={LIMIT}
          total={flags?.total ?? 0}
          onPageChange={setPage}
        />
      ) : (
        <DataTable
          testId="enforcement"
          columns={columns}
          rows={data?.items ?? []}
          loading={loading}
          error={error}
          onRetry={load}
          emptyMessage={tab === 'appeals' ? 'No appeals waiting.' : tab === 'active' ? 'Nothing automatic is waiting on you.' : 'The platform has not acted on anybody yet.'}
          page={page}
          limit={LIMIT}
          total={data?.total ?? 0}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
