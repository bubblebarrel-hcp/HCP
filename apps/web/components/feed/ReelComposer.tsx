'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { ReelRecorder } from '@/components/feed/ReelRecorder';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/input';
import { AudiencePicker } from '@/components/profile/AudiencePicker';
import { Field } from '@/components/ui/label';
import { ACCEPTED_IMAGES, ACCEPTED_VIDEOS, MAX_UPLOAD_BYTES, fileSize, uploadPhoto, uploadVideo } from '@/lib/media';
import type { Audience, MyMembership, Page, Reel } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Posting a reel (D41), in the order the API expects: a draft carries the
// caption and the context, the video goes straight to storage against that
// draft, and publishing is the last step — so an upload that fails leaves a
// draft nobody sees rather than an empty reel in everyone's rail.

const NONE = '';

// A post, not an album: enough for a Circle, short of a slideshow.
const MAX_ITEMS = 10;

export function ReelComposer({
  open,
  onOpenChange,
  onPosted,
  // Pre-set when posting from a run or a kennel page rather than the rail.
  fixedKennelId,
  fixedRunId,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onPosted: () => Promise<void> | void;
  fixedKennelId?: string;
  fixedRunId?: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [kennelId, setKennelId] = useState(fixedKennelId ?? NONE);
  // Who may watch it (D57). Public until the hasher says otherwise.
  const [audience, setAudience] = useState<Audience>('PUBLIC');
  // Profile only (D58): pinned from the start, so it never reaches the rail or a
  // feed and never expires. Otherwise a reel lasts 24 hours.
  const [profileOnly, setProfileOnly] = useState(false);
  const [kennels, setKennels] = useState<MyMembership[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // A reel comes off the device one of two ways (D47): a file already on it, or
  // the camera, right now.
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!open || fixedKennelId) return;
    let cancelled = false;
    api
      .get<{ data: Page<MyMembership> }>('/me/memberships')
      .then((res) => {
        if (!cancelled) setKennels(res.data.data.items.filter((m) => m.status === 'ACTIVE'));
      })
      .catch(() => {
        // Posting without a kennel is a first-class case, so a failure here
        // costs the chooser and nothing else.
      });
    return () => {
      cancelled = true;
    };
  }, [open, fixedKennelId]);

  // The previews are the chosen files, seen: derived rather than stored, with
  // the object URLs handed back when they stop being the ones on screen.
  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f), video: f.type.startsWith('video/') })),
    [files],
  );
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  function reset() {
    setFiles([]);
    setRecording(false);
    setCaption('');
    setAudience('PUBLIC');
    setProfileOnly(false);
    if (!fixedKennelId) setKennelId(NONE);
    setBusy(null);
  }

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    event.target.value = '';
    const tooBig = picked.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is ${fileSize(tooBig.size)}. Each one must be 25MB or smaller.`);
      return;
    }
    // Added rather than replacing: a post is built up a few at a time.
    setFiles((current) => [...current, ...picked].slice(0, MAX_ITEMS));
  }

  async function post() {
    if (files.length === 0) {
      toast.error('Add a video or a photo first.');
      return;
    }
    try {
      setBusy('Creating the reel…');
      const draft = await api.post<{ data: { reel: Reel } }>('/reels', {
        caption: caption.trim() || null,
        kennelId: kennelId || null,
        runId: fixedRunId ?? null,
        visibility: audience,
        pinned: profileOnly,
      });
      const reel = draft.data.data.reel;

      // In order, because the order they were added is the order they are
      // watched in, and MediaLink.createdAt is what carries that.
      for (const [index, one] of files.entries()) {
        setBusy(files.length === 1 ? 'Uploading…' : `Uploading ${index + 1} of ${files.length}…`);
        const target = { type: 'REEL' as const, id: reel.id };
        await (one.type.startsWith('video/') ? uploadVideo(one, target) : uploadPhoto(one, target));
      }

      setBusy('Posting…');
      await api.post(`/reels/${reel.id}/publish`);

      toast.success('Reel posted. On On!');
      reset();
      onOpenChange(false);
      await onPosted();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not post that reel'));
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Post a reel"
        description="A short video: on trail, at the Circle, at a meeting, or holding a beer at home."
      >
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept={`${ACCEPTED_VIDEOS},${ACCEPTED_IMAGES}`}
            multiple
            onChange={choose}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="reel-file"
          />

          {recording ? (
            <ReelRecorder
              onRecorded={(taken) => {
                setFiles((current) => [...current, taken].slice(0, MAX_ITEMS));
                setRecording(false);
              }}
              onCancel={() => setRecording(false)}
            />
          ) : previews.length > 0 ? (
            <div className="space-y-2">
              {/* The first one is the cover, so it is the one shown large. */}
              {previews[0].video ? (
                <video src={previews[0].url} controls playsInline className="max-h-64 w-full rounded-lg bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[0].url} alt="" className="max-h-64 w-full rounded-lg bg-black object-contain" />
              )}

              <ul className="flex flex-wrap gap-2" data-testid="reel-items">
                {previews.map((item, index) => (
                  <li key={item.url} className="relative">
                    {item.video ? (
                      <video src={item.url} className="h-16 w-16 rounded-md bg-black object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt="" className="h-16 w-16 rounded-md bg-black object-cover" />
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      disabled={Boolean(busy)}
                      aria-label={`Remove item ${index + 1}`}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow ring-1 ring-border"
                      data-testid="reel-item-remove"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
                {previews.length < MAX_ITEMS && (
                  <li className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={Boolean(busy)}
                      className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-border text-muted-foreground hover:bg-muted/40"
                      data-testid="reel-add-more"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      <span className="text-[10px]">Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecording(true)}
                      disabled={Boolean(busy)}
                      className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-border text-muted-foreground hover:bg-muted/40"
                      data-testid="reel-add-camera"
                    >
                      <Camera className="h-4 w-4" aria-hidden />
                      <span className="text-[10px]">Record</span>
                    </button>
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                {previews.length === 1
                  ? 'One in this post. Add more and they swipe like a gallery.'
                  : `${previews.length} in this post, in this order. The first is the cover.`}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRecording(true)}
                className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:bg-muted/40"
                data-testid="reel-camera"
              >
                <Camera className="h-7 w-7 text-primary-strong" aria-hidden />
                <span className="text-sm font-medium text-foreground">Use the camera</span>
                <span className="text-xs">Record it here, up to 30 seconds</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:bg-muted/40"
                data-testid="reel-pick"
              >
                <Video className="h-7 w-7" aria-hidden />
                <span className="text-sm font-medium text-foreground">Videos or photos</span>
                <span className="text-xs">Pick as many as {MAX_ITEMS} · 25MB each</span>
              </button>
            </div>
          )}

          <Field label="Caption (optional)" htmlFor={`${id}-caption`}>
            <Textarea
              id={`${id}-caption`}
              rows={2}
              value={caption}
              maxLength={500}
              placeholder="Beer check at the top of the hill"
              onChange={(event) => setCaption(event.target.value)}
              data-testid="reel-caption"
            />
          </Field>

          {!fixedKennelId && kennels.length > 0 && (
            <Field
              label="Kennel (optional)"
              htmlFor={`${id}-kennel`}
              hint="Leave it as On On if this is just you, wherever you are."
            >
              <Select
                id={`${id}-kennel`}
                value={kennelId}
                onChange={(event) => setKennelId(event.target.value)}
                data-testid="reel-kennel"
              >
                <option value={NONE}>On On — no kennel</option>
                {kennels.map((m) => (
                  <option key={m.kennel.id} value={m.kennel.id}>
                    {m.kennel.shortName}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">Who can watch it</p>
            <AudiencePicker kind="reel" value={audience} onChange={setAudience} disabled={Boolean(busy)} compact />
            <p className="text-xs text-muted-foreground">
              A locked profile narrows this further: only its followers see anything it posts.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3" htmlFor={`${id}-profile-only`}>
            <input
              id={`${id}-profile-only`}
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
              checked={profileOnly}
              onChange={(event) => setProfileOnly(event.target.checked)}
              disabled={Boolean(busy)}
              data-testid="reel-profile-only"
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Only on my profile</span>
              <span className="block text-xs text-muted-foreground">
                {profileOnly
                  ? 'Pinned to your profile. It stays up, and it never shows in the reel rail or a feed.'
                  : 'Otherwise it shows in the reel rail for 24 hours, then disappears.'}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            {busy && (
              <span className="mr-auto flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {busy}
              </span>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void post()} disabled={Boolean(busy) || files.length === 0} data-testid="reel-post">
              Post it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
