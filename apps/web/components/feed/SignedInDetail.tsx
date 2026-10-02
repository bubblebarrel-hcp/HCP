'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { PostDetail } from '@/components/feed/PostDetail';
import { ReelDetail } from '@/components/feed/ReelDetail';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { HasherPost, Reel } from '@/lib/types';
import api from '@/services/api';

// A reel or post the anonymous server render could not open (D57).
//
// The detail pages are served from the cache with no session, so something only
// a hasher's followers may see comes back as "not found" to them. A follower
// opening it from a link still has to be able to read it, so this asks again
// from the browser, with their session, and shows it if the API says they may.
// If it does not, they get the same plain answer a stranger would: the API
// answers 404 for "private" and "never existed" alike, and so does this.

export function SignedInDetail({ kind, id }: { kind: 'reel' | 'post'; id: string }) {
  const { user, loading } = useAuth();
  const [reel, setReel] = useState<Reel | null>(null);
  const [post, setPost] = useState<HasherPost | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    const path = kind === 'reel' ? `/reels/${id}` : `/posts/${id}`;
    api
      .get<{ data: { reel?: Reel; post?: HasherPost } }>(path)
      .then((res) => {
        if (!alive) return;
        setReel(res.data.data.reel ?? null);
        setPost(res.data.data.post ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setDone(true);
      });
    return () => {
      alive = false;
    };
  }, [kind, id, user, loading]);

  if (reel) return <ReelDetail reel={reel} />;
  if (post) return <PostDetail post={post} />;

  const waiting = loading || (Boolean(user) && !done);
  return (
    <div
      className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center"
      data-testid="detail-unavailable"
      aria-busy={waiting}
    >
      <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-foreground/70">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">{waiting ? 'Opening…' : 'Not available'}</h1>
      {!waiting && (
        <p className="text-sm text-muted-foreground">
          {user
            ? 'It may belong to a private profile you do not follow yet, or it may not exist.'
            : 'It may belong to a private profile. Sign in to see it if you follow them.'}
        </p>
      )}
      {!waiting && !user && (
        <Button asChild size="sm">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      )}
    </div>
  );
}
