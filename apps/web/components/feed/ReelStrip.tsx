'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Pin, Plus, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ReelComposer } from '@/components/feed/ReelComposer';
import { FEED_REFRESH_EVENT } from '@/components/feed/PullToRefresh';
import { Button } from '@/components/ui/button';
import { ReelViewer } from '@/components/feed/ReelViewer';
import { Dialog } from '@/components/ui/dialog';
import type { Reel } from '@/lib/types';
import { brandColor, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Reels (D41): the rail across the top of the feed. A hasher's own short video
// — at a run, at a meeting, or holding a beer at home.
//
// The server renders the public rail so it is there without JavaScript; once
// the browser has a session this asks again, because a member can see reels a
// visitor cannot.

// The ring around a reel is its media count: one arc per item in the reel, so
// a single photo is an unbroken circle and a seven-photo reel is seven arcs.
// Drawn as SVG because a CSS dashed border cannot be made to land on an exact
// number of segments.
function CountRing({ count }: { count: number }) {
  const r = 47;
  const circumference = 2 * Math.PI * r;
  const segments = Math.max(1, count);
  // A long reel would be all gap and no arc, so the gap shrinks as the count grows.
  const gap = segments === 1 ? 0 : Math.min(5, circumference / (segments * 3));
  const arc = (circumference - gap * segments) / segments;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      aria-hidden
    >
      {Array.from({ length: segments }, (_, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap={segments === 1 ? 'butt' : 'round'}
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeDashoffset={-(i * (arc + gap))}
        />
      ))}
    </svg>
  );
}

function Tile({ reel, onOpen }: { reel: Reel; onOpen: () => void }) {
  // A photo is its own cover. A video's cover is the frame grabbed when it was
  // posted (D41); a post that opens on a clip without one borrows the first photo
  // in it, then the clip's own first frame, and only then the play icon.
  const first = reel.items[0];
  const cover =
    first?.kind === 'PHOTO'
      ? first.url
      : (first?.posterUrl ?? reel.items.find((item) => item.kind === 'PHOTO')?.url ?? null);
  const firstVideo = cover ? null : (first?.kind === 'VIDEO' ? first.url : null);
  const where = reel.run
    ? `Run #${reel.run.runNumber ?? '—'}`
    : reel.event
      ? reel.event.title
      : (reel.kennel?.shortName ?? 'On On');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-24 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-28"
      data-testid="reel-tile"
      aria-label={`${reel.author.name}, ${where}, ${reel.itemCount} ${reel.itemCount === 1 ? 'item' : 'items'}`}
    >
      <span
        className="relative block h-24 w-24 text-primary sm:h-28 sm:w-28"
        data-testid="reel-tile-ring"
        data-item-count={reel.itemCount}
      >
        <CountRing count={reel.itemCount} />
        {/* On a profile, the reels the hasher pinned (D58) say so. */}
        {reel.pinned && (
          <span
            className="absolute -right-0.5 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-card"
            data-testid="reel-tile-pinned"
            title="Pinned to the profile"
          >
            <Pin className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <span
          className="absolute inset-[6px] block overflow-hidden rounded-full bg-muted"
          style={reel.kennel?.primaryColor ? { backgroundColor: brandColor(reel.kennel.primaryColor) ?? undefined } : undefined}
        >
          {cover ? (
            // Storage is an arbitrary host, so next/image would need every
            // deployment's domain configured up front.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : firstVideo ? (
            // A clip posted before poster frames existed has none stored, but the
            // browser can still show its first moment: metadata only, parked a
            // hair in so a fade from black does not become a black cover.
            <video
              src={`${firstVideo}#t=0.2`}
              preload="metadata"
              muted
              playsInline
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none h-full w-full object-cover"
              data-testid="reel-tile-frame"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-primary-foreground">
              <Video className="h-6 w-6" aria-hidden />
            </span>
          )}
        </span>
      </span>
      <span className="flex w-full items-center justify-center gap-1">
        <Avatar name={reel.author.name} size="sm" src={reel.author.avatarUrl} className="h-5 w-5 text-[9px]" />
        <span className="truncate text-xs text-muted-foreground group-hover:text-foreground">{reel.author.name}</span>
      </span>
      <span className="w-full truncate text-center text-[11px] text-muted-foreground">{where}</span>
    </button>
  );
}

// `authorId` narrows the rail to one hasher, which is what their profile page
// shows (D50). Without it the rail is everybody's.
export function ReelStrip({ initial, authorId }: { initial: Reel[]; authorId?: string }) {
  const { user } = useAuth();
  const [reels, setReels] = useState(initial);
  const [open, setOpen] = useState<Reel | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);

  const path = authorId ? `/reels?limit=15&authorId=${authorId}` : '/reels?limit=15';

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: { items: Reel[] } }>(path);
      setReels(res.data.data.items);
    } catch {
      // The server-rendered rail stays; a failed refresh is not worth a toast.
    }
  }, [path]);

  // A member can see reels a visitor cannot, so the rail is asked for again
  // once there is a session. The server-rendered list stands until it answers.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: { items: Reel[] } }>(path)
      .then((res) => {
        if (!cancelled) setReels(res.data.data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, path]);

  // A pull on the feed refreshes the rail with it (D46).
  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh);
  }, [load]);

  // A view is counted once per opening, by whoever is watching.
  useEffect(() => {
    if (!open) return;
    api.post(`/reels/${open.id}/views`).catch(() => undefined);
  }, [open]);

  // The author's own two acts on a reel (D58). Both change what the rail and
  // the profile show, so both reload it.
  async function remove(reel: Reel) {
    setBusy(true);
    try {
      await api.delete(`/reels/${reel.id}`);
      toast.success('Reel deleted.');
      setOpen(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete that reel'));
    } finally {
      setBusy(false);
    }
  }

  async function pin(reel: Reel, pinned: boolean) {
    setBusy(true);
    try {
      const res = pinned
        ? await api.post<{ data: { reel: Reel } }>(`/reels/${reel.id}/pin`)
        : await api.delete<{ data: { reel: Reel } }>(`/reels/${reel.id}/pin`);
      toast.success(pinned ? 'Pinned to your profile. It will not show in the rail.' : 'Unpinned.');
      // An unpinned reel past its day is gone, so there is nothing left to show.
      const after = res.data.data.reel;
      const spent = !after.pinned && after.expiresAt !== null && new Date(after.expiresAt).getTime() <= Date.now();
      setOpen(spent ? null : after);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, pinned ? 'Could not pin that reel' : 'Could not unpin that reel'));
    } finally {
      setBusy(false);
    }
  }

  if (reels.length === 0 && !user) return null;

  return (
    <section
      className="border-y border-border bg-card p-3 shadow-sm sm:rounded-xl sm:border-x"
      aria-label="Reels"
      data-testid="reel-strip"
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="text-sm font-semibold">Reels</h2>
        <Link href="/reels" className="text-xs font-medium text-primary-strong hover:underline">
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {user && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex w-24 shrink-0 flex-col items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-28"
            data-testid="reel-create"
          >
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/40 text-primary-strong sm:h-28 sm:w-28">
              <Plus className="h-7 w-7" aria-hidden />
            </span>
            <span className="text-xs font-medium">Post a reel</span>
          </button>
        )}
        {reels.map((reel) => (
          <Tile key={reel.id} reel={reel} onOpen={() => setOpen(reel)} />
        ))}
        {reels.length === 0 && (
          <p className="self-center px-2 text-sm text-muted-foreground">
            No reels yet. Yours would be the first.
          </p>
        )}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        {open && (
          <ReelViewer
            key={`${open.id}:${open.pinned}`}
            reel={open}
            deleting={busy}
            onDelete={() => void remove(open)}
            pinning={busy}
            onPin={(pinned) => void pin(open, pinned)}
          />
        )}
      </Dialog>

      <ReelComposer
        open={composing}
        onOpenChange={setComposing}
        onPosted={async () => {
          await load();
        }}
      />
    </section>
  );
}
