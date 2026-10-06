'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ReelComposer } from '@/components/feed/ReelComposer';
import { ReelsGrid } from '@/components/feed/ReelsGrid';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { Page, Reel } from '@/lib/types';
import api from '@/services/api';

// The reels shot at this run (D41), on its page and in its Run Capsule. A reel
// lasts 24 hours unless it was pinned to its author's profile (D58), so this is
// the run's fresh footage, not an archive: what is gone from here is gone
// everywhere, by the same rule as the rail. The API decides who may see each
// reel, and answers an empty list for somebody who may not see the run.
export function RunReels({
  runId,
  kennelId,
  canPost,
}: {
  runId: string;
  // The hosting kennel, offered as the reel's kennel to a member of it.
  kennelId?: string;
  // The run page lets somebody who is signed in post one from here. A capsule is a
  // memory, so it only lists.
  canPost?: boolean;
}) {
  const { user, loading } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Page<Reel> }>('/reels', { params: { runId, limit: 12 } });
      setReels(res.data.data.items);
    } catch {
      setReels([]);
    }
  }, [runId]);

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load, loading, user]);

  const mayPost = Boolean(canPost && user);
  if (reels.length === 0 && !mayPost) return null;

  return (
    <section aria-labelledby="run-reels" className="space-y-3" data-testid="run-reels">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <h2 id="run-reels" className="text-lg font-semibold">
          Reels from this run
        </h2>
        {mayPost && (
          <Button size="sm" variant="outline" onClick={() => setComposing(true)} data-testid="run-reel-post">
            <Plus className="h-4 w-4" aria-hidden />
            Post a reel
          </Button>
        )}
      </div>
      {reels.length > 0 ? (
        <ReelsGrid key={reels.map((r) => r.id).join()} initial={reels} query={`/reels?limit=12&runId=${runId}`} />
      ) : (
        <p className="px-4 text-sm text-muted-foreground sm:px-0">
          None yet. A reel posted from here stays on this run for a day, like every reel (one pinned to a profile lives there instead).
        </p>
      )}
      {mayPost && (
        <ReelComposer
          open={composing}
          onOpenChange={setComposing}
          onPosted={load}
          fixedRunId={runId}
          fixedKennelId={kennelId}
        />
      )}
    </section>
  );
}
