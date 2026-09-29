'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Pin, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { PassportView } from '@/components/passport/PassportView';
import { QrCode } from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { memoryKindLabel, timelineTypeLabel } from '@/lib/passport';
import type { HashPassport, IdentityTimelineEntry } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

function AddMemoryDialog({ onSaved }: { onSaved: (passport: HashPassport) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { kind: 'NOTE', title: '', note: '' };
  const [values, setValues] = useState(blank);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="add-memory">
          <Pin className="h-4 w-4" aria-hidden />
          Pin a memory
        </Button>
      </DialogTrigger>
      <DialogContent title="Pin a memory" description="Your own note on the passport. Only you see these.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (values.title.trim().length < 2) return;
            setBusy(true);
            try {
              const res = await api.post<{ data: { passport: HashPassport } }>('/me/passport/memories', values);
              onSaved(res.data.data.passport);
              setValues(blank);
              setOpen(false);
            } catch (err) {
              toast.error(errorMessage(err, 'Could not pin that'));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Kind" htmlFor={`${id}-kind`}>
            <Select id={`${id}-kind`} value={values.kind} onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value }))}>
              {Object.entries(memoryKindLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor={`${id}-title`}>
            <Input
              id={`${id}-title`}
              value={values.title}
              placeholder="The full moon run that went sideways"
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            />
          </Field>
          <Field label="Note (optional)" htmlFor={`${id}-note`}>
            <Textarea id={`${id}-note`} rows={3} value={values.note} onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="add-memory-submit">
              {busy ? 'Saving…' : 'Pin it'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PassportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [passport, setPassport] = useState<HashPassport | null>(null);
  const [timeline, setTimeline] = useState<IdentityTimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      api.get<{ data: { passport: HashPassport } }>('/me/passport'),
      api.get<{ data: { items: IdentityTimelineEntry[] } }>('/me/passport/timeline'),
    ])
      .then(([passportRes, timelineRes]) => {
        if (cancelled) return;
        setPassport(passportRes.data.data.passport);
        setTimeline(timelineRes.data.data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your passport'));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (!user || (!passport && !error)) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);
  if (error || !passport) return shell(<Card className={cn(bleedCard, 'p-8 text-center')}>{error}</Card>);

  const shareUrl = passport.shareToken
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/passport/shared/${passport.shareToken}`
    : null;

  return shell(
    <div className="space-y-4">
      <PassportView passport={passport} />

      <Card className={bleedCard} data-testid="passport-memories">
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <CardTitle>Your memories</CardTitle>
          <AddMemoryDialog onSaved={setPassport} />
        </CardHeader>
        <CardContent>
          {passport.memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pin a favourite trail, a beer stop or anything you want to keep. Only you see these.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {passport.memories.map((memory) => (
                <li key={memory.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{memory.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {memoryKindLabel[memory.kind] ?? memory.kind} · {formatDate(memory.pinnedAt)}
                    </p>
                    {memory.note && <p className="mt-1 text-sm">{memory.note}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${memory.title}`}
                    onClick={async () => {
                      try {
                        const res = await api.delete<{ data: { passport: HashPassport } }>(
                          `/me/passport/memories/${memory.id}`,
                        );
                        setPassport(res.data.data.passport);
                      } catch (err) {
                        toast.error(errorMessage(err, 'Could not remove that'));
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={bleedCard} data-testid="passport-share">
        <CardHeader className="pb-3">
          <CardTitle>Share your passport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Anyone with this link sees your stamps, milestones and places, under your hash name. Your pinned memories
            stay private. Rotate the link and the old one stops working.
          </p>
          {shareUrl && (
            <div className="flex flex-wrap items-start gap-4">
              <QrCode value={shareUrl} size={128} className="shrink-0 rounded-lg border border-border bg-white p-2" />
              <div className="flex flex-1 flex-wrap gap-2">
                <Input readOnly value={shareUrl} className="sm:w-96" aria-label="Share link" data-testid="share-url" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      toast.success('Link copied.');
                    } catch {
                      toast.error('Could not copy. Select the link instead.');
                    }
                  }}
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  data-testid="rotate-share"
                  onClick={async () => {
                    try {
                      const res = await api.post<{ data: { shareToken: string } }>('/me/passport/share/rotate');
                      setPassport({ ...passport, shareToken: res.data.data.shareToken });
                      setCopied(false);
                      toast.success('New link created. The old one no longer works.');
                    } catch (err) {
                      toast.error(errorMessage(err, 'Could not rotate the link'));
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  New link
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {timeline.length > 0 && (
        <Card className={bleedCard} data-testid="passport-timeline">
          <CardHeader className="pb-3">
            <CardTitle>Your timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
              {timeline.map((entry) => (
                <li key={entry.id}>
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {timelineTypeLabel[entry.type] ?? entry.type} · {formatDate(entry.occurredAt)}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>,
  );
}
