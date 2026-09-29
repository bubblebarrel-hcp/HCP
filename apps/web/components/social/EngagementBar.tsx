'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Eye, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react';
import { CommentThread } from '@/components/social/CommentThread';
import { ShareDialog } from '@/components/social/ShareDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { countView, getEngagement, setBookmarked, setLiked, reshare, unreshare } from '@/lib/social';
import type { Engagement, SubjectSegment } from '@/lib/types';
import { cn } from '@/lib/utils';

// The bar under a piece of content: like, comment, reshare, save, seen (D50).
//
// The numbers arrive with the card wherever the server can supply them, so this
// renders correct from the first paint and only asks the API again when it has
// to — a card rendered by a Server Component for a signed-in reader cannot know
// what that reader has already liked, because the public render has no session.
//
// Every press is optimistic and then reconciled with what the server says, so a
// double-press cannot drift the count: the server's number wins.

interface Props {
  segment: SubjectSegment;
  id: string;
  initial: Engagement;
  // True when `initial` was produced for this viewer and already carries their
  // own flags. False for a publicly cached render, which has to ask again.
  viewerAware?: boolean;
  // Shown on reels and capsules, hidden on a run announcement where "seen by"
  // is not the point.
  showViews?: boolean;
  // Set on a page that IS the content (a report, a capsule). A feed card is not
  // a view of the thing it links to.
  countViewOnMount?: boolean;
  // Who made the thing, when the card already knows. Resharing your own post is
  // refused by the API, so the button is not offered for it.
  authorId?: string | null;
  className?: string;
}

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return <span className="tabular-nums">{value > 999 ? `${(value / 1000).toFixed(1)}k` : value}</span>;
}

export function EngagementBar({
  segment,
  id,
  initial,
  viewerAware = false,
  showViews = true,
  countViewOnMount = false,
  authorId,
  className,
}: Props) {
  const { user, loading } = useAuth();
  const [engagement, setEngagement] = useState(initial);
  const [openComments, setOpenComments] = useState(false);
  const [composing, setComposing] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A card rendered without a session carries nobody's own flags, and a page
  // rendered on the client starts with nothing at all. Either way, ask once —
  // signed out too, because the counts themselves are public.
  useEffect(() => {
    if (loading || viewerAware) return;
    let alive = true;
    getEngagement(segment, id)
      .then((fresh) => {
        if (!alive) return;
        setEngagement(fresh);
        setMine(fresh.isMine);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [segment, id, user, loading, viewerAware]);

  // Opening the page is the view. Counted once per signed-in viewer; an
  // anonymous open is a raw tally, because deduping it would mean
  // fingerprinting somebody who has not said who they are (D50).
  useEffect(() => {
    if (!countViewOnMount || loading) return;
    countView(segment, id);
  }, [countViewOnMount, segment, id, loading]);

  const act = useCallback(
    async (optimistic: Engagement, run: () => Promise<Engagement>) => {
      const previous = engagement;
      setError(null);
      setEngagement(optimistic);
      setBusy(true);
      try {
        setEngagement(await run());
      } catch {
        // Put the numbers back rather than leaving a like that never happened.
        setEngagement(previous);
        setError('That did not go through.');
      } finally {
        setBusy(false);
      }
    },
    [engagement],
  );

  const signedOut = !user && !loading;
  // Known from the card, or from the engagement read once it lands.
  const isMine = mine || Boolean(user && authorId && authorId === user.id);

  const onLike = () => {
    const next = !engagement.liked;
    void act({ ...engagement, liked: next, likes: engagement.likes + (next ? 1 : -1) }, () =>
      setLiked(segment, id, next),
    );
  };

  const onBookmark = () => {
    const next = !engagement.bookmarked;
    void act({ ...engagement, bookmarked: next, bookmarks: engagement.bookmarks + (next ? 1 : -1) }, () =>
      setBookmarked(segment, id, next),
    );
  };

  // Resharing opens a box rather than a browser prompt: the quote is the point
  // of a quote reshare, and a native dialog cannot be styled or dismissed with
  // the keyboard the way the rest of this app can.
  const onReshare = () => {
    if (engagement.reshared) {
      void act({ ...engagement, reshared: false, reshares: Math.max(0, engagement.reshares - 1) }, () =>
        unreshare(segment, id),
      );
      return;
    }
    setComposing((open) => !open);
  };

  const submitReshare = () => {
    const quote = commentary.trim();
    setComposing(false);
    setCommentary('');
    void act({ ...engagement, reshared: true, reshares: engagement.reshares + 1 }, () =>
      reshare(segment, id, quote || null),
    );
  };

  const buttonClass = 'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50';

  return (
    <div className={cn('border-t border-border', className)} data-testid="engagement-bar">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={onLike}
          disabled={busy || signedOut}
          aria-pressed={engagement.liked}
          aria-label={engagement.liked ? 'Unlike' : 'Like'}
          title={signedOut ? 'Sign in to like' : undefined}
          className={cn(buttonClass, engagement.liked && 'text-primary-strong font-medium')}
          data-testid="engagement-like"
        >
          <Heart className={cn('h-4 w-4', engagement.liked && 'fill-current')} aria-hidden />
          <Count value={engagement.likes} />
        </button>

        <button
          type="button"
          onClick={() => setOpenComments((open) => !open)}
          aria-expanded={openComments}
          className={cn(buttonClass, openComments && 'font-medium')}
          data-testid="engagement-comment"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          <Count value={engagement.comments} />
        </button>

        {/* Resharing your own post is refused by the API, so it is not offered
            — a button that can only fail is worse than no button. */}
        {isMine ? (
          engagement.reshares > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground">
              <Repeat2 className="h-4 w-4" aria-hidden />
              <Count value={engagement.reshares} />
            </span>
          )
        ) : (
          <button
            type="button"
            onClick={onReshare}
            disabled={busy || signedOut}
            aria-pressed={engagement.reshared}
            aria-label={engagement.reshared ? 'Undo reshare' : 'Reshare'}
            title={signedOut ? 'Sign in to reshare' : undefined}
            className={cn(buttonClass, engagement.reshared && 'text-trail font-medium')}
            data-testid="engagement-reshare"
          >
            <Repeat2 className="h-4 w-4" aria-hidden />
            <Count value={engagement.reshares} />
          </button>
        )}

        {/* Sending the link out of HCP. Next to Reshare because they read as
            the same gesture, but they are not: Reshare puts it in the hash's
            own feed, this puts a URL in WhatsApp. Needs no session — a link is
            a link. */}
        <ShareDialog
          segment={segment}
          id={id}
          trigger={
            <button type="button" aria-label="Share" className={buttonClass} data-testid="engagement-share">
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
          }
        />

        <button
          type="button"
          onClick={onBookmark}
          disabled={busy || signedOut}
          aria-pressed={engagement.bookmarked}
          aria-label={engagement.bookmarked ? 'Remove from saved' : 'Save'}
          title={signedOut ? 'Sign in to save' : undefined}
          className={cn(buttonClass, 'ml-auto', engagement.bookmarked && 'text-accent-strong font-medium')}
          data-testid="engagement-bookmark"
        >
          <Bookmark className={cn('h-4 w-4', engagement.bookmarked && 'fill-current')} aria-hidden />
        </button>

        {showViews && engagement.views > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground"
            title={`Seen by ${engagement.views}`}
          >
            <Eye className="h-4 w-4" aria-hidden />
            <Count value={engagement.views} />
          </span>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-sm text-destructive">{error}</p>}

      {composing && (
        <div className="border-t border-border px-4 py-3">
          <label htmlFor={`reshare-${id}`} className="text-sm font-medium">
            Pass it on
          </label>
          <textarea
            id={`reshare-${id}`}
            value={commentary}
            onChange={(event) => setCommentary(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Say something about it, or leave this blank."
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="reshare-commentary"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={submitReshare} disabled={busy} data-testid="reshare-submit">
              Reshare
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {openComments && (
        <CommentThread
          segment={segment}
          id={id}
          onCountChange={(comments) => setEngagement((current) => ({ ...current, comments }))}
        />
      )}
    </div>
  );
}
