'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  hasherFollowState,
  kennelFollowState,
  setFollowingHasher,
  setFollowingKennel,
} from '@/lib/social';
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
  // number elsewhere does not go stale the moment this button is pressed.
  onCountChange?: (followers: number, following: boolean) => void;
  className?: string;
}

export function FollowButton({
  kind,
  target,
  initialFollowers,
  showCount = true,
  size = 'default',
  onCountChange,
  className,
}: Props) {
  const { user, loading } = useAuth();
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(initialFollowers ?? 0);
  const [known, setKnown] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [busy, setBusy] = useState(false);

  // Held in a ref so an inline callback from the parent cannot put this effect
  // in a loop: the parent re-renders when told a count, which would otherwise
  // make a new function identity and refetch.
  const report = useRef(onCountChange);
  report.current = onCountChange;

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    const read = kind === 'hasher' ? hasherFollowState(target) : kennelFollowState(target);
    read
      .then((state) => {
        if (!alive) return;
        setFollowing(state.following);
        setFollowers(state.followers);
        setIsSelf(state.isSelf);
        setKnown(true);
        // The page around this may have been rendered from cache a minute ago
        // (D42's `revalidate`), so its printed count can be stale. This read is
        // live; hand it over.
        report.current?.(state.followers, state.following);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, target, user, loading]);

  // Nobody follows themself, so the button is simply not there on your own page.
  if (isSelf) return null;

  // The optimistic numbers are computed from the current value rather than
  // inside a state updater: React may run an updater twice, and telling the
  // page a count twice would double it.
  const apply = (count: number, isFollowing: boolean) => {
    setFollowers(count);
    setFollowing(isFollowing);
    onCountChange?.(count, isFollowing);
  };

  const toggle = async () => {
    const next = !following;
    const before = followers;
    apply(Math.max(0, before + (next ? 1 : -1)), next);
    setBusy(true);
    try {
      const count = kind === 'hasher'
        ? await setFollowingHasher(target, next)
        : await setFollowingKennel(target, next);
      apply(count, next);
      setKnown(true);
    } catch {
      // Put it back rather than showing a follow that did not happen.
      apply(before, !next);
    } finally {
      setBusy(false);
    }
  };

  const signedOut = !user && !loading;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        type="button"
        size={size}
        variant={following ? 'outline' : 'default'}
        disabled={busy || signedOut || (Boolean(user) && !known)}
        onClick={toggle}
        aria-pressed={following}
        title={signedOut ? 'Sign in to follow' : undefined}
        data-testid="follow-button"
      >
        {following ? (
          <>
            <Check className="h-4 w-4" aria-hidden /> Following
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
