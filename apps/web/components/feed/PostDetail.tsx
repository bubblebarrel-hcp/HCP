import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { EngagementBar } from '@/components/social/EngagementBar';
import type { HasherPost } from '@/lib/types';
import { brandColor, cn, formatDate } from '@/lib/utils';

// One post, as its own page shows it. Shared between the server-rendered page and
// the signed-in fallback that opens a post the anonymous render could not (D57).
export function PostDetail({ post }: { post: HasherPost }) {
  const many = post.photos.length > 1;

  return (
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
  );
}
