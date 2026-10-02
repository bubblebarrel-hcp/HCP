'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Footprints, ImagePlus, Loader2, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ReelComposer } from '@/components/feed/ReelComposer';
import { AudienceSelect } from '@/components/profile/AudienceSelect';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ACCEPTED_IMAGES, MAX_UPLOAD_BYTES, fileSize } from '@/lib/media';
import { MAX_POST_BODY, MAX_POST_PHOTOS, post as sendPost } from '@/lib/posts';
import { bleedCard, cn } from '@/lib/utils';
import type { Audience } from '@/lib/types';
import { errorMessage } from '@/services/api';

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

  const ready = body.trim().length > 0 || photos.length > 0;
  // Open once there is something to say, so the box does not take over the top
  // of the feed before anybody has typed.
  const expanded = body.length > 0 || photos.length > 0;

  const addPhotos = (chosen: FileList | null) => {
    if (!chosen) return;
    const room = MAX_POST_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`${MAX_POST_PHOTOS} photos is the limit on a post.`);
      return;
    }
    const accepted: File[] = [];
    for (const file of Array.from(chosen).slice(0, room)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is ${fileSize(file.size)} — the limit is ${fileSize(MAX_UPLOAD_BYTES)}.`);
        continue;
      }
      accepted.push(file);
    }
    setPhotos((current) => [...current, ...accepted]);
    // Let the same file be picked again after it is dropped.
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProgress(photos.length ? { done: 0, total: photos.length } : null);
    try {
      await sendPost({ body: body.trim(), photos, visibility: audience }, (done, total) => setProgress({ done, total }));
      setBody('');
      setPhotos([]);
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
          <textarea
            id="composer-body"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, MAX_POST_BODY))}
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

          {photos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" data-testid="composer-photos">
              {photos.map((file, index) => (
                <li key={`${file.name}-${index}`} className="relative">
                  {/* Object URLs, not uploads: nothing leaves the browser until
                      the hasher presses Post. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
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

          {expanded && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGES}
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
                Photo
              </Button>

              <AudienceSelect
                value={audience}
                onChange={setAudience}
                disabled={busy}
                label="Who can read this post"
              />

              <span className="ml-auto flex items-center gap-2">
                {progress && (
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    Photo {Math.min(progress.done + 1, progress.total)} of {progress.total}…
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
