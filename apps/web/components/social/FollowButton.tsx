'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Lock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  hasherFollowState,
  kennelFollowState,
  setFollowingHasher,
  setFollowingKennel,
} from '@/lib/social';
import type { FollowRelation } from '@/lib/types';
import { cn } from '@/lib/utils';

// Follow a hasher or a kennel (D50).
//
// The pages this sits on are Server Components rendered without a session
// (D42), so it cannot be told whether this reader already follows — it asks
// once the browser has one. Until then it renders as "Follow" and is disabled,
// which is the honest state rather than a button that flips under the cursor.
//
// Following a kennel is not joining it. The wording says so: "Follow", never
// "Join", which is what the membership button on the same page does.
//
// Following a hasher can take a yes (D57): on a locked profile the press sends a
// request, and the button says "Requested" until they answer. Pressing it then
// withdraws the request. A hasher who has closed to everybody shows no button
// that does anything, only the reason.

interface Props {
  kind: 'hasher' | 'kennel';
  // A hasher's id, or a kennel's slug.
  target: string;
  // The count the server already rendered, so the number is right before this
  // knows anything else.
  initialFollowers?: number;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg';
  // Told the new follower count after every change, so a page that prints the
  // number elsewhere does not go stale the moment this button is pressed. The
  // flag is whether the viewer is now actually following, which a pending
  // request is not.
  onCountChange?: (followers: number, following: boolean) => void;
  // Told where the viewer now stands with a hasher, for a page that shows or
  // hides things by it (the lock on a private profile).
  onRelationChange?: (relation: FollowRelation) => void;
  className?: string;
}

export function FollowButton({
  kind,
  target,
  initialFollowers,
  showCount = true,
  size = 'default',
  onCountChange,
  onRelationChange,
  className,
}: Props) {
  const { user, loading } = useAuth();
  const [relation, setRelation] = useState<FollowRelation>('NONE');
  const [followers, setFollowers] = useState(initialFollowers ?? 0);
  const [known, setKnown] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  // Held in refs so an inline callback from the parent cannot put this effect
  // in a loop: the parent re-renders when told a count, which would otherwise
  // make a new function identity and refetch.
  const report = useRef(onCountChange);
  const reportRelation = useRef(onRelationChange);
  useEffect(() => {
    report.current = onCountChange;
    reportRelation.current = onRelationChange;
  });

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    const read = kind === 'hasher' ? hasherFollowState(target) : kennelFollowState(target);
    read
      .then((state) => {
        if (!alive) return;
        const next: FollowRelation = state.relation ?? (state.following ? 'FOLLOWING' : 'NONE');
        setRelation(next);
        setFollowers(state.followers);
        setIsSelf(state.isSelf);
        setOpen(state.followsOpen !== false);
        setKnown(true);
        // The page around this may have been rendered from cache a minute ago
        // (D42's `revalidate`), so its printed count can be stale. This read is
        // live; hand it over.
        report.current?.(state.followers, next === 'FOLLOWING');
        reportRelation.current?.(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, target, user, loading]);

  // Nobody follows themself, so the button is simply not there on your own page.
  if (isSelf) return null;

  const following = relation === 'FOLLOWING';
  const requested = relation === 'REQUESTED';

  // The optimistic numbers are computed from the current value rather than
  // inside a state updater: React may run an updater twice, and telling the
  // page a count twice would double it.
  const apply = (count: number, next: FollowRelation) => {
    setFollowers(count);
    setRelation(next);
    onCountChange?.(count, next === 'FOLLOWING');
    reportRelation.current?.(next);
  };

  const toggle = async () => {
    const wantsOn = !following && !requested;
    const before = followers;
    const was = relation;

    if (kind === 'kennel') {
      // A kennel follow has no approval step, so it can be optimistic.
      apply(Math.max(0, before + (wantsOn ? 1 : -1)), wantsOn ? 'FOLLOWING' : 'NONE');
      setBusy(true);
      try {
        const answer = await setFollowingKennel(target, wantsOn);
        apply(answer, wantsOn ? 'FOLLOWING' : 'NONE');
        setKnown(true);
      } catch {
        apply(before, was);
      } finally {
        setBusy(false);
      }
      return;
    }

    // A hasher may ask for a yes first, so what happened is the server's to say.
    setBusy(true);
    try {
      const answer = await setFollowingHasher(target, wantsOn);
      apply(answer.followers, answer.relation);
      setKnown(true);
    } catch {
      // Put it back rather than showing a follow that did not happen.
      apply(before, was);
    } finally {
      setBusy(false);
    }
  };

  const signedOut = !user && !loading;

  // A closed profile has nothing to press.
  if (kind === 'hasher' && !open && !following && !requested) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Button type="button" size={size} variant="outline" disabled data-testid="follow-button">
          <Lock className="h-4 w-4" aria-hidden /> Not taking followers
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        type="button"
        size={size}
        variant={following || requested ? 'outline' : 'default'}
        disabled={busy || signedOut || (Boolean(user) && !known)}
        onClick={toggle}
        aria-pressed={following || requested}
        title={
          signedOut ? 'Sign in to follow' : requested ? 'Press to withdraw your request' : undefined
        }
        data-testid="follow-button"
        data-relation={relation}
      >
        {following ? (
          <>
            <Check className="h-4 w-4" aria-hidden /> Following
          </>
        ) : requested ? (
          <>
            <Clock className="h-4 w-4" aria-hidden /> Requested
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden /> Follow
          </>
        )}
      </Button>
      {showCount && followers > 0 && (
        <span className="text-sm text-muted-foreground" data-testid="follower-count">
          {followers} {followers === 1 ? 'follower' : 'followers'}
        </span>
      )}
    </div>
  );
}
