import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { ReelCarousel } from '@/components/feed/ReelCarousel';
import { EngagementBar } from '@/components/social/EngagementBar';
import { publicGet } from '@/lib/server-api';
import type { Reel } from '@/lib/types';
import { shareMetadata } from '@/lib/share-metadata';
import { brandColor, formatDate } from '@/lib/utils';

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
  // A private reel and a reel that never existed look the same from here, which
  // is the point: the API answers 404 for both.
  if (!data) notFound();
  const reel = data.reel;

  const where = reel.run
    ? { label: `Run #${reel.run.runNumber ?? '—'}${reel.run.title ? ` · ${reel.run.title}` : ''}`, href: `/runs/${reel.run.id}` }
    : reel.kennel
      ? { label: reel.kennel.shortName, href: `/kennels/${reel.kennel.slug}` }
      : null;

  return (
    <FeedLayout left={<LeftNav />}>
      <Card className="overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x" data-testid="reel-page">
        <div className="flex items-center gap-3 p-4">
          <Avatar
            name={reel.author.name}
            size="md"
            src={reel.author.avatarUrl}
            color={brandColor(reel.kennel?.primaryColor)}
          />
          <p className="min-w-0 flex-1 text-sm">
            <Link href={`/hashers/${reel.author.id}`} className="font-medium hover:underline">
              {reel.author.name}
            </Link>
            {where && (
              <>
                {' · '}
                <Link href={where.href} className="text-primary-strong hover:underline">
                  {where.label}
                </Link>
              </>
            )}
            {reel.publishedAt && (
              <span className="block text-muted-foreground">
                <time dateTime={reel.publishedAt}>{formatDate(reel.publishedAt)}</time>
              </span>
            )}
          </p>
        </div>

        {reel.caption && <p className="px-4 pb-3 text-[15px]">{reel.caption}</p>}

        {/* The carousel is the one client part: a post holds several items and
            moving between them needs the browser (D48). */}
        <ReelCarousel items={reel.items} alt={reel.caption ?? `Reel by ${reel.author.name}`} />

        <EngagementBar
          segment="reels"
          id={reel.id}
          initial={reel.engagement}
          authorId={reel.author.id}
          countViewOnMount
        />
      </Card>
    </FeedLayout>
  );
}
