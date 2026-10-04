'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import type { ModerationActionKind, ReportDetail, ReportHasher } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// One report (D61). The thing as it was when it was reported, who is answerable for
// it, what moderation has done about them before, and the actions. For
// impersonation, the two hashers sit side by side so they can be compared.

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3010';

function HasherCard({ title, hasher, tone }: { title: string; hasher: ReportHasher; tone?: 'danger' }) {
  return (
    <div className={cn('rounded-lg border p-4', tone === 'danger' ? 'border-destructive/40' : 'border-border')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-start gap-3">
        {hasher.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hasher.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-muted text-lg font-semibold">
            {hasher.name.replace(/^Just /, '').slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{hasher.name}</p>
          {hasher.username && <p className="text-muted-foreground">@{hasher.username}</p>}
          <p className="text-muted-foreground">
            Joined {formatDate(hasher.createdAt)}
            {hasher.homeKennel ? ` · ${hasher.homeKennel.shortName}` : ''}
          </p>
          {hasher.status !== 'ACTIVE' && <Badge className="mt-1">{humanize(hasher.status)}</Badge>}
        </div>
      </div>
      {hasher.bio && <p className="mt-3 whitespace-pre-line text-sm">{hasher.bio}</p>}
      <a
        href={`${WEB_URL}/hashers/${hasher.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm text-primary-strong hover:underline"
      >
        Open their page
      </a>
    </div>
  );
}

function Evidence({ report }: { report: ReportDetail }) {
  const s = report.snapshot as Record<string, string | null | undefined>;
  if (report.targetType === 'USER') return null;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm" data-testid="report-evidence">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        As it was when reported{report.current?.removed ? ' · now taken down' : ''}
      </p>
      {(s.body ?? s.caption) && <p className="mt-2 whitespace-pre-line">{s.body ?? s.caption}</p>}
      {(s.mediaUrl ?? s.url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(s.mediaUrl ?? s.url) as string} alt="Reported media" className="mt-3 max-h-64 rounded-md" referrerPolicy="no-referrer" />
      )}
      {s.href && (
        <a href={`${WEB_URL}${s.href}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-primary-strong hover:underline">
          Open it
        </a>
      )}
    </div>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [closeSiblings, setCloseSiblings] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: { report: ReportDetail } }>(`/admin/reports/${id}`);
      setReport(res.data.data.report);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the report'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(kind: ModerationActionKind) {
    try {
      const res = await api.post<{ data: { report: ReportDetail } }>(`/admin/reports/${id}/actions`, {
        kind,
        note: note.trim() || null,
        closeSiblings,
      });
      setReport(res.data.data.report);
      setNote('');
      toast.success(`${humanize(kind)} done`);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  if (error) return <p className="text-destructive" role="alert">{error}</p>;
  if (!report) return <div className="h-64 animate-pulse rounded-xl bg-card" aria-busy />;

  const closed = report.status === 'ACTIONED' || report.status === 'DISMISSED';
  const isUser = report.targetType === 'USER';
  const targetUserKnown = report.answerable !== null;
  const has = (k: ModerationActionKind) => !closed && report.may.includes(k);
  const needsNote = note.trim().length < 3;

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All reports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {report.reasonLabel} · {humanize(report.targetType)}
          </h1>
          <p className="text-muted-foreground">
            Filed {formatDate(report.createdAt)}
            {report.reporter ? ` by ${report.reporter.name}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {report.priority >= 2 && <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Urgent</Badge>}
          <Badge data-testid="report-status">{humanize(report.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>What was reported</CardTitle>
              {report.details && <CardDescription className="whitespace-pre-line">&ldquo;{report.details}&rdquo;</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <Evidence report={report} />

              {isUser && report.target && (
                <div className={cn('grid gap-4', report.impersonated && 'md:grid-cols-2')} data-testid="report-people">
                  <HasherCard
                    title={report.impersonated ? 'Accused of impersonating' : 'The hasher'}
                    hasher={report.target}
                    tone={report.impersonated ? 'danger' : undefined}
                  />
                  {report.impersonated && <HasherCard title="Who they are said to be copying" hasher={report.impersonated} />}
                </div>
              )}
              {report.impersonated && report.target && (
                <p className="text-sm text-muted-foreground" data-testid="report-impersonation-notes">
                  {report.sameHandle && <span className="font-medium text-destructive">The hash handle is identical. </span>}
                  {new Date(report.target.createdAt) > new Date(report.impersonated.createdAt)
                    ? 'The accused joined after the hasher they are said to be copying.'
                    : 'The accused joined before the hasher they are said to be copying, so check this one carefully.'}{' '}
                  Reset identity clears the handle, picture, banner and bio and gives a neutral username. It does not touch
                  the real hasher.
                </p>
              )}
            </CardContent>
          </Card>

          {report.siblings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Other reports on this</CardTitle>
                <CardDescription>
                  {report.siblings.length} more. Closing this one closes the open ones too, unless you turn that off.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {report.siblings.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="font-medium">{s.reasonLabel}</span>
                      <Badge>{humanize(s.status)}</Badge>
                      <span className="text-muted-foreground">{formatDate(s.createdAt)}</span>
                      {s.details && <span className="w-full text-muted-foreground">&ldquo;{s.details}&rdquo;</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.priorActions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Moderation history for this hasher</CardTitle>
                <CardDescription>Only what was done, never what was only looked at.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {report.priorActions.map((a, i) => (
                    <li key={i}>
                      {humanize(a.kind)} · {humanize(a.reason)} · {formatDate(a.at)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.actions.length > 0 && (
            <Card data-testid="report-timeline">
              <CardHeader className="pb-3">
                <CardTitle>What has been done</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
                  {report.actions.map((a) => (
                    <li key={a.id}>
                      <p className="font-medium">
                        {humanize(a.kind)} <span className="font-normal text-muted-foreground">· {a.by} · {formatDate(a.at)}</span>
                      </p>
                      {a.note && <p className="whitespace-pre-line text-muted-foreground">{a.note}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-6" data-testid="report-actions">
          <CardHeader className="pb-3">
            <CardTitle>{closed ? 'Closed' : 'Decide'}</CardTitle>
            <CardDescription>
              {closed
                ? report.resolutionNote ?? 'No note was left.'
                : 'Your words go to the hasher for Remove, Warn and Reset, so write them for them. A note is only for staff.'}
            </CardDescription>
          </CardHeader>
          {!closed && (
            <CardContent className="space-y-3">
              <Textarea
                aria-label="Reason or note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Say why, in words the hasher will read."
                data-testid="report-note"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={closeSiblings} onChange={(e) => setCloseSiblings(e.target.checked)} />
                Close the other open reports on this too
              </label>

              <div className="flex flex-col gap-2">
                {has('DISMISS') && (
                  <ConfirmDialog
                    title="Dismiss this report?"
                    description="No breach of the rules. The reporter is told it was reviewed, and nothing happens to the reported."
                    confirmLabel="Dismiss"
                    trigger={<Button variant="outline" data-testid="action-dismiss">Dismiss</Button>}
                    onConfirm={() => act('DISMISS')}
                  />
                )}
                {has('REMOVE_CONTENT') && !isUser && (
                  <ConfirmDialog
                    title="Take this down?"
                    description="It comes down for everybody. The row stays, as every record does. The author sees your reason."
                    confirmLabel="Take it down"
                    destructive
                    trigger={<Button variant="destructive" disabled={needsNote} data-testid="action-remove">Remove content</Button>}
                    onConfirm={() => act('REMOVE_CONTENT')}
                  />
                )}
                {has('RESET_IDENTITY') && isUser && (
                  <ConfirmDialog
                    title="Reset this hasher's identity?"
                    description="Their hash handle, picture, banner and bio are cleared and they get a neutral username. They can still log in, and they are told why. This is what impersonation is fixed with."
                    confirmLabel="Reset identity"
                    destructive
                    trigger={<Button variant="destructive" disabled={needsNote} data-testid="action-reset">Reset identity</Button>}
                    onConfirm={() => act('RESET_IDENTITY')}
                  />
                )}
                {has('WARN_USER') && targetUserKnown && (
                  <ConfirmDialog
                    title="Send a warning?"
                    description={`${report.answerable?.name ?? 'The hasher'} gets your words as a notification. Nothing is taken away.`}
                    confirmLabel="Send warning"
                    trigger={<Button variant="outline" disabled={needsNote} data-testid="action-warn">Warn the hasher</Button>}
                    onConfirm={() => act('WARN_USER')}
                  />
                )}
                {has('SUSPEND_USER') && targetUserKnown && (
                  <ConfirmDialog
                    title="Suspend this hasher?"
                    description="They are signed out everywhere now and cannot log in until you reinstate them in Hashers. Their history is untouched."
                    confirmLabel="Suspend"
                    destructive
                    trigger={<Button variant="destructive" disabled={needsNote} data-testid="action-suspend">Suspend account</Button>}
                    onConfirm={() => act('SUSPEND_USER')}
                  />
                )}
                {has('NOTE') && (
                  <Button variant="ghost" disabled={!note.trim()} onClick={() => void act('NOTE')} data-testid="action-note">
                    Save as a staff note
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
