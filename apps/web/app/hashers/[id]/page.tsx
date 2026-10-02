import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Avatar } from '@/components/Avatar';
import { ProfileBranding } from '@/components/profile/ProfileBranding';
import { Card } from '@/components/ui/card';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { HasherSocial } from '@/components/social/HasherSocial';
import { publicGet } from '@/lib/server-api';
import type { HasherProfile, Page, Reel } from '@/lib/types';
import { brandColor, cn } from '@/lib/utils';
import { ReelStrip } from '@/components/feed/ReelStrip';

// The public face of a hasher (D50). Public identity only (D11): the hash
// handle they were given, or "Just <firstName>" until the kennel names them —
// the picture they chose, their own words, and the kennels they run with.
// Biodata lives in PersonProfile and never appears here.
//
// A Server Component, so it reads and shares without JavaScript. The Follow
// button and the follower lists are the client parts, because they need a
// session this render does not have.

export const revalidate = 60;

async function load(id: string) {
  return publicGet<{ hasher: HasherProfile }>(`/hashers/${id}`).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'Hasher not found' };
  return {
    title: `${data.hasher.name} · HCP`,
    description: data.hasher.bio ?? `${data.hasher.name} on the Hash Community Platform.`,
  };
}

export default async function HasherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, reels] = await Promise.all([
    load(id),
    publicGet<Page<Reel>>(`/reels?limit=15&authorId=${id}`).catch(() => null),
  ]);
  if (!data) notFound();
  const hasher = data.hasher;

  return (
    <FeedLayout left={<LeftNav />}>
      <Card className="overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x">
        {/* Picture and banner, with their editing controls for the hasher
            themself: the same top as a kennel page (D37, D56). */}
        <ProfileBranding
          hasherId={hasher.id}
          name={hasher.name}
          color={hasher.homeKennel?.primaryColor}
          avatarUrl={hasher.avatarUrl}
          avatarPosition={hasher.avatarPosition}
          bannerUrl={hasher.bannerUrl}
          bannerPosition={hasher.bannerPosition}
          bannerClassName="h-32 sm:h-48"
        >
          <div className="min-w-0 flex-1 text-center sm:pb-2 sm:text-left">
            <h1 className="text-2xl font-semibold" data-testid="hasher-name">
              {hasher.name}
            </h1>
            {!hasher.isNamed && (
              // "Just <firstName>" is not a hash name; saying so is kinder than
              // letting it read as one (D11).
              <p className="text-sm text-muted-foreground">Not named yet — the kennel does that, in its own time.</p>
            )}
          </div>
        </ProfileBranding>
        <div className="px-4 pb-4">
          {hasher.bio && <p className="whitespace-pre-line leading-relaxed text-[15px]">{hasher.bio}</p>}

          {hasher.kennels.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Runs with</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {hasher.kennels.map((kennel) => (
                  <li key={kennel.slug}>
                    <Link
                      href={`/kennels/${kennel.slug}`}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm',
                        'transition-colors hover:bg-muted',
                      )}
                    >
                      <Avatar name={kennel.shortName} size="sm" color={brandColor(kennel.primaryColor)} className="h-5 w-5 text-[10px]" />
                      {kennel.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* The button, the counts and the two lists move together, so the
              number beside "followers" is right the instant it is pressed. */}
          <HasherSocial
            hasherId={hasher.id}
            followers={hasher.followers}
            following={hasher.following}
            joinedAt={hasher.joinedAt}
          />
        </div>
      </Card>

      <div className="mt-4 space-y-4">
        {(reels?.items.length ?? 0) > 0 && (
          <section>
            <h2 className="px-4 pb-2 text-sm font-semibold text-muted-foreground sm:px-0">Their reels</h2>
            <ReelStrip initial={reels?.items ?? []} authorId={hasher.id} />
          </section>
        )}
      </div>
    </FeedLayout>
  );
}
