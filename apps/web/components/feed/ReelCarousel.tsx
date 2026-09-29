'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReelItem } from '@/lib/types';
import { cn } from '@/lib/utils';

// The items in a reel, one at a time (D48): arrows, dots, arrow keys and a
// counter. Extracted from ReelViewer so the dialog and the reel's own page show
// the same carousel rather than two that drift apart.

export function ReelCarousel({
  items,
  alt,
  className,
  autoPlay = false,
}: {
  items: ReelItem[];
  alt: string;
  className?: string;
  // The dialog opens on a tap, so its video may autoplay. A page load is not a
  // request to start making noise.
  autoPlay?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const item = items[Math.min(index, items.length - 1)];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length]);

  if (!item) return null;
  const many = items.length > 1;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative overflow-hidden bg-black">
        {item.kind === 'VIDEO' ? (
          <video
            // Keyed so moving between items loads the new source rather than
            // keeping the old one playing.
            key={item.id}
            src={item.url}
            poster={item.posterUrl ?? undefined}
            controls
            autoPlay={autoPlay}
            playsInline
            className="max-h-[70vh] w-full"
            data-testid="reel-video"
          />
        ) : (
          // Storage is an arbitrary host, so next/image would need every
          // deployment's domain configured up front.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt={alt}
            className="max-h-[70vh] w-full object-contain"
            data-testid="reel-photo"
          />
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white disabled:opacity-0"
              data-testid="reel-prev"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
              disabled={index === items.length - 1}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white disabled:opacity-0"
              data-testid="reel-next"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {index + 1} / {items.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="flex justify-center gap-1.5 pb-1" data-testid="reel-dots">
          {items.map((dot, i) => (
            <button
              key={dot.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Item ${i + 1} of ${items.length}`}
              aria-current={i === index}
              className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
