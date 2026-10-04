import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Hash } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { TagResults } from '@/components/social/TagResults';
import { Card } from '@/components/ui/card';
import { normalizeTag } from '@/lib/entities';
import { publicGet } from '@/lib/server-api';
import type { HasherPost, Page, Reel } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';

// Everything carrying a #hashtag (D59). A Server Component for what anybody can
// read, so a tag shared as a link renders without JavaScript; the signed-in
// reader's own view (their followers-only posts, their followed hashers' reels)
// is filled in by TagResults, because this render has no session.

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const tag = normalizeTag((await params).tag);
  if (!tag) return { title: 'Tag not found' };
  return {
    title: `#${tag}`,
    description: `Posts and reels tagged #${tag} on Shiggy Trails.`,
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = normalizeTag((await params).tag);
  if (!tag) notFound();

  const [posts, reels] = await Promise.all([
    publicGet<Page<HasherPost>>(`/posts?limit=30&tag=${encodeURIComponent(tag)}`).catch(() => null),
    publicGet<Page<Reel>>(`/reels?limit=30&tag=${encodeURIComponent(tag)}`).catch(() => null),
  ]);

  return (
    <FeedLayout left={<LeftNav />}>
      <Card className={cn(bleedCard, 'mb-4 flex items-center gap-3 p-5')}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-strong">
          <Hash className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight" data-testid="tag-title">
            #{tag}
          </h1>
          <p className="text-sm text-muted-foreground">
            What hashers have tagged with it. You see what you could see anywhere else on Shiggy Trails.
          </p>
        </div>
      </Card>
      <TagResults tag={tag} initialPosts={posts?.items ?? []} initialReels={reels?.items ?? []} />
    </FeedLayout>
  );
}
