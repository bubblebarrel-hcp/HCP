import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { EngagementBar } from '@/components/social/EngagementBar';
import { publicGet } from '@/lib/server-api';
import { shareMetadata } from '@/lib/share-metadata';
import type { HasherPost } from '@/lib/types';
import { brandColor, cn, formatDate } from '@/lib/utils';

// One post, at its own address (D51) — where a shared link lands and where a
// comment thread has room to be read.
//
// A post is always public, so unlike a run or a reel there is no case where the
// preview has to withhold anything: if it exists, everyone may read it.

export const revalidate = 60;

async function load(id: string) {
  return publicGet<{ post: HasherPost }>(`/posts/${id}`).catch(() => null);
}

function firstLine(body: string, max = 70) {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  if (!data) return shareMetadata({ title: 'Post', description: 'A post on the Hash Community Platform.' });

  const post = data.post;
  return shareMetadata({
    // A post has no title, so the preview leads with who wrote it and lets the
    // words be the description rather than inventing a headline from them.
    title: `${post.author.name} on HCP`,
    description: firstLine(post.body, 200) || 'A post on the Hash Community Platform.',
    image: post.photos[0]?.url,
  });
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const post = data.post;
  const many = post.photos.length > 1;

  return (
    <FeedLayout left={<LeftNav />}>
      <Card className="overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x" data-testid="post-page">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar
              name={post.author.name}
              size="md"
              src={post.author.avatarUrl}
              color={brandColor(post.kennel?.primaryColor)}
            />
            <p className="min-w-0 flex-1 text-sm">
              <Link href={`/hashers/${post.author.id}`} className="font-medium hover:underline">
                {post.author.name}
              </Link>
              {post.kennel && (
                <>
                  {' · '}
                  <Link href={`/kennels/${post.kennel.slug}`} className="text-primary-strong hover:underline">
                    {post.kennel.shortName}
                  </Link>
                </>
              )}
              {post.publishedAt && (
                <span className="block text-muted-foreground">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  {post.editedAt && ' · edited'}
                </span>
              )}
            </p>
          </div>

          <p className="mt-3 whitespace-pre-line leading-relaxed text-[15px]" data-testid="post-body">
            {post.body}
          </p>
        </div>

        {post.photos.length > 0 && (
          <div className={cn('grid gap-0.5', many && 'grid-cols-2')}>
            {post.photos.map((photo) => (
              // Storage is an arbitrary host, so next/image would need every
              // deployment's domain configured up front.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.url}
                alt=""
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                className={cn('w-full bg-muted object-cover', many ? 'aspect-square' : 'max-h-[40rem]')}
              />
            ))}
          </div>
        )}

        {post.run && (
          <p className="px-4 py-3 text-sm">
            <Link href={`/runs/${post.run.id}`} className="font-medium text-primary-strong hover:underline">
              Run #{post.run.runNumber ?? '—'}
              {post.run.title ? ` · ${post.run.title}` : ''}
            </Link>
          </p>
        )}

        <EngagementBar
          segment="posts"
          id={post.id}
          initial={post.engagement}
          authorId={post.author.id}
          countViewOnMount
        />
      </Card>
    </FeedLayout>
  );
}
