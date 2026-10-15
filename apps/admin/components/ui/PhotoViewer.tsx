'use client';

import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// A picture or clip filling the screen (a copy of apps/web's, on purpose:
// the apps share no code). Click the picture to zoom in and click again to
// fit; arrows, the arrow keys and the arrow buttons move between pictures;
// Esc, the cross or a click on the dark edge closes it. Radix gives the focus trap
// and the Esc handling.

// A clip plays in the viewer with its own controls; it cannot be zoomed.
export type ViewerPhoto = { url: string; label?: string; kind?: 'VIDEO'; poster?: string };

export function PhotoViewer({
  photos,
  index = 0,
  open,
  onOpenChange,
}: {
  photos: ViewerPhoto[];
  // The picture to open on.
  index?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
        {/* Mounted only while open (Radix), so each opening starts fitted on `index`. */}
        <ViewerBody photos={photos} start={index} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ViewerBody({ photos, start }: { photos: ViewerPhoto[]; start: number }) {
  const [current, setCurrent] = useState(Math.min(start, photos.length - 1));
  const [zoomed, setZoomed] = useState(false);
  const photo = photos[current];
  const many = photos.length > 1;

  function go(next: number) {
    setCurrent(Math.max(0, Math.min(photos.length - 1, next)));
    setZoomed(false);
  }

  const chrome =
    'absolute grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <DialogPrimitive.Content
      aria-describedby={undefined}
      data-testid="photo-viewer"
      onKeyDown={(event) => {
        // On a clip the arrows seek; the buttons still page.
        if ((event.target as HTMLElement).tagName === 'VIDEO') return;
        if (event.key === 'ArrowRight') go(current + 1);
        if (event.key === 'ArrowLeft') go(current - 1);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center focus:outline-none"
    >
      <DialogPrimitive.Title className="sr-only">{photo.label ?? 'Photo'}</DialogPrimitive.Title>

      {/* The dark edge around the picture closes it, as it does on a phone. */}
      <DialogPrimitive.Close aria-label="Close photo" tabIndex={-1} className="absolute inset-0 cursor-default" />

      <div
        className={cn(
          'relative flex max-h-full max-w-full items-center justify-center',
          zoomed ? 'h-full w-full overflow-auto' : 'p-4',
        )}
      >
        {photo.kind === 'VIDEO' ? (
          // The key restarts the player when the viewer pages to another clip.
          <video
            key={photo.url}
            src={photo.url}
            poster={photo.poster}
            controls
            autoPlay
            playsInline
            data-testid="photo-viewer-video"
            aria-label={photo.label ?? 'Video'}
            className="relative max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] bg-black"
          />
        ) : (
          <>
            {/* Storage is an arbitrary host, so next/image would need every
                deployment's domain configured up front. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.label ?? ''}
              draggable={false}
              onClick={() => setZoomed((z) => !z)}
              data-testid="photo-viewer-image"
              className={cn(
                'relative select-none',
                zoomed
                  ? 'm-auto max-h-none max-w-none cursor-zoom-out'
                  : 'max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] cursor-zoom-in object-contain',
              )}
              style={zoomed ? { width: '200%' } : undefined}
            />
          </>
        )}
      </div>

      <DialogPrimitive.Close aria-label="Close" data-testid="photo-viewer-close" className={cn(chrome, 'right-4 top-4')}>
        <X className="h-5 w-5" aria-hidden />
      </DialogPrimitive.Close>

      {many && (
        <>
          <span
            className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white"
            aria-live="polite"
          >
            {current + 1} / {photos.length}
          </span>
          {current > 0 && (
            <button type="button" aria-label="Previous photo" onClick={() => go(current - 1)} className={cn(chrome, 'left-4 top-1/2 -translate-y-1/2')}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          {current < photos.length - 1 && (
            <button type="button" aria-label="Next photo" onClick={() => go(current + 1)} className={cn(chrome, 'right-4 top-1/2 -translate-y-1/2')}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          )}
        </>
      )}
    </DialogPrimitive.Content>
  );
}
