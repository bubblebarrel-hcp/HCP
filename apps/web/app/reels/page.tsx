import type { Metadata } from 'next';
import Link from 'next/link';
import { Video } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { publicGet } from '@/lib/server-api';
import type { Page, Reel } from '@/lib/types';
import { brandColor } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Reels',
  description: 'Short videos from hashers: on trail, at the Circle, at a meeting, or holding a beer at home.',
};

// Every public reel, newest first. The rail on the home page is the same list,
// cut short; this is where it goes when there is more than a rail's worth.
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

      {reels.length === 0 ? (
        <p className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x">
          No reels yet. Yours would be the first.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-0 lg:grid-cols-4" data-testid="reels-grid">
          {reels.map((reel) => (
            <li key={reel.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {reel.items[0]?.kind === 'VIDEO' ? (
                <video
                  src={reel.items[0].url}
                  poster={reel.items[0].posterUrl ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  className="aspect-[3/4] w-full bg-black object-cover"
                />
              ) : reel.items[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reel.items[0].url}
                  alt={reel.caption ?? `Reel by ${reel.author.name}`}
                  loading="lazy"
                  className="aspect-[3/4] w-full bg-black object-cover"
                />
              ) : (
                <span
                  className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground"
                  style={
                    reel.kennel?.primaryColor
                      ? { backgroundColor: brandColor(reel.kennel.primaryColor) ?? undefined }
                      : undefined
                  }
                >
                  <Video className="h-6 w-6" aria-hidden />
                </span>
              )}
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={reel.author.name} size="sm" src={reel.author.avatarUrl} className="h-6 w-6 text-[10px]" />
                  <span className="truncate text-sm font-medium">{reel.author.name}</span>
                </div>
                {reel.itemCount > 1 && (
                  <p className="text-xs text-muted-foreground">{reel.itemCount} in this one</p>
                )}
                {reel.caption && <p className="line-clamp-2 text-sm text-muted-foreground">{reel.caption}</p>}
                {reel.kennel && (
                  <Link
                    href={`/kennels/${reel.kennel.slug}`}
                    className="block truncate text-xs font-medium text-primary-strong hover:underline"
                  >
                    {reel.kennel.shortName}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </FeedLayout>
  );
}
