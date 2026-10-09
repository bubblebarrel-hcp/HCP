'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostPhoto } from '@/lib/types';

// A post with several pictures or clips, one at a time, side by side in a row
// (mobile components/feed/post-media.tsx does the same on a phone).
//
// The row is plain CSS scroll-snap, so it can be swiped or scrolled with the
// script off; the arrows, the dots and the counter are added on top once it has
// run. Every slide gets the same 4:5 frame with the item fitted inside it, so the
// post does not change height as you move and nothing is cropped.

export function MediaCarousel({ items, tallest }: { items: PostPhoto[]; tallest: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((next: number) => {
    const el = row.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  }, [items.length]);

  // Which slide is showing is whichever the row is scrolled to.
  const onScroll = () => {
    const el = row.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Moving away from a clip stops it, so two never play at once.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    el.querySelectorAll('video').forEach((video) => {
      const slide = video.closest('[data-slide]')?.getAttribute('data-slide');
      if (Number(slide) !== index) video.pause();
    });
  }, [index]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') goTo(index + 1);
    if (event.key === 'ArrowLeft') goTo(index - 1);
  };

  const arrow =
    'absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid';

  return (
    <div
      className="relative bg-black"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${items.length} items`}
      onKeyDown={onKeyDown}
      data-testid="post-carousel"
    >
      <div
        ref={row}
        onScroll={onScroll}
        tabIndex={0}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            data-slide={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}`}
            style={{ maxHeight: tallest }}
            className="grid aspect-[4/5] w-full shrink-0 snap-center place-items-center overflow-hidden bg-black"
          >
            {item.kind === 'VIDEO' ? (
              <video
                src={item.url}
                poster={item.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
                data-testid="post-video"
              />
            ) : (
              // Storage is an arbitrary host, so next/image would need every
              // deployment's domain configured up front.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>

      <span
        className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white"
        aria-live="polite"
        data-testid="post-carousel-count"
      >
        {index + 1} / {items.length}
      </span>

      {index > 0 && (
        <button type="button" aria-label="Previous" onClick={() => goTo(index - 1)} className={cn(arrow, 'left-3')}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      )}
      {index < items.length - 1 && (
        <button type="button" aria-label="Next" onClick={() => goTo(index + 1)} className={cn(arrow, 'right-3')}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
        {items.map((item, i) => (
          <span
            key={item.id}
            className={cn('h-1.5 w-1.5 rounded-full bg-white/50 transition-colors', i === index && 'bg-white')}
          />
        ))}
      </div>
    </div>
  );
}
