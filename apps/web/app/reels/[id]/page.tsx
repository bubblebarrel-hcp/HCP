import type { Metadata } from 'next';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { ReelDetail } from '@/components/feed/ReelDetail';
import { SignedInDetail } from '@/components/feed/SignedInDetail';
import { publicGet } from '@/lib/server-api';
import type { Reel } from '@/lib/types';
import { shareMetadata } from '@/lib/share-metadata';

// One reel, at its own address (D50). It exists because a reel is the most
// shareable thing on HCP and a share needs somewhere to land: `/reels?reel=<id>`
// used to be the link a notification carried, and the reels grid ignored the
// query, so it landed on the grid instead of the reel.
//
// Server-rendered, so a link pasted into WhatsApp opens something readable
// without JavaScript and carries a real title.

export const revalidate = 60;

async function load(id: string) {
  return publicGet<{ reel: Reel }>(`/reels/${id}`).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  // Null is both 'no such reel' and 'not yours to see'. Neither says which.
  if (!data) return shareMetadata({ title: 'Reel', description: 'A reel on the Hash Community Platform.' });
  const reel = data.reel;
  const where = reel.kennel?.shortName ?? reel.event?.title ?? 'the hash';
  return shareMetadata({
    title: reel.caption?.slice(0, 70) || `A reel by ${reel.author.name}`,
    description: `${reel.author.name} at ${where} on the Hash Community Platform.`,
    // A video still has no frame grab (D41), so the preview borrows the cover
    // photo if the post has one and shows no picture otherwise.
    image: reel.items.find((item) => item.kind === 'PHOTO')?.url ?? reel.items[0]?.posterUrl,
  });
}

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  // The anonymous render cannot open a reel that is for followers only, so a
  // signed-in reader gets a second chance from the browser (D57). A private reel
  // and a reel that never existed look the same, which is the point.
  return (
    <FeedLayout left={<LeftNav />}>
      {data ? <ReelDetail reel={data.reel} /> : <SignedInDetail kind="reel" id={id} />}
    </FeedLayout>
  );
}
