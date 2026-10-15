'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import type { ContentMedia } from '@/lib/types';

// The pictures and clips on a post or reel, as small tiles. Clicking one opens the
// viewer on it, and the viewer pages through the rest. A tile whose image cannot
// load (a deleted object, a storage origin the browser blocks) shows its kind
// instead of a broken image.
const SHOWN = 4;

function Tile({ item, extra, onOpen }: { item: ContentMedia; extra?: number; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const video = item.kind === 'VIDEO';
  const src = video ? item.thumbnailUrl : (item.thumbnailUrl ?? item.url);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={video ? 'Play video full screen' : 'Open photo full screen'}
      data-testid="content-media"
      className="relative h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage is an arbitrary host
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span className="grid h-full w-full place-items-center text-xs text-muted-foreground" aria-hidden>
          {video ? 'Video' : 'Photo'}
        </span>
      )}
      {video && (
        <span className="absolute inset-0 grid place-items-center bg-black/30 text-white" aria-hidden>
          <Play className="h-4 w-4" fill="currentColor" />
        </span>
      )}
      {extra ? (
        <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold text-white" aria-hidden>
          +{extra}
        </span>
      ) : null}
    </button>
  );
}

export function MediaStrip({ items }: { items: ContentMedia[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (items.length === 0) return null;
  const hidden = items.length - SHOWN;
  return (
    <>
      <div className="flex gap-1.5" data-testid="content-media-strip">
        {items.slice(0, SHOWN).map((item, i) => (
          <Tile key={item.id} item={item} extra={i === SHOWN - 1 && hidden > 0 ? hidden : undefined} onOpen={() => setViewing(i)} />
        ))}
      </div>
      <PhotoViewer
        photos={items.map((m) => ({
          url: m.url,
          kind: m.kind === 'VIDEO' ? 'VIDEO' : undefined,
          poster: m.thumbnailUrl ?? undefined,
        }))}
        index={viewing ?? 0}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
      />
    </>
  );
}
