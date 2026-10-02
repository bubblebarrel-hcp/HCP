'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { ReelStrip } from '@/components/feed/ReelStrip';
import { ProfilePhotoGrid } from '@/components/profile/ProfilePhotoGrid';
import { HasherSocial } from '@/components/social/HasherSocial';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { listHasherPhotos } from '@/lib/social';
import type { Audience, FollowRelation, HasherPhoto, Page, Reel } from '@/lib/types';
import api from '@/services/api';

// Everything on a hasher's page below their name (D57): the follow button and
// counts, then either their photos and reels or the lock that keeps them back.
//
// The page around this is a Server Component served from the ISR cache with no
// session, so what it hands in is the anonymous view: all of it for a public
// profile, none of it for a locked one. Once the browser has a session it asks
// again, because a follower sees what a stranger does not, and a hasher sees all
// of their own. Until that answers, the server's version stands.

const PAGE = 24;

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

  return (
    <>
      <HasherSocial
        hasherId={hasherId}
        followers={followers}
        following={following}
        joinedAt={joinedAt}
        showLists={visible}
        onRelationChange={setRelation}
      />

      <div className="mt-4 -mx-4 border-t border-border sm:mx-0" />

      {visible ? (
        <div className="-mx-4 mt-0 space-y-4 sm:mx-0" data-testid="hasher-content">
          {reels.length > 0 && (
            <section className="px-4 pt-4 sm:px-0">
              <h2 className="pb-2 text-sm font-semibold text-muted-foreground">Reels</h2>
              <ReelStrip key={reels.map((r) => r.id).join()} initial={reels} authorId={hasherId} />
            </section>
          )}
          <section aria-label="Photos">
            <h2 className="px-4 pb-2 pt-1 text-sm font-semibold text-muted-foreground sm:px-0">Photos</h2>
            <ProfilePhotoGrid photos={photos} total={total} loading={loading} onMore={() => void more()} name={name} />
          </section>
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
