'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { ReelCarousel } from '@/components/feed/ReelCarousel';
import { EngagementBar } from '@/components/social/EngagementBar';
import type { Reel } from '@/lib/types';

// Watching a reel (D48). A reel is a post rather than a single clip — videos
// and photos together, in the order they were added — so this is a carousel:
// arrows, dots, arrow keys, and one item on screen at a time.

export function ReelViewer({
  reel,
  onArchive,
  archiving,
}: {
  reel: Reel;
  onArchive: () => void;
  archiving: boolean;
}) {
  if (reel.items.length === 0) return null;

  return (
    <DialogContent className="max-w-lg" title={reel.caption ?? `Reel by ${reel.author.name}`}>
      <div className="space-y-3">
        <ReelCarousel
          items={reel.items}
          alt={reel.caption ?? `Reel by ${reel.author.name}`}
          className="overflow-hidden rounded-lg"
          autoPlay
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={reel.author.name} size="sm" src={reel.author.avatarUrl} />
            <p className="text-sm">
              <Link href={`/hashers/${reel.author.id}`} className="font-medium hover:underline">
                {reel.author.name}
              </Link>
              {reel.kennel && (
                <>
                  {' · '}
                  <Link href={`/kennels/${reel.kennel.slug}`} className="text-primary-strong hover:underline">
                    {reel.kennel.shortName}
                  </Link>
                </>
              )}
              {reel.run && (
                <>
                  {' · '}
                  <Link href={`/runs/${reel.run.id}`} className="text-primary-strong hover:underline">
                    Run #{reel.run.runNumber ?? '—'}
                  </Link>
                </>
              )}
              <span className="block text-muted-foreground">
                {reel.viewCount} {reel.viewCount === 1 ? 'view' : 'views'}
              </span>
            </p>
          </div>
          {reel.isMine && (
            <Button variant="outline" size="sm" disabled={archiving} onClick={onArchive}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Archive
            </Button>
          )}
        </div>
        {reel.caption && <p className="text-sm">{reel.caption}</p>}

        {/* Likes, comments, reshares, saves and who has seen it (D50). The reel
            was fetched with a session, so its numbers already carry this
            viewer's own flags. */}
        <EngagementBar segment="reels" id={reel.id} initial={reel.engagement} viewerAware className="-mx-6 -mb-4" />
      </div>
    </DialogContent>
  );
}
