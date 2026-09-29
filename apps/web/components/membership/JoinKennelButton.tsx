'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, Settings2, Sliders, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { notifyMembershipsChanged, selfSelectableTypes } from '@/lib/membership';
import type { ViewerMembership } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

function fetchViewer(slug: string) {
  return api
    .get<{ data: ViewerMembership }>(`/kennels/${encodeURIComponent(slug)}/membership`)
    .then((res) => res.data.data);
}

const wrap = 'flex w-full flex-col gap-2 sm:mb-2 sm:w-auto sm:flex-row sm:items-center';
const pill =
  'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-6 text-base font-semibold text-secondary-foreground';

// The kennel page's call to action: join, request pending, member (with leave),
// suspended, or blocked with a reason. Officers also get "Manage members".
export function JoinKennelButton({ slug, shortName }: { slug: string; shortName: string }) {
  const { user, loading } = useAuth();
  const [viewer, setViewer] = useState<ViewerMembership | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setViewer(await fetchViewer(slug));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchViewer(slug)
      .then((data) => {
        if (cancelled) return;
        setViewer(data);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  if (loading || (user && !viewer && !failed)) {
    return (
      <div className={wrap}>
        <span className="h-11 w-full animate-pulse rounded-md bg-muted sm:w-56" aria-hidden />
        <noscript>
          <Link href="/auth/register" className="font-semibold text-primary-strong underline">
            Join to hash with {shortName}
          </Link>
        </noscript>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={wrap}>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/auth/register">Join to hash with {shortName}</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
          <Link href="/auth/login">Log in</Link>
        </Button>
      </div>
    );
  }

  if (failed || !viewer) {
    return (
      <div className={wrap}>
        <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => void load()}>
          Could not load membership. Try again
        </Button>
      </div>
    );
  }

  const m = viewer.membership;
  const canManage = viewer.permissions.includes('membership.review');
  const canRunKennel = viewer.permissions.includes('kennel.manage');

  let primary: React.ReactNode;
  if (m && (m.status === 'ACTIVE' || m.status === 'INACTIVE')) {
    primary = (
      <div className="flex gap-2">
        <span className={`${pill} flex-1 sm:flex-none`} data-testid="membership-member">
          <Check className="h-5 w-5" aria-hidden />
          Member
        </span>
        <ActionDialog
          trigger={
            <Button size="lg" variant="ghost" data-testid="leave-kennel">
              Leave
            </Button>
          }
          title={`Leave ${shortName}?`}
          description="Your runs, trail reports and Hash Passport history stay with you. You can ask to join again later."
          confirmLabel="Leave kennel"
          destructive
          text={{ label: 'Reason', placeholder: 'Anything the mismanagement should know' }}
          onConfirm={async ({ text }) => {
            try {
              await api.post(`/memberships/${m.id}/resign`, { reason: text });
              toast.success(`You have left ${shortName}.`);
              notifyMembershipsChanged();
              await load();
            } catch (err) {
              toast.error(errorMessage(err, 'Could not leave the kennel'));
              throw err;
            }
          }}
        />
      </div>
    );
  } else if (m && (m.status === 'PENDING_REVIEW' || m.status === 'APPLICANT')) {
    primary = (
      <div className="flex gap-2">
        <span className={`${pill} flex-1 sm:flex-none`} data-testid="membership-pending" title="Waiting for the kennel's mismanagement">
          <Clock className="h-5 w-5" aria-hidden />
          Request sent
        </span>
        <ActionDialog
          trigger={
            <Button size="lg" variant="ghost" data-testid="withdraw-request">
              Withdraw
            </Button>
          }
          title={`Withdraw your request to join ${shortName}?`}
          description="You can ask again any time — withdrawing does not start a waiting period."
          confirmLabel="Withdraw request"
          destructive
          text={{ label: 'Reason', placeholder: 'Optional' }}
          onConfirm={async ({ text }) => {
            try {
              await api.post(`/memberships/${m.id}/withdraw`, { reason: text });
              toast.success('Request withdrawn.');
              notifyMembershipsChanged();
              await load();
            } catch (err) {
              toast.error(errorMessage(err, 'Could not withdraw your request'));
              throw err;
            }
          }}
        />
      </div>
    );
  } else if (m?.status === 'SUSPENDED') {
    primary = (
      <span className={pill} data-testid="membership-suspended">
        Membership suspended
      </span>
    );
  } else if (viewer.canRequest) {
    primary = (
      <ActionDialog
        trigger={
          <Button size="lg" className="w-full sm:w-auto" data-testid="join-kennel">
            Join to hash with {shortName}
          </Button>
        }
        title={`Join ${shortName}`}
        description="The kennel's mismanagement reviews every request."
        confirmLabel="Send request"
        types={selfSelectableTypes}
        text={{ label: 'Message to the mismanagement', placeholder: 'Where you hash now, who told you about the kennel…' }}
        onConfirm={async ({ text, type }) => {
          try {
            await api.post(`/kennels/${encodeURIComponent(slug)}/memberships`, { type, message: text });
            toast.success('Request sent. The mismanagement will review it.');
            notifyMembershipsChanged();
            await load();
          } catch (err) {
            toast.error(errorMessage(err, 'Could not send your request'));
            throw err;
          }
        }}
      />
    );
  } else {
    primary = (
      <div className="flex flex-col gap-1">
        <Button size="lg" disabled className="w-full sm:w-auto">
          Join to hash with {shortName}
        </Button>
        {viewer.reason && (
          <p className="text-xs text-muted-foreground sm:max-w-64" data-testid="join-blocked-reason">
            {viewer.reason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={wrap}>
      {primary}
      {/* Offices and the leadership timeline are members' business (D32). */}
      {viewer.membership?.status === 'ACTIVE' && (
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto" data-testid="kennel-officers-link">
          <Link href={`/kennels/${slug}/officers`}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            How it&rsquo;s run
          </Link>
        </Button>
      )}
      {/* Running the kennel itself, as opposed to its membership roll (D34). */}
      {canRunKennel && (
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto" data-testid="kennel-settings-link">
          <Link href={`/kennels/${slug}/settings`}>
            <Sliders className="h-4 w-4" aria-hidden />
            Kennel settings
          </Link>
        </Button>
      )}
      {canManage && (
        <Button asChild size="lg" variant="outline" className="w-full sm:w-auto" data-testid="manage-members">
          <Link href={`/kennels/${slug}/members`}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Manage members
            {viewer.pendingCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {viewer.pendingCount}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </Link>
        </Button>
      )}
    </div>
  );
}
