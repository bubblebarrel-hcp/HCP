'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { AudienceSelect } from '@/components/profile/AudienceSelect';
import { MentionTextarea } from '@/components/social/MentionTextarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { FilePreview } from '@/components/feed/FilePreview';
import { ACCEPTED_IMAGES, ACCEPTED_VIDEOS } from '@/lib/media';
import { MAX_POST_BODY, MAX_POST_PHOTOS, isVideoFile, mergeMedia, post as sendPost } from '@/lib/posts';
import type { Audience } from '@/lib/types';
import { errorMessage } from '@/services/api';

// The + in the phone tab bar: post photos from anywhere. The same act as the
// composer at the top of the feed (D51): up to four photos, words optional, its
// own audience (D57), sent as create-draft, upload, publish so nothing
// half-uploaded reaches the feed.
export function PhotoPostDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const addPhotos = (chosen: FileList | null) => {
    if (!chosen) return;
    const merged = mergeMedia(photos, Array.from(chosen));
    if (merged.error) toast.error(merged.error);
    setPhotos(merged.files);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (photos.length === 0 || busy) return;
    setBusy(true);
    setProgress({ done: 0, total: photos.length });
    try {
      await sendPost({ body: body.trim(), photos, visibility: audience }, (done, total) => setProgress({ done, total }));
      setBody('');
      setPhotos([]);
      onOpenChange(false);
      toast.success('Posted. On On!');
      // Same event pull-to-refresh raises: the feed reloads from the API, which is never cached.
      window.dispatchEvent(new CustomEvent(FEED_REFRESH_EVENT));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'That did not post.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent title="Post photos or a video" description="Up to four, and one of them may be a video. Words are optional.">
        <div className="space-y-4" data-testid="photo-post-dialog">
          {user && (
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} src={user.avatarUrl} position={user.avatarPosition} />
              <span className="font-semibold">{user.displayName}</span>
            </div>
          )}

          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2" data-testid="photo-post-photos">
              {photos.map((file, index) => (
                <li key={`${file.name}-${index}`} className="relative">
                  {/* Object URLs, not uploads: nothing leaves the browser until Post is pressed. */}
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

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={`${ACCEPTED_IMAGES},${ACCEPTED_VIDEOS}`}
              multiple
              hidden
              onChange={(event) => addPhotos(event.target.files)}
              data-testid="photo-post-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || photos.length >= MAX_POST_PHOTOS}
              onClick={() => fileRef.current?.click()}
              data-testid="photo-post-add"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              Photos / video
            </Button>
            <span className="text-xs text-muted-foreground">
              {photos.length} of {MAX_POST_PHOTOS}
            </span>
          </div>

          <label htmlFor="photo-post-body" className="sr-only">
            Say something about them
          </label>
          <MentionTextarea
            id="photo-post-body"
            value={body}
            onValueChange={(next) => setBody(next.slice(0, MAX_POST_BODY))}
            placeholder="Say something about them (optional)"
            rows={3}
            disabled={busy}
            className="w-full resize-none rounded-2xl bg-muted px-4 py-2.5 text-[15px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center gap-2">
            <AudienceSelect value={audience} onChange={setAudience} disabled={busy} label="Who can see this post" />
            <span className="ml-auto flex items-center gap-2">
              {progress && (
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                </span>
              )}
              <Button type="button" size="sm" disabled={photos.length === 0 || busy} onClick={submit} data-testid="photo-post-submit">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Post
              </Button>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
