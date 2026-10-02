'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ReelStrip } from '@/components/feed/ReelStrip';
import { ProfilePhotoGrid } from '@/components/profile/ProfilePhotoGrid';
import { FollowButton } from '@/components/social/FollowButton';
import { FollowLists } from '@/components/social/FollowLists';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { hasherCounts, listHasherPhotos } from '@/lib/social';
import type { Audience, FollowRelation, HasherPhoto, Page, Reel } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import api from '@/services/api';

// Everything on a hasher's page below their name (D57): the follow button and
// counts, then three tabs, Photos, Followers and Following, or the lock that
// keeps them back.
//
// The page around this is a Server Component served from the ISR cache with no
// session, so what it hands in is the anonymous view: all of it for a public
// profile, none of it for a locked one. Once the browser has a session it asks
// again, because a follower sees what a stranger does not, and a hasher sees all
// of their own. Until that answers, the server's version stands.

const PAGE = 24;

type Tab = 'photos' | 'followers' | 'following';

// `?tab=followers` opens the page on that tab, which is how the account page
// links to your own lists. Read with useSyncExternalStore so the server render
// (always Photos) and the first client render agree, and the right tab appears
// straight after: no effect, no hydration mismatch.
const noop = () => () => undefined;
function useTabFromUrl(): Tab {
  const raw = useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get('tab'),
    () => null,
  );
  return raw === 'followers' || raw === 'following' ? raw : 'photos';
}

export function HasherBody({
  hasherId,
  name,
  followers,
  following,
  joinedAt,
  profileVisibility,
  canSeeContent,
  initialPhotos,
  initialPhotoTotal,
  initialReels,
}: {
  hasherId: string;
  name: string;
  followers: number;
  following: number;
  joinedAt: string;
  profileVisibility: Audience;
  canSeeContent: boolean;
  initialPhotos: HasherPhoto[];
  initialPhotoTotal: number;
  initialReels: Reel[];
}) {
  const { user } = useAuth();
  const isMe = user?.id === hasherId;
  const fromUrl = useTabFromUrl();
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab = picked ?? fromUrl;
  // Live counts: the page was served from the ISR cache, so what it printed can
  // be a minute old, and your own page has no Follow button to correct it.
  const [counts, setCounts] = useState({ followers, following });
  // Changing this remounts the lists, so the follower list reloads with whoever
  // was just added or removed.
  const [version, setVersion] = useState(0);
  const amFollowing = useRef<boolean | null>(null);
  const [relation, setRelation] = useState<FollowRelation>('NONE');
  const [allowed, setAllowed] = useState(canSeeContent);
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialPhotoTotal);
  const [reels, setReels] = useState(initialReels);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef(1);

  // Your own page is always yours; otherwise it is what the server last said,
  // moved by what the follow button learns.
  const canSee = isMe || allowed || relation === 'FOLLOWING';
  // Only a locked profile moves with the relation; ONLY_ME stays shut even to a follower.
  const closed = profileVisibility === 'ONLY_ME' && !isMe;
  const visible = canSee && !closed;

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

  // Ask again once there is a session, and again when the viewer's standing
  // with this hasher changes (approved, unfollowed, followed a public one).
  // The answers are applied in the promise callback, not synchronously.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      listHasherPhotos(hasherId, 1, PAGE),
      api.get<{ data: Page<Reel> }>(`/reels?limit=15&authorId=${hasherId}`),
    ])
      .then(([grid, rail]) => {
        if (!alive) return;
        pageRef.current = 1;
        if (grid.locked) {
          setAllowed(false);
          setPhotos([]);
          setTotal(0);
          setReels([]);
        } else {
          setAllowed(true);
          setPhotos(grid.items);
          setTotal(grid.total);
          setReels(rail.data.data.items);
        }
      })
      // The server-rendered version stands; a failed refresh is not worth a toast.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, relation, hasherId]);

  async function more() {
    setLoading(true);
    try {
      const next = pageRef.current + 1;
      const grid = await listHasherPhotos(hasherId, next, PAGE);
      pageRef.current = next;
      setPhotos((current) => [...current, ...grid.items]);
      setTotal(grid.total);
    } catch {
      // Pressing it again retries.
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
      active ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <button
            type="button"
            className={cn('rounded-sm hover:text-foreground', visible ? 'cursor-pointer' : 'cursor-default')}
            onClick={() => visible && setPicked('followers')}
            data-testid="hasher-followers"
          >
            <span className="font-semibold text-foreground">{counts.followers}</span>{' '}
            {counts.followers === 1 ? 'follower' : 'followers'}
          </button>
          <button
            type="button"
            className={cn('rounded-sm hover:text-foreground', visible ? 'cursor-pointer' : 'cursor-default')}
            onClick={() => visible && setPicked('following')}
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
          onRelationChange={setRelation}
          onCountChange={(next, isFollowing) => {
            setCounts((current) => ({ ...current, followers: next }));
            const was = amFollowing.current;
            amFollowing.current = isFollowing;
            // The first report is the button learning the truth, not a change.
            if (was !== null && was !== isFollowing) setVersion((v) => v + 1);
          }}
        />
      </div>

      {visible ? (
        <div className="-mx-4 mt-4 border-t border-border sm:mx-0" data-testid="hasher-tabs-wrap">
          <div className="flex" role="tablist" aria-label="Profile">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'photos'}
              onClick={() => setPicked('photos')}
              className={tabClass(tab === 'photos')}
              data-testid="tab-photos"
            >
              Photos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'followers'}
              onClick={() => setPicked('followers')}
              className={tabClass(tab === 'followers')}
              data-testid="tab-followers"
            >
              {counts.followers} {counts.followers === 1 ? 'Follower' : 'Followers'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'following'}
              onClick={() => setPicked('following')}
              className={tabClass(tab === 'following')}
              data-testid="tab-following"
            >
              {counts.following} Following
            </button>
          </div>

          {tab === 'photos' ? (
            <div className="space-y-4 pt-4" data-testid="hasher-content">
              {reels.length > 0 && (
                <section className="px-4 sm:px-0">
                  <h2 className="pb-2 text-sm font-semibold text-muted-foreground">Reels</h2>
                  <ReelStrip key={reels.map((r) => r.id).join()} initial={reels} authorId={hasherId} />
                </section>
              )}
              <section aria-label="Photos">
                <ProfilePhotoGrid photos={photos} total={total} loading={loading} onMore={() => void more()} name={name} />
              </section>
            </div>
          ) : (
            <div className="px-4 pb-1 pt-3 sm:px-0">
              <FollowLists
                key={version + '-' + tab}
                hasherId={hasherId}
                followers={counts.followers}
                following={counts.following}
                only={tab}
                flat
                canRemove={isMe}
                onFollowerRemoved={() =>
                  setCounts((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }))
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div
          className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 pb-4 text-center"
          data-testid="profile-locked"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-foreground/70">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="text-base font-semibold">
            {closed ? `${name} keeps this profile to themself` : 'This profile is private'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {closed
              ? 'Their photos, posts and reels are only for them.'
              : relation === 'REQUESTED'
                ? `Your request is waiting for ${name} to approve it. You will see their photos, posts and reels once they do.`
                : user
                  ? `Follow ${name} to ask to see their photos, posts and reels.`
                  : `Sign in and follow ${name} to ask to see their photos, posts and reels.`}
          </p>
          {!user && (
            <Button asChild size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
