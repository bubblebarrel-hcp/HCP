'use client';

import { useCallback, useEffect, useState } from 'react';
import { Footprints } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { HareOffer, HareOffers, RunDetail } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Offering to hare a run (D44). A kennel dates its runs long before it knows
// who is setting them — "please pick a date convenient for you to hare" is the
// last line of every flyer — so this is that ask, answerable.
//
// Offering is not haring: an officer still says yes. What the API allows is
// what this shows; `canOffer` and `canAnswer` come from the server.

const tone: Record<HareOffer['status'], string> = {
  OFFERED: 'bg-accent text-accent-foreground',
  ACCEPTED: 'bg-primary text-primary-foreground',
  DECLINED: '',
  WITHDRAWN: '',
};

const label: Record<HareOffer['status'], string> = {
  OFFERED: 'Waiting on the kennel',
  ACCEPTED: 'Haring it',
  DECLINED: 'Not this time',
  WITHDRAWN: 'Withdrawn',
};

export function HarePanel({ run, onChanged }: { run: RunDetail; onChanged: () => Promise<void> | void }) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<HareOffers | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: HareOffers }>(`/runs/${run.id}/hare-offers`);
      setOffers(res.data.data);
    } catch {
      // Not everyone may read these; the panel simply does not appear.
      setOffers(null);
    }
  }, [run.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: HareOffers }>(`/runs/${run.id}/hare-offers`)
      .then((res) => {
        if (!cancelled) setOffers(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setOffers(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, run.id]);

  if (!user || !offers) return null;

  const hasHares = run.hares.length > 0;
  const waiting = offers.items.filter((o) => o.status === 'OFFERED');
  const answered = offers.items.filter((o) => o.status !== 'OFFERED');
  const mineWaiting = waiting.find((o) => o.isMine);

  // Nothing to say: hares are set, this viewer cannot offer, and none of their
  // own offers are on the table.
  if (hasHares && !offers.canAnswer && !mineWaiting && offers.items.length === 0) return null;

  async function refresh() {
    await load();
    await onChanged();
  }

  return (
    <Card className={bleedCard} data-testid="hare-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Footprints className="h-5 w-5" aria-hidden />
          {hasHares ? 'Haring this run' : 'This run needs a hare'}
        </CardTitle>
        <CardDescription>
          {hasHares
            ? 'The hares are set. Offers stay on the record either way.'
            : 'The kennel has the date. Somebody still has to lay the trail.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.canOffer && (
          <ActionDialog
            trigger={
              <Button data-testid="hare-offer">
                {hasHares ? 'Offer to co-hare' : 'I’ll hare this one'}
              </Button>
            }
            title={`Offer to hare run #${run.runNumber}?`}
            description="The mismanagement answers. If they say yes the trail is yours to set, and nobody sees it until you release it."
            confirmLabel="Send the offer"
            text={{
              label: 'Anything they should know',
              placeholder: 'I know a good route from the bar, and I can get the flour',
            }}
            onConfirm={async ({ text }) => {
              try {
                await api.post(`/runs/${run.id}/hare-offers`, { message: text || null, wantsLead: !hasHares });
                toast.success('Offer sent. The kennel will come back to you.');
                await refresh();
              } catch (err) {
                toast.error(errorMessage(err, 'Could not send that offer'));
                throw err;
              }
            }}
          />
        )}

        {offers.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {offers.canOffer ? 'Nobody has offered yet. Be the one.' : 'No offers on this run.'}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="hare-offers">
            {[...waiting, ...answered].map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-start gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                <Avatar name={offer.hasher.name} size="sm" src={offer.hasher.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{offer.isMine ? 'You' : offer.hasher.name}</span>
                    <Badge className={cn(tone[offer.status])}>{label[offer.status]}</Badge>
                    {offer.wantsLead && offer.status === 'OFFERED' && (
                      <span className="text-xs text-muted-foreground">wants to lead</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Offered {formatDate(offer.createdAt)}</p>
                  {offer.message && <p className="mt-1 rounded-lg bg-muted p-3 text-sm">“{offer.message}”</p>}
                  {offer.reason && offer.status === 'DECLINED' && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Reason:</span> {offer.reason}
                    </p>
                  )}
                </div>

                {offer.status === 'OFFERED' && offers.canAnswer && !offer.isMine && (
                  <div className="flex gap-2">
                    <ActionDialog
                      trigger={<Button size="sm" data-testid="hare-accept">Accept</Button>}
                      title={`${offer.hasher.name} hares run #${run.runNumber}?`}
                      description="They get the trail tools for this run straight away, and are told the trail is theirs."
                      confirmLabel="Yes, they hare it"
                      onConfirm={async () => {
                        try {
                          await api.post(`/hare-offers/${offer.id}/accept`);
                          toast.success(`${offer.hasher.name} is haring it.`);
                          await refresh();
                        } catch (err) {
                          toast.error(errorMessage(err, 'Could not accept that offer'));
                          throw err;
                        }
                      }}
                    />
                    <ActionDialog
                      trigger={
                        <Button size="sm" variant="outline" data-testid="hare-decline">
                          Not this time
                        </Button>
                      }
                      title={`Turn down ${offer.hasher.name}?`}
                      description="They are told, with your reason. They can offer on another date."
                      confirmLabel="Turn it down"
                      destructive
                      text={{ label: 'Reason', required: true, placeholder: 'We have someone lined up for this one' }}
                      onConfirm={async ({ text }) => {
                        try {
                          await api.post(`/hare-offers/${offer.id}/decline`, { reason: text });
                          toast.success('Answered.');
                          await refresh();
                        } catch (err) {
                          toast.error(errorMessage(err, 'Could not decline that offer'));
                          throw err;
                        }
                      }}
                    />
                  </div>
                )}

                {offer.status === 'OFFERED' && offer.isMine && (
                  <ActionDialog
                    trigger={
                      <Button size="sm" variant="ghost" data-testid="hare-withdraw">
                        Withdraw
                      </Button>
                    }
                    title="Withdraw your offer?"
                    description="The kennel sees that you pulled it, so they know to look for someone else."
                    confirmLabel="Withdraw it"
                    destructive
                    text={{ label: 'Reason (optional)', placeholder: 'Something came up that weekend' }}
                    onConfirm={async ({ text }) => {
                      try {
                        await api.post(`/hare-offers/${offer.id}/withdraw`, { reason: text || null });
                        toast.success('Offer withdrawn.');
                        await refresh();
                      } catch (err) {
                        toast.error(errorMessage(err, 'Could not withdraw that offer'));
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
