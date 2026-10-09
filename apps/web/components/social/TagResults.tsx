'use client';

import { useEffect, useState } from 'react';
import { PostDetail } from '@/components/feed/PostDetail';
import { ReelsGrid } from '@/components/feed/ReelsGrid';
import { useAuth } from '@/context/AuthContext';
import type { HasherPost, Page, Reel } from '@/lib/types';
import api from '@/services/api';

// What is under a hashtag (D59). The server rendered the public view, which is
// all a signed-out reader gets. Signed in, the page asks again: a post for
// followers only is under its tags for the followers and for nobody else, and
// that is the API's decision, never this page's.
export function TagResults({
  tag,
  initialPosts,
  initialReels,
}: {
  tag: string;
  initialPosts: HasherPost[];
  initialReels: Reel[];
}) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: Page<HasherPost> }>('/posts', { params: { tag, limit: 30 } })
      .then((res) => {
        if (!cancelled) setPosts(res.data.data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, tag]);

  const nothing = posts.length === 0 && initialReels.length === 0;

  return (
    <div className="space-y-4" data-testid="tag-results">
      {posts.length > 0 && (
        <section aria-label={`Posts tagged #${tag}`} className="space-y-4" data-testid="tag-posts">
          {posts.map((post) => (
            <PostDetail key={post.id} post={post} clamp />
          ))}
        </section>
      )}

      {(initialReels.length > 0 || user) && (
        <section aria-label={`Reels tagged #${tag}`}>
          <ReelsGrid
            initial={initialReels}
            query={`/reels?limit=30&tag=${encodeURIComponent(tag)}`}
            emptyText={posts.length > 0 ? 'No reels carry this tag right now. Reels last a day.' : undefined}
          />
        </section>
      )}

      {nothing && !user && (
        <p
          className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x"
          data-testid="tag-empty"
        >
          Nothing public is tagged #{tag} yet.
        </p>
      )}
    </div>
  );
}
