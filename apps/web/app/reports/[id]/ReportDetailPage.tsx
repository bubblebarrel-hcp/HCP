'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Check, History, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { nextActions, reportStatusLabel, reportStatusTone, storyCategoryLabel } from '@/lib/reports';
import { formatRunDate } from '@/lib/runs';
import type { AiDraftSuggestion, ReportComment, ReportRevision, StoryItem, TrailReport } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import { EngagementBar } from '@/components/social/EngagementBar';
import api, { errorMessage } from '@/services/api';

// The page is a Client Component, so the counts are not in its server payload;
// the bar asks for them once it knows who is reading.
const EMPTY_ENGAGEMENT = {
  likes: 0,
  comments: 0,
  reshares: 0,
  bookmarks: 0,
  views: 0,
  liked: false,
  bookmarked: false,
  reshared: false,
};

// Scribe Studio. One page that is a reader for most people and a writing desk
// for the Scribe — the rules about who may do what are the API's (D29); this
// only shows what it was told.

const AUTOSAVE_MS = 1200;

function Article({ report }: { report: TrailReport }) {
  return (
    <div className="space-y-4">
      {(report.body ?? '').split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line leading-relaxed">
          {para}
        </p>
      ))}
      {report.citation && (
        <p className="border-t border-border pt-4 text-sm text-muted-foreground" data-testid="report-citation">
          {report.citation}
        </p>
      )}
    </div>
  );
}

// Scribe Studio itself. Its metadata lives on the server component in page.tsx,
// which is the only thing that can produce Open Graph tags (D50).
export function ReportDetailPage({ id }: { id: string }) {
  const { loading } = useAuth();
  const [report, setReport] = useState<TrailReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [revisions, setRevisions] = useState<ReportRevision[]>([]);
  const [story, setStory] = useState<StoryItem[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiDraftSuggestion | null>(null);
  const [aiEditedText, setAiEditedText] = useState('');

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    api
      .get<{ data: { report: TrailReport } }>(`/reports/${id}`)
      .then((res) => {
        if (cancelled) return;
        const next = res.data.data.report;
        setReport(next);
        setTitle(next.title);
        setBody(next.body ?? '');
        if (next.pendingAiSuggestion) {
          setAiSuggestion(next.pendingAiSuggestion);
          setAiEditedText(next.pendingAiSuggestion.output);
        }
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Trail Report not found'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, loading]);

  // The editorial extras only exist for the circle; a reader gets 403/404 and
  // simply sees nothing.
  useEffect(() => {
    if (!report?.viewer.canReview) return;
    let cancelled = false;
    api
      .get<{ data: { items: ReportComment[] } }>(`/reports/${id}/comments`)
      .then((res) => !cancelled && setComments(res.data.data.items))
      .catch(() => undefined);
    api
      .get<{ data: { items: ReportRevision[] } }>(`/reports/${id}/revisions`)
      .then((res) => !cancelled && setRevisions(res.data.data.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, report?.viewer.canReview]);

  useEffect(() => {
    if (!report?.viewer.canEdit) return;
    let cancelled = false;
    api
      .get<{ data: { items: StoryItem[] } }>(`/runs/${report.runId}/story`)
      .then((res) => !cancelled && setStory(res.data.data.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [report?.runId, report?.viewer.canEdit]);

  // FR-EDITOR-008: continuous auto-save. Saving happens on the keystroke's
  // timer, never in an effect, so a render can never trigger a write.
  function queueSave(next: { title?: string; body?: string }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.patch<{ data: { report: TrailReport } }>(`/reports/${id}`, next);
        setReport(res.data.data.report);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        toast.error(errorMessage(err, 'Could not save'));
      }
    }, AUTOSAVE_MS);
  }

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await api.post<{ data: { report: TrailReport } }>(`/reports/${id}/actions/${action}`, payload);
      setReport(res.data.data.report);
      setReason('');
      toast.success('Done');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    setBusy(true);
    try {
      const res = await api.post<{ data: { report: TrailReport } }>(`/reports/${id}/revise`, { body, reason });
      setReport(res.data.data.report);
      setReason('');
      toast.success('Correction published');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!commentDraft.trim()) return;
    try {
      const res = await api.post<{ data: { comment: ReportComment } }>(`/reports/${id}/comments`, { body: commentDraft });
      setComments((c) => [...c, res.data.data.comment]);
      setCommentDraft('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the comment'));
    }
  }

  async function resolveComment(commentId: string) {
    try {
      const res = await api.post<{ data: { items: ReportComment[] } }>(`/reports/${id}/comments/${commentId}/resolve`, {});
      setComments(res.data.data.items);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not resolve it'));
    }
  }

  async function aiDraft() {
    setAiBusy(true);
    try {
      const res = await api.post<{ data: { report: TrailReport; suggestion: AiDraftSuggestion } }>(
        `/reports/${id}/ai-draft`,
        {},
      );
      setReport(res.data.data.report);
      setAiSuggestion(res.data.data.suggestion);
      setAiEditedText(res.data.data.suggestion.output);
    } catch (err) {
      // Expected until ANTHROPIC_API_KEY is set (CODEX/PROVIDERS.md) — say so
      // rather than fail silently.
      toast.message(errorMessage(err, 'AI drafting is not switched on yet'));
    } finally {
      setAiBusy(false);
    }
  }

  // `keepEdited` distinguishes ACCEPTED (the Scribe kept Claude's words as
  // written) from PARTIALLY_ACCEPTED (the Scribe changed them first) — both
  // write `text`, only the audit trail differs.
  async function decideAiDraft(text: string | null, keepEdited: boolean) {
    if (!aiSuggestion) return;
    setAiBusy(true);
    try {
      const decision = text === null ? 'REJECTED' : keepEdited ? 'PARTIALLY_ACCEPTED' : 'ACCEPTED';
      const res = await api.post<{ data: { report: TrailReport } }>(
        `/reports/${id}/ai-draft/${aiSuggestion.id}/decision`,
        { decision, body: text ?? undefined },
      );
      setReport(res.data.data.report);
      if (text !== null) setBody(text);
      setAiSuggestion(null);
      toast.success(text === null ? 'Draft dismissed' : 'Draft applied');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    } finally {
      setAiBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="report-not-found">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafts are private to the Scribe and their reviewers until they are published.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/reports">Back to trail reports</Link>
        </Button>
      </Card>,
    );
  }
  if (!report) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const editing = report.viewer.canEdit;

  return shell(
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Card className={bleedCard} data-testid="report-page">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(reportStatusTone(report.status))} data-testid="report-status">
                {reportStatusLabel[report.status]}
              </Badge>
              <Link href={`/runs/${report.runId}`} className="text-sm font-medium hover:underline">
                #{report.run.runNumber} · {report.run.kennel.shortName}
              </Link>
              <span className="text-sm text-muted-foreground">
                {formatRunDate(report.run.startsAt, report.run.timeZone)}
              </span>
            </div>
            {editing ? (
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  queueSave({ title: e.target.value });
                }}
                className="mt-2 text-xl font-bold"
                aria-label="Report title"
                data-testid="report-title-input"
              />
            ) : (
              <CardTitle className="mt-2 text-2xl" data-testid="report-title">
                {report.title}
              </CardTitle>
            )}
            <CardDescription>
              Scribe: {report.scribe}
              {report.reviewers.length > 0 && ` · Reviewers: ${report.reviewers.join(', ')}`}
              {report.publishedAt && ` · Published ${formatDate(report.publishedAt)}`}
            </CardDescription>
          </CardHeader>
          {/* The run's own flyer, read-only here — editing it belongs on the run
              page, not the report. A report has no photo of its own yet, and a
              flyer is exactly the "visual attraction" a report should not lose
              just because it moved from an announcement to a story. */}
          {report.run.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- storage is R2 or the dev API, not a configured next/image domain
            <img
              src={report.run.posterUrl}
              alt={`Flyer for ${report.run.kennel.shortName} run #${report.run.runNumber}`}
              className="max-h-[32rem] w-full bg-muted object-contain"
              data-testid="report-poster"
            />
          )}
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <Textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    queueSave({ body: e.target.value });
                  }}
                  rows={18}
                  placeholder="Three checks, one beer stop, and a hare who swears the flour ran out…"
                  aria-label="Report body"
                  data-testid="report-body-input"
                />
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {savedAt ? `Saved ${formatDate(savedAt)}` : 'Saves as you write.'}
                </p>
              </>
            ) : (
              <Article report={report} />
            )}

            <div className="flex flex-wrap gap-2">
              {report.viewer.canEdit &&
                nextActions(report.status).map((a) => (
                  <Button
                    key={a.action}
                    type="button"
                    variant={a.primary ? 'default' : 'outline'}
                    disabled={busy || (a.action === 'publish' && !report.viewer.canPublish)}
                    onClick={() => act(a.action)}
                    data-testid={`report-action-${a.action}`}
                  >
                    {a.action === 'submit-review' && <Send className="h-4 w-4" aria-hidden />}
                    {a.label}
                  </Button>
                ))}
              {editing && !aiSuggestion && (
                <Button type="button" variant="outline" disabled={aiBusy} onClick={aiDraft} data-testid="report-ai">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {aiBusy ? 'Asking Claude…' : 'Draft with AI'}
                </Button>
              )}
            </div>

            {aiSuggestion && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="report-ai-suggestion">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary-strong" aria-hidden />
                  Claude&rsquo;s draft — grounded only in what this run recorded. Read it before keeping any of it.
                </p>
                <Textarea
                  value={aiEditedText}
                  onChange={(e) => setAiEditedText(e.target.value)}
                  rows={10}
                  aria-label="AI draft"
                  data-testid="report-ai-output"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => decideAiDraft(aiEditedText, aiEditedText !== aiSuggestion.output)}
                    data-testid="report-ai-accept"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Use this draft
                  </Button>
                  <Button type="button" variant="outline" disabled={aiBusy} onClick={() => decideAiDraft(null, false)} data-testid="report-ai-reject">
                    <X className="h-4 w-4" aria-hidden />
                    Discard
                  </Button>
                </div>
              </div>
            )}

            {report.viewer.canRevise && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-medium">Correcting a published report creates a revision.</p>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  aria-label="Corrected text"
                  data-testid="report-revise-body"
                />
                <Field label="Why this correction" htmlFor="report-revise-reason">
                  <Input
                    id="report-revise-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Counted the checks again"
                    data-testid="report-revise-reason"
                  />
                </Field>
                <Button type="button" onClick={revise} disabled={busy || reason.trim().length < 3}>
                  Publish the correction
                </Button>
              </div>
            )}

            {report.status === 'PUBLISHED' && report.viewer.canGovern && (
              <div className="space-y-2 border-t border-border pt-4">
                <Field label="Archive this report" htmlFor="report-archive-reason">
                  <Input
                    id="report-archive-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Replaced by the anniversary edition"
                    data-testid="report-archive-reason"
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || reason.trim().length < 3}
                  onClick={() => act('archive', { reason })}
                  data-testid="report-action-archive"
                >
                  Archive
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* The conversation after publication (D50). Deliberately separate from
            the Review panel below, which is editorial and happens before it. */}
        {(report.status === 'PUBLISHED' || report.status === 'ARCHIVED') && (
          <Card className={cn(bleedCard, "p-0 overflow-hidden")} data-testid="report-engagement">
            <EngagementBar
              segment="reports"
              id={report.id}
              initial={EMPTY_ENGAGEMENT}
              countViewOnMount
              className="border-t-0"
            />
          </Card>
        )}

        {report.viewer.canReview && (
          <Card className={bleedCard} data-testid="report-comments">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-4 w-4" aria-hidden />
                Review
              </CardTitle>
              <CardDescription>Suggestions stay separate until the Scribe takes them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {comments.length === 0 && <p className="text-sm text-muted-foreground">Nothing raised yet.</p>}
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className={cn('rounded-lg border border-border p-3', c.resolvedAt && 'opacity-60')}>
                    <p className="text-sm">{c.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.author} · {formatDate(c.createdAt)}
                      {c.resolvedAt && ' · settled'}
                    </p>
                    {!c.resolvedAt && (report.viewer.isScribe || report.viewer.canGovern) && (
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => resolveComment(c.id)}>
                        <Check className="h-4 w-4" aria-hidden />
                        Settle
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Was it three checks or four?"
                  aria-label="New comment"
                  data-testid="report-comment-input"
                />
                <Button type="button" onClick={addComment} disabled={!commentDraft.trim()}>
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {report.viewer.canEdit && (
          <Card className={bleedCard} data-testid="report-story">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4" aria-hidden />
                What the run collected
              </CardTitle>
              <CardDescription>Gathered as it happened. Yours to shape.</CardDescription>
            </CardHeader>
            <CardContent>
              {story.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing collected for this run.</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
                  {story.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{storyCategoryLabel[s.category]}</span>
                      <span className="text-muted-foreground"> · {formatDate(s.occurredAt)}</span>
                      <p>{s.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {report.viewer.canReview && revisions.length > 0 && (
          <Card className={bleedCard} data-testid="report-revisions">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-4 w-4" aria-hidden />
                History
              </CardTitle>
              <CardDescription>Nothing is ever overwritten.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {revisions.map((v) => (
                  <li key={v.id}>
                    <span className="font-medium">Version {v.version}</span>
                    {v.isPublication && <Badge className="ml-2">Published</Badge>}
                    <p className="text-muted-foreground">
                      {v.author} · {formatDate(v.createdAt)}
                    </p>
                    {v.reason && <p className="text-muted-foreground">“{v.reason}”</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>,
  );
}
