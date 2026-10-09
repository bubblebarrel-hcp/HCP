'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, BookOpen, Footprints, ImagePlus, ListPlus, Loader2, Play, Plus, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ReelComposer } from '@/components/feed/ReelComposer';
import { MentionTextarea } from '@/components/social/MentionTextarea';
import { AudienceSelect } from '@/components/profile/AudienceSelect';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilePreview } from '@/components/feed/FilePreview';
import { ACCEPTED_IMAGES, ACCEPTED_VIDEOS } from '@/lib/media';
import {
  MAX_POST_BODY,
  MAX_POST_PHOTOS,
  MAX_THREAD_POSTS,
  isVideoFile,
  mergeMedia,
  post as sendPost,
} from '@/lib/posts';
import { bleedCard, cn } from '@/lib/utils';
import type { Audience, TaggableRun } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// The composer at the top of the feed. "What's on trail?" is a real input now
// (D51): a hasher types, optionally adds photos, and it lands in everybody's
// feed. Reels, trail reports and runs stay below it — a reel is a different
// kind of thing (D41), and a report and a run belong to a kennel.
//
// A post has its own audience (D57): public, followers only, or only the hasher.
// It can narrow what their profile allows and never widen it, and the composer
// says which it is rather than leaving the hasher to guess.

export function Composer() {
  const { user } = useAuth();
  const router = useRouter();
  const [reeling, setReeling] = useState(false);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  // Public until the hasher says otherwise; kept after posting, since somebody who
  // posts to followers usually does so again.
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // A poll (D60): the words are the question, these are the answers.
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollHours, setPollHours] = useState(24);
  // A run the post is about (D60).
  const [runs, setRuns] = useState<TaggableRun[]>([]);
  const [runId, setRunId] = useState('');

  // The later posts of a thread, in order. Each is words only; the first post
  // carries the photos, the poll, the run and the audience for all of them.
  const [thread, setThread] = useState<string[]>([]);

  const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollReady = !pollOn || (filledOptions.length >= 2 && body.trim().length > 0);
  // A thread goes up whole, so a part left empty holds the Post button back
  // rather than being dropped without a word.
  const threadReady = thread.every((part) => part.trim().length > 0);
  const ready = (body.trim().length > 0 || photos.length > 0) && pollReady && threadReady;
  // Open once there is something to say, so the box does not take over the top
  // of the feed before anybody has typed.
  const expanded = body.length > 0 || photos.length > 0 || thread.length > 0;

  // The runs worth tagging are fetched once the box opens, not for everybody who
  // merely loads the page.
  useEffect(() => {
    if (!user || !expanded || runs.length > 0) return;
    let alive = true;
    api
      .get<{ data: { items: TaggableRun[] } }>('/me/taggable-runs')
      .then((res) => {
        if (alive) setRuns(res.data.data.items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, expanded, runs.length]);

  const addPhotos = (chosen: FileList | null) => {
    if (!chosen) return;
    const merged = mergeMedia(photos, Array.from(chosen));
    if (merged.error) toast.error(merged.error);
    setPhotos(merged.files);
    // Let the same file be picked again after it is dropped.
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProgress(photos.length ? { done: 0, total: photos.length } : null);
    try {
      await sendPost(
        {
          body: body.trim(),
          photos,
          visibility: audience,
          runId: runId || null,
          poll: pollOn ? { options: filledOptions, hours: pollHours } : undefined,
          thread: thread.map((part) => part.trim()),
        },
        (done, total) => setProgress({ done, total }),
      );
      setBody('');
      setThread([]);
      setPhotos([]);
      setPollOn(false);
      setPollOptions(['', '']);
      setRunId('');
      toast.success('Posted. On On!');
      // The home page is cached for a minute and the API's own eviction rides
      // the outbox, so the hasher who just posted would otherwise come back to
      // a feed without their post in it. This is the same event pull-to-refresh
      // raises; the feed reloads itself from the API, which is never cached.
      window.dispatchEvent(new CustomEvent(FEED_REFRESH_EVENT));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'That did not post.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const shortcut = 'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-muted';

  return (
    <Card className={cn(bleedCard, 'p-3 sm:p-4')} data-testid="composer">
      <div className="flex items-start gap-2">
        {user ? (
          <Avatar name={user.displayName} src={user.avatarUrl} />
        ) : (
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="composer-body" className="sr-only">
            What&apos;s on trail?
          </label>
          <MentionTextarea
            id="composer-body"
            value={body}
            onValueChange={(next) => setBody(next.slice(0, MAX_POST_BODY))}
            placeholder={`What's on trail${user ? `, ${user.displayName}` : ''}?`}
            rows={expanded ? 4 : 1}
            disabled={busy}
            className={cn(
              'w-full resize-none rounded-2xl bg-muted px-4 py-2.5 text-[15px] placeholder:text-muted-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60',
            )}
            data-testid="composer-input"
            onKeyDown={(event) => {
              // Ctrl/Cmd+Enter posts. Plain Enter is a new line: a post is
              // several sentences more often than a comment is.
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />

          {thread.length > 0 && (
            <ol className="mt-2 space-y-2 border-l-2 border-primary/40 pl-3" data-testid="composer-thread">
              {thread.map((part, index) => (
                <li key={index} className="relative">
                  <MentionTextarea
                    value={part}
                    onValueChange={(next) =>
                      setThread((current) => current.map((p, i) => (i === index ? next.slice(0, MAX_POST_BODY) : p)))
                    }
                    placeholder={`Part ${index + 2}`}
                    aria-label={`Part ${index + 2} of the thread`}
                    rows={3}
                    disabled={busy}
                    className="w-full resize-none rounded-2xl bg-muted px-4 py-2.5 text-[15px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                    data-testid="composer-thread-part"
                  />
                  <button
                    type="button"
                    onClick={() => setThread((current) => current.filter((_, i) => i !== index))}
                    disabled={busy}
                    aria-label={`Remove part ${index + 2}`}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-foreground text-background hover:opacity-90"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          )}

          {photos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" data-testid="composer-photos">
              {photos.map((file, index) => (
                <li key={`${file.name}-${index}`} className="relative">
                  {/* Object URLs, not uploads: nothing leaves the browser until
                      the hasher presses Post. */}
                  <FilePreview file={file} className="h-20 w-20 rounded-lg border border-border object-cover" />
                  {isVideoFile(file) && (
                    <span className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white">
                      <Play className="h-3 w-3 fill-current" aria-hidden />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                    disabled={busy}
                    aria-label={`Remove ${file.name}`}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-foreground text-background hover:opacity-90"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pollOn && (
            <div className="mt-2 space-y-2 rounded-xl border border-border p-3" data-testid="composer-poll">
              <p className="text-xs text-muted-foreground">Your words above are the question. Add two to five answers.</p>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) => current.map((o, i) => (i === index ? event.target.value.slice(0, 80) : o)))
                    }
                    placeholder={`Answer ${index + 1}`}
                    aria-label={`Answer ${index + 1}`}
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                    data-testid="composer-poll-option"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Remove answer ${index + 1}`}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                {pollOptions.length < 5 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPollOptions((c) => [...c, ''])}>
                    <Plus className="h-4 w-4" aria-hidden /> Answer
                  </Button>
                )}
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  Open for
                  <select
                    value={pollHours}
                    onChange={(event) => setPollHours(Number(event.target.value))}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={24}>1 day</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {expanded && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={`${ACCEPTED_IMAGES},${ACCEPTED_VIDEOS}`}
                multiple
                hidden
                onChange={(event) => addPhotos(event.target.files)}
                data-testid="composer-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || photos.length >= MAX_POST_PHOTOS}
                onClick={() => fileRef.current?.click()}
                data-testid="composer-add-photo"
              >
                <ImagePlus className="h-4 w-4" aria-hidden />
                Photo / video
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || thread.length + 1 >= MAX_THREAD_POSTS}
                onClick={() => setThread((current) => [...current, ''])}
                data-testid="composer-add-thread"
              >
                <ListPlus className="h-4 w-4" aria-hidden />
                Thread
              </Button>

              <Button
                type="button"
                variant={pollOn ? 'secondary' : 'outline'}
                size="sm"
                disabled={busy}
                aria-pressed={pollOn}
                onClick={() => setPollOn((on) => !on)}
                data-testid="composer-poll-toggle"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                Poll
              </Button>

              {runs.length > 0 && (
                <select
                  value={runId}
                  onChange={(event) => setRunId(event.target.value)}
                  disabled={busy}
                  aria-label="Tag a run"
                  className="h-9 max-w-[11rem] truncate rounded-md border border-border bg-background px-2 text-sm"
                  data-testid="composer-run"
                >
                  <option value="">Tag a run</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.kennel.shortName} #{run.runNumber ?? '—'}
                      {run.title ? ` · ${run.title}` : ''}
                    </option>
                  ))}
                </select>
              )}

              <AudienceSelect
                value={audience}
                onChange={setAudience}
                disabled={busy}
                label="Who can read this post"
              />

              <span className="ml-auto flex items-center gap-2">
                {progress && (
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                  </span>
                )}
                {body.length > MAX_POST_BODY - 500 && (
                  <span className="text-xs text-muted-foreground">{MAX_POST_BODY - body.length}</span>
                )}
                <Button type="button" size="sm" disabled={!ready || busy} onClick={submit} data-testid="composer-post">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Post
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 border-t border-border pt-2">
        <button type="button" onClick={() => setReeling(true)} className={shortcut} data-testid="composer-reel">
          <Video className="h-5 w-5 text-primary-strong" aria-hidden />
          <span className="hidden sm:inline">Reel</span>
        </button>
        <Link href="/reports" className={shortcut}>
          <BookOpen className="h-5 w-5 text-primary-strong" aria-hidden />
          <span className="hidden sm:inline">Trail reports</span>
        </Link>
        <Link href="/runs" className={shortcut}>
          <Footprints className="h-5 w-5 text-primary-strong" aria-hidden />
          <span className="hidden sm:inline">Runs</span>
        </Link>
      </div>

      <ReelComposer
        open={reeling}
        onOpenChange={setReeling}
        onPosted={() => {
          // The rail reloads itself; this only closes the loop for the composer.
        }}
      />
    </Card>
  );
}
