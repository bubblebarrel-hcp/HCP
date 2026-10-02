'use client';

import Link from 'next/link';
import { Film, Loader2, Mountain, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HasherPhoto } from '@/lib/types';

// The photo grid on a hasher's page (D57): square tiles, three across, the way a
// profile reads on a phone. Each tile opens what the picture is on: the post, the
// reel or the run, since a photo has no page of its own.

const HREF: Record<HasherPhoto['source']['type'], string> = {
  POST: '/posts',
  REEL: '/reels',
  RUN: '/runs',
};

const WHERE: Record<HasherPhoto['source']['type'], string> = {
  POST: 'a post',
  REEL: 'a reel',
  RUN: 'a run',
};

function SourceBadge({ type }: { type: HasherPhoto['source']['type'] }) {
  const Icon = type === 'REEL' ? Film : type === 'RUN' ? Mountain : StickyNote;
  return (
    <span
      className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      aria-hidden
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function ProfilePhotoGrid({
  photos,
  total,
  loading,
  onMore,
  name,
}: {
  photos: HasherPhoto[];
  total: number;
  loading: boolean;
  onMore: () => void;
  name: string;
}) {
  if (photos.length === 0) {
    return (
      <p
        className="border-y border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground sm:rounded-xl sm:border-x"
        data-testid="photo-grid-empty"
      >
        {loading ? 'Loading photos…' : `${name} has not posted any photos yet.`}
      </p>
    );
  }

  return (
    <div data-testid="photo-grid">
      <ul className="grid grid-cols-3 gap-0.5 sm:gap-1">
        {photos.map((photo) => (
          <li key={photo.id} className="group relative aspect-square overflow-hidden bg-muted sm:rounded-sm">
            <Link
              href={`${HREF[photo.source.type]}/${photo.source.id}`}
              className="block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              aria-label={`${photo.caption ?? 'A photo'}, on ${WHERE[photo.source.type]}`}
              data-testid="photo-tile"
            >
              {/* Storage is an arbitrary host, so next/image would need every
                  deployment's domain configured up front. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnailUrl ?? photo.url}
                alt={photo.caption ?? ''}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
              <SourceBadge type={photo.source.type} />
            </Link>
          </li>
        ))}
      </ul>
      {photos.length < total && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" size="sm" onClick={onMore} disabled={loading} data-testid="photo-grid-more">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
