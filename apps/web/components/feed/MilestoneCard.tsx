import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import type { FeedItem } from '@/lib/types';
import { bleedCard, brandColor, cn, formatDate } from '@/lib/utils';

// A hasher passing 10, 50, 100 runs (D60). News, not a thing to like, so there is
// no bar under it. The hasher can switch these off in Privacy; the milestone
// stays on their Hash Passport either way.
export function MilestoneCard({ item }: { item: Extract<FeedItem, { kind: 'MILESTONE' }> }) {
  return (
    <Card className={cn(bleedCard, 'flex items-center gap-4 p-4')} data-testid="feed-milestone">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <Trophy className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">
          <Link href={`/hashers/${item.hasher.id}`} className="font-semibold hover:underline">
            {item.hasher.name}
          </Link>{' '}
          has run <span className="font-semibold">{item.threshold} trails</span>. On On!
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.run && (
            <>
              <Link href={`/runs/${item.run.id}`} className="text-primary-strong hover:underline">
                Run #{item.run.runNumber ?? '—'}
                {item.run.title ? ` · ${item.run.title}` : ''}
              </Link>
              {' · '}
            </>
          )}
          <time dateTime={item.at}>{formatDate(item.at)}</time>
        </p>
      </div>
      <Avatar
        name={item.hasher.name}
        size="md"
        src={item.hasher.avatarUrl}
        color={brandColor(item.kennel?.primaryColor)}
      />
    </Card>
  );
}
