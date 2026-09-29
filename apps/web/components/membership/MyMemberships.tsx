'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { isPending, notifyMembershipsChanged, statusLabel, statusTone, typeLabel } from '@/lib/membership';
import type { MyMembership } from '@/lib/types';
import { bleedCard, brandColor, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

function detail(m: MyMembership) {
  if (isPending(m.status)) return 'Waiting for the mismanagement';
  if (m.status === 'ACTIVE') return `since ${formatDate(m.startDate ?? m.approvedAt ?? m.createdAt)}`;
  if (m.status === 'SUSPENDED') return m.suspendedUntil ? `until ${formatDate(m.suspendedUntil)}` : 'until reinstated';
  return formatDate(m.endDate ?? m.updatedAt);
}

export function MyMemberships() {
  const { memberships, error, reload } = useMyMemberships();
  const { refreshUser } = useAuth();
  const [settingHome, setSettingHome] = useState<string | null>(null);

  async function makeHome(m: MyMembership) {
    setSettingHome(m.id);
    try {
      await api.patch('/me/home-kennel', { kennelId: m.kennel.id });
      await Promise.all([reload(), refreshUser()]);
      toast.success(`${m.kennel.shortName} is now your home kennel.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not set your home kennel'));
    } finally {
      setSettingHome(null);
    }
  }

  return (
    <Card className={bleedCard} data-testid="my-memberships">
      <CardHeader className="pb-3">
        <CardTitle>Your kennels</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Could not load your kennels.{' '}
            <button type="button" className="font-medium text-primary-strong underline" onClick={() => void reload()}>
              Try again
            </button>
          </p>
        ) : memberships === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy />
        ) : memberships.length === 0 ? (
          <div className="py-2 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t joined a kennel yet.</p>
            <Button asChild className="mt-3">
              <Link href="/kennels">Find a kennel</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={m.kennel.shortName} color={brandColor(m.kennel.primaryColor)} />
                <div className="min-w-0 flex-1">
                  <Link href={`/kennels/${m.kennel.slug}`} className="font-semibold hover:underline">
                    {m.kennel.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {typeLabel[m.type]} · {detail(m)}
                  </p>
                </div>
                <Badge className={cn(statusTone(m.status))}>{statusLabel[m.status]}</Badge>
                {m.isHomeKennel ? (
                  <Badge className="border-primary/30 bg-primary/10 text-primary-strong" data-testid={`home-${m.id}`}>
                    <Home className="mr-1 h-3 w-3" aria-hidden />
                    Home
                  </Badge>
                ) : (
                  m.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={settingHome === m.id}
                      onClick={() => void makeHome(m)}
                      data-testid={`make-home-${m.id}`}
                    >
                      {settingHome === m.id ? 'Setting…' : 'Make home'}
                    </Button>
                  )
                )}
                {m.canManage && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/kennels/${m.kennel.slug}/members`}>Manage</Link>
                  </Button>
                )}
                {isPending(m.status) && (
                  <ActionDialog
                    trigger={
                      <Button variant="outline" size="sm" data-testid={`withdraw-${m.id}`}>
                        Withdraw
                      </Button>
                    }
                    title={`Withdraw your request to join ${m.kennel.name}?`}
                    description="You can ask again any time — withdrawing does not start a waiting period."
                    confirmLabel="Withdraw request"
                    destructive
                    text={{ label: 'Reason', placeholder: 'Optional' }}
                    onConfirm={async ({ text }) => {
                      try {
                        await api.post(`/memberships/${m.id}/withdraw`, { reason: text });
                        toast.success('Request withdrawn.');
                        notifyMembershipsChanged();
                        await reload();
                      } catch (err) {
                        toast.error(errorMessage(err, 'Could not withdraw your request'));
                        throw err;
                      }
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
