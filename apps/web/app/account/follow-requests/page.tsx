'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { approveFollowRequest, declineFollowRequest, listFollowRequests } from '@/lib/social';
import type { FollowRequest } from '@/lib/types';
import { brandColor } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// Who is waiting on this hasher's yes (D57). Only a locked profile has a queue:
// on a public one a follow is immediate, and on a closed one nobody can ask.

export default function FollowRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<FollowRequest[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listFollowRequests()
      .then((page) => {
        if (alive) setRows(page.items);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const decide = useCallback(async (request: FollowRequest, approve: boolean) => {
    setWorking(request.id);
    try {
      if (approve) await approveFollowRequest(request.id);
      else await declineFollowRequest(request.id);
      setRows((current) => (current ?? []).filter((r) => r.id !== request.id));
      toast.success(approve ? `${request.name} now follows you.` : 'Request declined. They are not told.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update that request'));
    } finally {
      setWorking(null);
    }
  }, []);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" aria-busy>
        <div className="h-64 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link
        href="/account/privacy"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to privacy
      </Link>

      <Card data-testid="follow-requests">
        <CardHeader>
          <CardTitle className="text-2xl">Follow requests</CardTitle>
          <CardDescription>
            People who asked to follow you. Approve a request and they see your photos, posts and reels. Decline it and
            they are not told; they can ask again.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows === null ? (
            <p className="p-6 text-sm text-muted-foreground" aria-busy>
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground" data-testid="follow-requests-empty">
              Nobody is waiting. Requests only come in while your profile is locked.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((request) => (
                <li key={request.id} className="flex items-center gap-3 px-6 py-3" data-testid="follow-request">
                  <Avatar
                    name={request.name}
                    size="md"
                    src={request.avatarUrl}
                    position={request.avatarPosition}
                    color={brandColor(request.homeKennel?.primaryColor)}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/hashers/${request.id}`} className="font-medium hover:underline">
                      {request.name}
                    </Link>
                    {request.homeKennel && (
                      <p className="truncate text-sm text-muted-foreground">{request.homeKennel.shortName}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={working === request.id}
                    onClick={() => void decide(request, true)}
                    data-testid="request-approve"
                  >
                    {working === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden />
                    )}
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={working === request.id}
                    onClick={() => void decide(request, false)}
                    data-testid="request-decline"
                  >
                    <X className="h-4 w-4" aria-hidden /> Decline
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
