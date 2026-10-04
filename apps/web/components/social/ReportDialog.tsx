'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { REPORT_REASONS, TARGET_WORDS, type ReportReason, type ReportTargetType } from '@/lib/moderation';
import { cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Reporting something to the people who look after Shiggy Trails (D61).
//
// A report asks a person to look. Nothing is hidden or taken down by sending one,
// the hasher reported is never told who did, and the reporter hears the outcome in
// one line. Impersonation asks one more thing: is it you they are pretending to
// be, or somebody else (who?).

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export function ReportDialog({
  targetType,
  targetId,
  trigger,
  // Offered once it is sent: block or mute the person behind it, which is a
  // different thing from telling us and often wanted straight away.
  afterSend,
}: {
  targetType: ReportTargetType;
  targetId: string;
  trigger: React.ReactNode;
  afterSend?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [impersonating, setImpersonating] = useState<'ME' | 'OTHER' | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);
  const [real, setReal] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reasons = REPORT_REASONS.filter((r) => !r.hasherOnly || targetType === 'USER');
  const isImpersonation = reason === 'IMPERSONATION';

  function reset() {
    setReason(null);
    setDetails('');
    setImpersonating(null);
    setQuery('');
    setFound([]);
    setReal(null);
    setError(null);
    setSent(false);
  }

  // Finding the hasher being copied, the way the "@" picker finds anybody.
  useEffect(() => {
    if (impersonating !== 'OTHER' || real) return;
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get<{ data: { items: Suggestion[] } }>('/mentions/suggest', { params: { q: query, limit: 6 } })
        .then((res) => alive && setFound(res.data.data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, impersonating, real]);

  const ready =
    reason !== null &&
    (reason !== 'OTHER' || details.trim().length > 0) &&
    (!isImpersonation || impersonating === 'ME' || (impersonating === 'OTHER' && real !== null));

  async function send() {
    if (!reason || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/reports', {
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
        ...(isImpersonation ? { impersonating, impersonatedUserId: impersonating === 'OTHER' ? real?.id : undefined } : {}),
      });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'That did not send.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && (
        <DialogContent
          title={sent ? 'Thank you' : `Report ${TARGET_WORDS[targetType]}`}
          description={
            sent
              ? undefined
              : 'We will look at it. They are not told it was you, and nothing happens to it until we have.'
          }
          className="max-w-lg"
        >
          {sent ? (
            <div className="space-y-4" data-testid="report-sent">
              <p className="flex items-center gap-2 text-sm">
                <Check className="h-5 w-5 text-trail" aria-hidden /> Your report is with us. We will tell you what we decide.
              </p>
              {afterSend}
              <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              data-testid="report-form"
            >
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">What is wrong?</legend>
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm',
                      reason === r.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="mt-1"
                      data-testid={`report-reason-${r.value}`}
                    />
                    <span>
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-muted-foreground">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {isImpersonation && (
                <fieldset className="space-y-2 rounded-lg border border-border p-3" data-testid="report-impersonation">
                  <legend className="px-1 text-sm font-medium">Who are they pretending to be?</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="impersonating"
                      checked={impersonating === 'ME'}
                      onChange={() => setImpersonating('ME')}
                      data-testid="report-impersonating-me"
                    />
                    Me
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="impersonating"
                      checked={impersonating === 'OTHER'}
                      onChange={() => setImpersonating('OTHER')}
                      data-testid="report-impersonating-other"
                    />
                    Somebody else
                  </label>
                  {impersonating === 'OTHER' &&
                    (real ? (
                      <p className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                        <Avatar name={real.name} size="sm" src={real.avatarUrl} className="h-7 w-7 text-xs" />
                        <span className="min-w-0 flex-1 truncate font-medium">{real.name}</span>
                        <button type="button" className="text-primary-strong hover:underline" onClick={() => setReal(null)}>
                          Change
                        </button>
                      </p>
                    ) : (
                      <div className="relative">
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Find the real hasher"
                          aria-label="Find the hasher they are pretending to be"
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                          data-testid="report-real-input"
                        />
                        {found.length > 0 && (
                          <ul className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg">
                            {found.map((person) => (
                              <li key={person.id}>
                                <button
                                  type="button"
                                  onClick={() => setReal(person)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  data-testid="report-real-suggestion"
                                >
                                  <Avatar name={person.name} size="sm" src={person.avatarUrl} className="h-7 w-7 text-xs" />
                                  <span className="min-w-0 flex-1 truncate">{person.name}</span>
                                  <span className="text-xs text-muted-foreground">@{person.username}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </fieldset>
              )}

              <div>
                <label htmlFor="report-details" className="text-sm font-medium">
                  Anything we should know?{reason === 'OTHER' ? '' : ' (optional)'}
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                  data-testid="report-details"
                />
              </div>

              {reason === 'SELF_HARM' && (
                <p className="rounded-lg bg-destructive/10 p-3 text-sm" role="note">
                  If somebody is in immediate danger, contact your local emergency services first. We read these reports
                  straight away.
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!ready || busy} data-testid="report-submit">
                  {busy ? 'Sending…' : 'Send report'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
