'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { ReelCarousel } from '@/components/feed/ReelCarousel';
import { EngagementBar } from '@/components/social/EngagementBar';
import { AudiencePicker } from '@/components/profile/AudiencePicker';
import type { Audience, Reel } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

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
  // Whoever posted it can change who sees it, any time after (D57).
  const [audience, setAudience] = useState<Audience>(reel.visibility);
  const [saving, setSaving] = useState(false);

  async function changeAudience(next: Audience) {
    const before = audience;
    setAudience(next);
    setSaving(true);
    try {
      await api.patch(`/reels/${reel.id}`, { visibility: next });
      toast.success('Who can watch this reel is updated.');
    } catch (err) {
      setAudience(before);
      toast.error(errorMessage(err, 'Could not change who can watch it'));
    } finally {
      setSaving(false);
    }
  }

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

        {reel.isMine && (
          <div className="space-y-1.5" data-testid="reel-audience">
            <p className="text-sm font-medium leading-none">Who can watch it</p>
            <AudiencePicker kind="reel" value={audience} onChange={(next) => void changeAudience(next)} disabled={saving} compact />
          </div>
        )}

        {/* Likes, comments, reshares, saves and who has seen it (D50). The reel
            was fetched with a session, so its numbers already carry this
            viewer's own flags. */}
        <EngagementBar segment="reels" id={reel.id} initial={reel.engagement} viewerAware className="-mx-6 -mb-4" />
      </div>
    </DialogContent>
  );
}
