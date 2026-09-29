'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Check, ImageOff, Loader2, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ACCEPTED_IMAGES, MAX_UPLOAD_BYTES, fileSize, uploadPhoto } from '@/lib/media';
import type { MediaAsset, MediaTarget } from '@/lib/types';
import { bleedCard } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Photos on a run. Who may add them, and who sees what is still pending, is
// decided by the API (D28); this only reflects what it says.

function Thumb({ media, onOpen }: { media: MediaAsset; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // block + w-full so the tile fills its grid cell: a button sizes to its
      // content by default, which collapses the square around the image.
      className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      data-testid="run-photo"
    >
      {media.url ? (
        // Storage is an arbitrary host (R2 or the dev API), so next/image would
        // need every deployment's domain configured up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.thumbnailUrl ?? media.url}
          alt={media.caption ?? `Photo by ${media.uploadedBy ?? 'a hasher'}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-5 w-5" aria-hidden />
        </span>
      )}
      {media.moderationState === 'PENDING' && (
        <Badge className="absolute left-1.5 top-1.5 bg-accent text-accent-foreground">Awaiting review</Badge>
      )}
    </button>
  );
}

export function RunMedia({
  target,
  canContribute,
  title = 'Photos',
}: {
  target: MediaTarget;
  canContribute: boolean;
  title?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(0);
  const [open, setOpen] = useState<MediaAsset | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { items: MediaAsset[]; canModerate: boolean } }>(
        `/media?targetType=${target.type}&targetId=${target.id}`,
      )
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.data.items);
        setCanModerate(res.data.data.canModerate);
        setLoaded(true);
      })
      // A target with no visible media simply shows nothing.
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [target.type, target.id]);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (files.length === 0) return;

    const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is ${fileSize(tooBig.size)}. Photos must be 25MB or smaller.`);
      return;
    }

    setBusy((n) => n + files.length);
    let added = 0;
    for (const file of files) {
      try {
        const media = await uploadPhoto(file, target);
        setItems((current) => [media, ...current.filter((m) => m.id !== media.id)]);
        added++;
      } catch (err) {
        toast.error(errorMessage(err, `${file.name} did not upload`));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added > 0) toast.success(added === 1 ? 'Photo added' : `${added} photos added`);
  }

  async function moderate(media: MediaAsset, approve: boolean) {
    try {
      const res = await api.post<{ data: { media: MediaAsset } }>(`/media/${media.id}/moderate`, { approve });
      const updated = res.data.data.media;
      setItems((current) =>
        approve ? current.map((m) => (m.id === updated.id ? updated : m)) : current.filter((m) => m.id !== updated.id),
      );
      setOpen(null);
      toast.success(approve ? 'Photo approved' : 'Photo hidden');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  if (!loaded) return null;
  if (items.length === 0 && !canContribute) return null;

  return (
    <Card className={bleedCard} data-testid="run-media">
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {items.length === 0
              ? 'No photos yet. Be the first.'
              : `${items.length} photo${items.length === 1 ? '' : 's'} from this run.`}
          </CardDescription>
        </div>
        {canContribute && (
          <>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_IMAGES}
              multiple
              onChange={onFiles}
              className="sr-only"
              // The visible button opens this; announcing it twice only adds noise.
              tabIndex={-1}
              aria-hidden
              data-testid="run-photo-input"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy > 0}
              data-testid="run-photo-add"
            >
              {busy > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-4 w-4" aria-hidden />
              )}
              {busy > 0 ? `Uploading ${busy}` : 'Add photos'}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Anything you add is credited to you and stays with the run.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((media) => (
              <li key={media.id}>
                <Thumb media={media} onOpen={() => setOpen(media)} />
              </li>
            ))}
          </ul>
        )}

        <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
          {open && (
            <DialogContent className="max-w-3xl" title={open.caption ?? 'Photo from this run'}>
              <div className="space-y-3">
                {open.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={open.url}
                    alt={open.caption ?? `Photo by ${open.uploadedBy ?? 'a hasher'}`}
                    className="max-h-[70vh] w-full rounded-lg object-contain"
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {open.caption && <span className="block text-foreground">{open.caption}</span>}
                    Added by {open.uploadedBy ?? 'a hasher'}
                    {open.moderationState === 'PENDING' && ' · awaiting review'}
                  </p>
                  {canModerate && (
                    <div className="flex gap-2">
                      {open.moderationState !== 'APPROVED' && (
                        <Button type="button" size="sm" onClick={() => moderate(open, true)}>
                          <Check className="h-4 w-4" aria-hidden />
                          Approve
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => moderate(open, false)}>
                        <X className="h-4 w-4" aria-hidden />
                        Hide
                      </Button>
                    </div>
                  )}
                </div>
                {canModerate && open.moderationState === 'PENDING' && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                    Only officers can see this until it is approved.
                  </p>
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>
      </CardContent>
    </Card>
  );
}
