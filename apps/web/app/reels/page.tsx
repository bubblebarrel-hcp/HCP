import type { Metadata } from 'next';
import { ReelsGrid } from '@/components/feed/ReelsGrid';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { publicGet } from '@/lib/server-api';
import type { Page, Reel } from '@/lib/types';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Reels',
  description: 'Short videos from hashers: on trail, at the Circle, at a meeting, or holding a beer at home.',
};

// Reels, newest first (D57). Signed out, the public ones; signed in, the hashers
// you follow and your own. The rail on the home page is the same list, cut
// short; this is where it goes when there is more than a rail's worth.
// Server-rendered, so it reads without JavaScript — the videos play on tap.
export default async function ReelsPage() {
  // 30 is the API's cap (listReelsQuery); asking for more is a 400, which this
  // page would quietly read as "no reels". Paging is the follow-up.
  const data = await publicGet<Page<Reel>>('/reels?limit=30').catch(() => null);
  const reels = data?.items ?? [];

  return (
    <FeedLayout left={<LeftNav />} wide>
      <div className="px-4 pb-4 sm:px-0">
        <h1 className="text-2xl font-bold tracking-tight">Reels</h1>
        <p className="text-muted-foreground">
          On trail, at the Circle, at a meeting, or holding a beer at home.
        </p>
      </div>

      <ReelsGrid initial={reels} />
    </FeedLayout>
  );
}
