'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { KennelForm } from '@/components/KennelForm';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AdminKennel } from '@/lib/types';

export default function EditKennelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [kennel, setKennel] = useState<AdminKennel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: { kennel: AdminKennel } }>(`/admin/kennels/${id}`);
      setKennel(res.data.data.kennel);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the kennel'));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center">
        <p className="text-destructive" role="alert">{error}</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/kennels">Back to kennels</Link></Button>
      </div>
    );
  }

  if (!kennel) {
    return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-muted" aria-busy />;
  }

  const hasHistory = kennel._count.memberships > 0 || kennel._count.runs > 0 || kennel.verificationLevel !== 'PENDING';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/kennels" className="text-sm text-muted-foreground hover:text-foreground">← Kennels</Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight" data-testid="kennel-title">{kennel.name}</h1>
          <p className="text-sm text-muted-foreground">
            {kennel._count.memberships} memberships · {kennel._count.runs} runs · /{kennel.slug}
          </p>
        </div>
        <ConfirmDialog
          title={hasHistory ? 'Archive this kennel?' : 'Delete this kennel?'}
          description={
            hasHistory
              ? 'This kennel has members, runs or verification history, so it will be archived rather than deleted. Its history stays intact.'
              : 'This kennel has no history and will be permanently deleted.'
          }
          confirmLabel={hasHistory ? 'Archive' : 'Delete'}
          destructive
          trigger={<Button variant="destructive" data-testid="kennel-delete">{hasHistory ? 'Archive' : 'Delete'}</Button>}
          onConfirm={async () => {
            try {
              const res = await api.delete<{ data: { deleted: boolean; archived: boolean } }>(`/admin/kennels/${kennel.id}`);
              toast.success(res.data.data.archived ? 'Kennel archived' : 'Kennel deleted');
              router.push('/kennels');
            } catch (err) {
              toast.error(errorMessage(err, 'Could not remove the kennel'));
            }
          }}
        />
      </div>

      {/* Remount after save so the form picks up server-normalized values */}
      <KennelForm key={kennel.updatedAt} kennel={kennel} onSaved={() => load()} />
    </div>
  );
}
