'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Pin, PinOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { ReelCarousel } from '@/components/feed/ReelCarousel';
import { EngagementBar } from '@/components/social/EngagementBar';
import { RichText } from '@/components/social/RichText';
import { AudiencePicker } from '@/components/profile/AudiencePicker';
import type { Audience, Reel } from '@/lib/types';
import { cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Watching a reel (D48). A reel is a post rather than a single clip — videos
// and photos together, in the order they were added — so this is a carousel:
// arrows, dots, arrow keys, and one item on screen at a time.

// How long a reel has left (D58), in the unit a person would say it in.
function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function ReelViewer({
  reel,
  onDelete,
  deleting,
  onPin,
  pinning,
}: {
  reel: Reel;
  onDelete: () => void;
  deleting: boolean;
  // Pin it to the profile (and off the feeds), or hand it back to the 24 hours.
  onPin: (pinned: boolean) => void;
  pinning: boolean;
}) {
  // Deleting is final and unpinning an old reel ends it on the spot, so both ask
  // first, in the viewer rather than in a browser prompt.
  const [confirming, setConfirming] = useState<'delete' | 'unpin' | null>(null);
  const spent = !reel.pinned || !reel.publishedAt ? false : Date.now() - new Date(reel.publishedAt).getTime() > 24 * 60 * 60 * 1000;
  const working = deleting || pinning;
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={working}
                onClick={() => (reel.pinned ? (spent ? setConfirming('unpin') : onPin(false)) : onPin(true))}
                data-testid={reel.pinned ? 'reel-unpin' : 'reel-pin'}
              >
                {pinning ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : reel.pinned ? (
                  <PinOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Pin className="h-4 w-4" aria-hidden />
                )}
                {reel.pinned ? 'Unpin' : 'Pin to profile'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={working}
                onClick={() => setConfirming('delete')}
                data-testid="reel-delete"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            </div>
          )}
        </div>

        {confirming && (
          <div
            className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
            role="alertdialog"
            aria-label={confirming === 'delete' ? 'Delete this reel?' : 'Unpin this reel?'}
            data-testid="reel-confirm"
          >
            <p>
              {confirming === 'delete'
                ? 'Delete this reel? It disappears for everyone, along with its likes and comments. This cannot be undone.'
                : 'This reel was posted more than 24 hours ago. Once unpinned it expires and disappears for everyone.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={working}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={working}
                onClick={() => {
                  const which = confirming;
                  setConfirming(null);
                  if (which === 'delete') onDelete();
                  else onPin(false);
                }}
                data-testid="reel-confirm-yes"
              >
                {confirming === 'delete' ? 'Delete reel' : 'Unpin and expire'}
              </Button>
            </div>
          </div>
        )}

        {reel.caption && (
          <p className="text-sm">
            <RichText text={reel.caption} />
          </p>
        )}

        {/* The reel's lifespan (D58), told to the person who made it. */}
        {reel.isMine && (
          <p
            className={cn('flex items-center gap-1.5 text-xs', reel.pinned ? 'text-primary-strong' : 'text-muted-foreground')}
            data-testid="reel-lifespan"
          >
            {reel.pinned ? (
              <>
                <Pin className="h-3.5 w-3.5" aria-hidden /> Pinned to your profile. It stays up and shows only there.
              </>
            ) : reel.expiresAt ? (
              <>Disappears in {timeLeft(reel.expiresAt)}. Pin it to keep it on your profile.</>
            ) : null}
          </p>
        )}

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
