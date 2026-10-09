'use client';

import { useEffect, useState } from 'react';
import { PostDetail } from '@/components/feed/PostDetail';
import { useAuth } from '@/context/AuthContext';
import type { HasherPost, Page } from '@/lib/types';
import api from '@/services/api';

// What hashers have written about this run (D60): posts they tagged to it. The
// API decides who may see each one, and refuses the whole list for somebody who
// may not see the run, so this shows nothing at all in that case.
export function RunPosts({ runId }: { runId: string }) {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<HasherPost[]>([]);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api
      .get<{ data: Page<HasherPost> }>('/posts', { params: { runId, limit: 10 } })
      .then((res) => alive && setPosts(res.data.data.items))
      .catch(() => alive && setPosts([]));
    return () => {
      alive = false;
    };
  }, [runId, user, loading]);

  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="run-posts" className="space-y-3" data-testid="run-posts">
      <h2 id="run-posts" className="px-4 text-lg font-semibold sm:px-0">
        What hashers are saying
      </h2>
      {posts.map((post) => (
        <PostDetail key={post.id} post={post} clamp />
      ))}
    </section>
  );
}
