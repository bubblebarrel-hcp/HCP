'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminKennel, BroadcastRow, Page } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

// D76. A message from the platform to everyone or to one kennel's members. It is
// delivered as a notification, so each hasher's own switches still apply: they can
// turn announcements off, and quiet hours hold a push. Urgent is the exception to
// quiet hours and digests, and it always asks for a push. A sent broadcast is never
// edited or deleted; it stays in the list below and in the audit log.

const LIMIT = 10;
const TITLE_MAX = 80;
const BODY_MAX = 500;

export default function BroadcastsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'EVERYONE' | 'KENNEL'>('EVERYONE');
  const [kennelId, setKennelId] = useState('');
  const [push, setPush] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [kennels, setKennels] = useState<AdminKennel[]>([]);
  const [reach, setReach] = useState<number | null>(null);

  const [history, setHistory] = useState<Page<BroadcastRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Page<BroadcastRow> }>('/admin/broadcasts', { params: { page, limit: LIMIT } });
      setHistory(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load broadcasts'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    api
      .get<{ data: Page<AdminKennel> }>('/admin/kennels', { params: { limit: 100 } })
      .then((res) => setKennels(res.data.data.items))
      .catch(() => setKennels([]));
  }, []);

  // How many it would reach, so nobody sends to a kennel they did not mean.
  useEffect(() => {
    if (audience === 'KENNEL' && !kennelId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the choice above
      setReach(null);
      return;
    }
    let live = true;
    api
      .get<{ data: { recipients: number } }>('/admin/broadcasts/preview', {
        params: { audience, ...(audience === 'KENNEL' ? { kennelId } : {}) },
      })
      .then((res) => live && setReach(res.data.data.recipients))
      .catch(() => live && setReach(null));
    return () => {
      live = false;
    };
  }, [audience, kennelId]);

  const kennelName = kennels.find((k) => k.id === kennelId)?.name;
  const ready =
    title.trim().length >= 3 && body.trim().length >= 3 && (audience === 'EVERYONE' || kennelId !== '') && (reach ?? 0) > 0;
  const who = audience === 'EVERYONE' ? 'everyone' : (kennelName ?? 'that kennel');

  async function send() {
    try {
      await api.post('/admin/broadcasts', {
        title: title.trim(),
        body: body.trim(),
        audience,
        ...(audience === 'KENNEL' ? { kennelId } : {}),
        push,
        urgent,
      });
      toast.success('Broadcast sent');
      setTitle('');
      setBody('');
      setPush(false);
      setUrgent(false);
      setPage(1);
      await loadHistory();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send the broadcast'));
      throw err;
    }
  }

  const columns: Column<BroadcastRow>[] = [
    {
      key: 'message',
      header: 'Message',
      cell: (r) => (
        <div className="max-w-md">
          <p className="font-medium">{r.title}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
        </div>
      ),
    },
    { key: 'to', header: 'To', cell: (r) => (r.audience === 'EVERYONE' ? 'Everyone' : (r.kennelName ?? 'A kennel')) },
    { key: 'count', header: 'Reached', cell: (r) => r.recipientCount },
    {
      key: 'how',
      header: 'How',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.urgent && <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Urgent</Badge>}
          {r.push && !r.urgent && <Badge>Push</Badge>}
          {!r.push && !r.urgent && <Badge>In app</Badge>}
        </div>
      ),
    },
    { key: 'sent', header: 'Sent', cell: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcasts"
        description="Tell hashers something: an update, an outage, a policy change or an event. A sent broadcast cannot be edited or taken back."
      />

      <Card>
        <CardHeader>
          <CardTitle>New broadcast</CardTitle>
          <CardDescription>
            It arrives in each hasher&apos;s notifications. Anyone who has turned announcements off, or is in quiet hours, will not be
            buzzed unless it is urgent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input
              id="broadcast-title"
              data-testid="broadcast-title"
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Planned maintenance on Saturday"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-body">Message</Label>
            <Textarea
              id="broadcast-body"
              data-testid="broadcast-body"
              maxLength={BODY_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What is happening, and what do hashers need to do, if anything?"
            />
            <p className="text-xs text-muted-foreground">{body.length}/{BODY_MAX}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-audience">Send to</Label>
              <Select
                id="broadcast-audience"
                data-testid="broadcast-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as 'EVERYONE' | 'KENNEL')}
              >
                <option value="EVERYONE">Everyone</option>
                <option value="KENNEL">One kennel&apos;s members</option>
              </Select>
            </div>
            {audience === 'KENNEL' && (
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-kennel">Kennel</Label>
                <Select id="broadcast-kennel" data-testid="broadcast-kennel" value={kennelId} onChange={(e) => setKennelId(e.target.value)}>
                  <option value="">Choose a kennel</option>
                  {kennels.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">How it arrives</legend>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
                data-testid="broadcast-push"
                checked={push || urgent}
                disabled={urgent}
                onChange={(e) => setPush(e.target.checked)}
              />
              <span>
                <span className="font-medium">Also send a push notification</span>
                <span className="block text-muted-foreground">
                  Buzzes the phones of hashers who have the app and allow announcement pushes. Off, it only waits in the app.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
                data-testid="broadcast-urgent"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              <span>
                <span className="font-medium">Urgent</span>
                <span className="block text-muted-foreground">
                  For outages and safety. Always sends a push, and goes through quiet hours and digests. Use it sparingly.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className={cn('text-sm', reach === 0 ? 'text-destructive' : 'text-muted-foreground')} data-testid="broadcast-reach">
              {reach === null
                ? 'Choose who it goes to.'
                : reach === 0
                  ? 'Nobody is in that audience.'
                  : `This will reach ${reach} hasher${reach === 1 ? '' : 's'}.`}
            </p>
            <ConfirmDialog
              title={`Send to ${who}?`}
              description={
                <>
                  <strong>{title.trim() || 'Your message'}</strong> will go to {reach ?? 0} hasher{reach === 1 ? '' : 's'}
                  {urgent ? ' as an urgent push notification' : push ? ' with a push notification' : ' in the app only'}. It cannot be
                  edited or taken back.
                </>
              }
              confirmLabel="Send"
              destructive={urgent}
              onConfirm={send}
              trigger={<Button disabled={!ready} data-testid="broadcast-send">Send broadcast</Button>}
            />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="broadcast-history">
        <h2 id="broadcast-history" className="text-lg font-semibold">Sent</h2>
        <DataTable
          columns={columns}
          rows={history?.items ?? []}
          loading={loading}
          error={error}
          onRetry={loadHistory}
          emptyMessage="Nothing has been broadcast yet."
          page={page}
          limit={LIMIT}
          total={history?.total ?? 0}
          onPageChange={setPage}
          testId="broadcast-history-table"
        />
      </section>
    </div>
  );
}
