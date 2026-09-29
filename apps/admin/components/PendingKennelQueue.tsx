'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PendingKennel, PendingKennels } from '@/lib/types';

// A founded kennel opens Pending Verification and stays out of the directory
// and off the map until the platform activates it (D33/D10). This is what says
// so out loud: without it, activation depends on somebody thinking to filter
// the kennel list.

function waited(days: number) {
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function Row({ kennel, onActivated }: { kennel: PendingKennel; onActivated: () => void }) {
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await api.patch(`/admin/kennels/${kennel.id}`, { status: 'ACTIVE' });
      toast.success(`${kennel.shortName} is live.`);
      onActivated();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not activate that kennel'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="pending-kennel">
      <div className="min-w-0">
        <Link href={`/kennels/${kennel.id}`} className="font-medium hover:underline">
          {kennel.name}
        </Link>
        <p className="text-sm text-muted-foreground">
          {kennel.city}, {kennel.country} · founded by {kennel.foundedBy ?? 'someone since removed'} · waiting{' '}
          {waited(kennel.waitingDays)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={kennel.readyForReview ? 'font-medium text-primary-strong' : 'text-muted-foreground'}>
            Mismanagement {kennel.mismanagementCount}/{kennel.mismanagementNeeded}
            {kennel.readyForReview ? ' — ready' : ''}
          </span>
          <span className="text-muted-foreground">
            {kennel.activeMemberCount} {kennel.activeMemberCount === 1 ? 'member' : 'members'}
          </span>
          {/* Activating a kennel with no coordinates lists it but leaves it off
              the map, which is worth knowing before rather than after. */}
          {!kennel.hasCoordinates && (
            <span className="text-muted-foreground" data-testid="pending-kennel-nocoords">
              No coordinates — it will not appear on the map
            </span>
          )}
        </p>
      </div>
      <ConfirmDialog
        title={`Activate ${kennel.shortName}?`}
        description={
          <>
            It joins the kennel directory{kennel.hasCoordinates ? ' and the world map' : ''} straight away, and its
            admins are told it is live.
            {!kennel.readyForReview && (
              <>
                {' '}
                It holds {kennel.mismanagementCount} of the {kennel.mismanagementNeeded} mismanagement offices D10 asks
                for, so this is early. Verification level stays Pending either way.
              </>
            )}
            {!kennel.hasCoordinates && ' It has no coordinates, so it will be listed but not pinned on the map.'}
          </>
        }
        confirmLabel="Activate"
        trigger={
          <Button
            size="sm"
            variant={kennel.readyForReview ? 'default' : 'outline'}
            disabled={busy}
            data-testid="pending-kennel-activate"
          >
            {busy ? 'Activating…' : 'Activate'}
          </Button>
        }
        onConfirm={activate}
      />
    </li>
  );
}

export function PendingKennelQueue() {
  const [queue, setQueue] = useState<PendingKennels | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: PendingKennels }>('/admin/kennels/pending');
      setQueue(res.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the review queue'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card data-testid="pending-queue">
      <CardHeader>
        <CardTitle>Kennels awaiting review</CardTitle>
        <CardDescription>
          Founded by hashers and reachable by link, but not in the directory or on the map until you activate them.
          {queue ? ` A kennel is verifiable once ${queue.minimum} mismanagement offices are filled.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="py-4 text-center">
            <p className="text-destructive" role="alert">
              {error}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : !queue ? (
          <div className="h-24 animate-pulse rounded bg-muted" aria-busy />
        ) : queue.items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground" data-testid="pending-queue-empty">
            Nothing waiting. Every kennel on HCP has been dealt with.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {queue.items.map((kennel) => (
              <Row key={kennel.id} kennel={kennel} onActivated={load} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
