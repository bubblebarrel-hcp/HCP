'use client';
import { useEffect, useRef, useState } from 'react';
import { FollowButton } from '@/components/social/FollowButton';
import { FollowLists } from '@/components/social/FollowLists';
import { hasherCounts } from '@/lib/social';
import type { FollowRelation } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

// The follow half of a hasher's page (D50): the button, the counts and the two
// lists, kept in one client component so the number beside "followers" moves
// the moment the button is pressed.
//
// The profile above it stays a Server Component — the name, the picture and the
// kennels read without JavaScript, which is the point of that page.

export function HasherSocial({
  hasherId,
  followers,
  following,
  joinedAt,
  showLists = true,
  onRelationChange,
}: {
  hasherId: string;
  followers: number;
  following: number;
  joinedAt: string;
  // False on a profile this viewer is locked out of: the counts stay, because
  // they are on the profile's face, and the lists of who they are do not (D57).
  showLists?: boolean;
  onRelationChange?: (relation: FollowRelation) => void;
}) {
  const [counts, setCounts] = useState({ followers, following });
  // Changing this remounts the lists, so the follower list reloads with the
  // hasher who was just added or removed. Bumped only when the relationship
  // actually changes, never on the corrections below.
  const [version, setVersion] = useState(0);
  // The lists are long and the photos are what a profile is for, so the lists
  // stay closed until somebody presses a count (D57).
  const [open, setOpen] = useState<'followers' | 'following' | null>(null);
  const amFollowing = useRef<boolean | null>(null);

  // The page around this was served from the ISR cache, so its numbers can be a
  // minute old. On your own page there is no Follow button to correct them —
  // nobody follows themself — so the counts are asked for directly.
  useEffect(() => {
    let alive = true;
    hasherCounts(hasherId)
      .then((live) => {
        if (alive) setCounts(live);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [hasherId]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <button
            type="button"
            className={cn('rounded-sm hover:text-foreground', showLists ? 'cursor-pointer' : 'cursor-default')}
            onClick={() => showLists && setOpen((current) => (current === 'followers' ? null : 'followers'))}
            aria-expanded={showLists ? open === 'followers' : undefined}
            data-testid="hasher-followers"
          >
            <span className="font-semibold text-foreground">{counts.followers}</span>{' '}
            {counts.followers === 1 ? 'follower' : 'followers'}
          </button>
          <button
            type="button"
            className={cn('rounded-sm hover:text-foreground', showLists ? 'cursor-pointer' : 'cursor-default')}
            onClick={() => showLists && setOpen((current) => (current === 'following' ? null : 'following'))}
            aria-expanded={showLists ? open === 'following' : undefined}
            data-testid="hasher-following"
          >
            <span className="font-semibold text-foreground">{counts.following}</span> following
          </button>
          <span>
            Hashing here since <time dateTime={joinedAt}>{formatDate(joinedAt)}</time>
          </span>
        </p>
        <FollowButton
          kind="hasher"
          target={hasherId}
          initialFollowers={followers}
          showCount={false}
          onRelationChange={onRelationChange}
          onCountChange={(next, isFollowing) => {
            setCounts((current) => ({ ...current, followers: next }));
            const was = amFollowing.current;
            amFollowing.current = isFollowing;
            // The first report is the button learning the truth, not a change.
            if (was !== null && was !== isFollowing) setVersion((v) => v + 1);
          }}
        />
      </div>

      {showLists && open && (
        <div className="mt-3">
          <FollowLists
            key={`${version}-${open}`}
            initialTab={open}
            hasherId={hasherId}
            followers={counts.followers}
            following={counts.following}
            flat
          />
        </div>
      )}
    </>
  );
}
