import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { ReelCarousel } from '@/components/feed/ReelCarousel';
import { EngagementBar } from '@/components/social/EngagementBar';
import type { Reel } from '@/lib/types';
import { brandColor, formatDate } from '@/lib/utils';

// One reel, as its own page shows it. Shared between the server-rendered page and
// the signed-in fallback that opens a reel the anonymous render could not (D57),
// so a follower sees exactly what a visitor to a public reel does.
export function ReelDetail({ reel }: { reel: Reel }) {
  const where = reel.run
    ? { label: `Run #${reel.run.runNumber ?? '—'}${reel.run.title ? ` · ${reel.run.title}` : ''}`, href: `/runs/${reel.run.id}` }
    : reel.kennel
      ? { label: reel.kennel.shortName, href: `/kennels/${reel.kennel.slug}` }
      : null;

  return (
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
  );
}
