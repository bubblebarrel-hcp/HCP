'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Mail, Link2, QrCode as QrCodeIcon, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { QrCode } from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { allTypes } from '@/lib/membership';
import type { CreatedInvitation, InvitationMethod, MembershipInvitation, MembershipType } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// FR-MEMBER-005 / D53. Officers issue, share and revoke invitations here. The
// token/link is only ever in the API's response to `create` — this panel
// shows it once, in `justCreated`, and never again after a reload.

const METHOD_ICON: Record<InvitationMethod, typeof Mail> = { EMAIL: Mail, QR_CODE: QrCodeIcon, LINK: Link2 };
const METHOD_LABEL: Record<InvitationMethod, string> = { EMAIL: 'Email', QR_CODE: 'QR code', LINK: 'Link' };

const STATUS_TONE: Record<MembershipInvitation['status'], string> = {
  pending: 'border-accent/30 bg-accent/10 text-accent-strong',
  accepted: 'border-primary/30 bg-primary/10 text-primary-strong',
  revoked: 'text-muted-foreground',
  expired: 'text-muted-foreground',
};

function fetchInvitations(slug: string) {
  return api.get<{ data: { items: MembershipInvitation[] } }>(`/kennels/${encodeURIComponent(slug)}/invitations`).then((r) => r.data.data.items);
}

export function InvitationsPanel({ slug }: { slug: string }) {
  const [items, setItems] = useState<MembershipInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreatedInvitation | null>(null);
  const [method, setMethod] = useState<InvitationMethod>('LINK');
  const [inviteEmail, setInviteEmail] = useState('');
  const [membershipType, setMembershipType] = useState<MembershipType>('FULL');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchInvitations(slug));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load invitations'));
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post<{ data: CreatedInvitation }>(`/kennels/${encodeURIComponent(slug)}/invitations`, {
        method,
        email: method === 'EMAIL' ? inviteEmail.trim() : undefined,
        membershipType,
      });
      setJustCreated(res.data.data);
      setInviteEmail('');
      toast.success(method === 'EMAIL' ? 'Invitation sent.' : 'Invitation created.');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create that invitation'));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy. Select and copy it manually.');
    }
  }

  return (
    <Card className={bleedCard} data-testid="invitations-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-4 w-4" aria-hidden />
          Invitations
        </CardTitle>
        <CardDescription>
          The one way to invite someone straight in — including to a hidden kennel, which no other join path can reach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Method" htmlFor="invite-method">
            <Select id="invite-method" value={method} onChange={(e) => setMethod(e.target.value as InvitationMethod)}>
              <option value="LINK">Link</option>
              <option value="EMAIL">Email</option>
              <option value="QR_CODE">QR code</option>
            </Select>
          </Field>
          {method === 'EMAIL' ? (
            <Field label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="hasher@example.com"
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Membership type" htmlFor="invite-type">
            <Select id="invite-type" value={membershipType} onChange={(e) => setMembershipType(e.target.value as MembershipType)}>
              {allTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={creating} data-testid="create-invitation">
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </form>

        {justCreated && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="invitation-created">
            <p className="font-medium">
              {justCreated.method === 'EMAIL' ? `Sent to ${justCreated.email}.` : 'Share this link. It will not be shown again.'}
            </p>
            {justCreated.method !== 'EMAIL' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{justCreated.link}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(justCreated.link)}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy
                </Button>
              </div>
            )}
            {justCreated.method === 'QR_CODE' && (
              <QrCode value={justCreated.link} size={128} className="mt-3 rounded-lg border border-border bg-white p-2" />
            )}
          </div>
        )}

        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : items === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" aria-busy />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="invitations-list">
            {items.map((inv) => {
              const Icon = METHOD_ICON[inv.method];
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {METHOD_LABEL[inv.method]}
                      {inv.email && ` · ${inv.email}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.status === 'pending' && `Expires ${formatDate(inv.expiresAt)}`}
                      {inv.status === 'accepted' && `Accepted ${formatDate(inv.acceptedAt!)}`}
                      {inv.status === 'revoked' && 'Revoked'}
                      {inv.status === 'expired' && `Expired ${formatDate(inv.expiresAt)}`}
                    </p>
                  </div>
                  <Badge className={cn(STATUS_TONE[inv.status])}>{inv.status}</Badge>
                  {inv.status === 'pending' && (
                    <ActionDialog
                      trigger={
                        <Button variant="outline" size="sm" data-testid={`revoke-invitation-${inv.id}`}>
                          Revoke
                        </Button>
                      }
                      title="Revoke this invitation?"
                      description="The link stops working immediately. It cannot be undone."
                      confirmLabel="Revoke"
                      destructive
                      onConfirm={async () => {
                        try {
                          await api.post(`/invitations/${inv.id}/revoke`);
                          toast.success('Invitation revoked.');
                          await load();
                        } catch (err) {
                          toast.error(errorMessage(err, 'Could not revoke that invitation'));
                          throw err;
                        }
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
