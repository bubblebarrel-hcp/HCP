import Link from 'next/link';
import { ListTree } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { AudienceControl } from '@/components/profile/AudienceControl';
import { EngagementBar } from '@/components/social/EngagementBar';
import { ExpandableText } from '@/components/social/ExpandableText';
import { RichText } from '@/components/social/RichText';
import { LinkPreviewCard } from '@/components/social/LinkPreviewCard';
import { PollCard } from '@/components/social/PollCard';
import type { HasherPost } from '@/lib/types';
import { brandColor, cn, formatDate } from '@/lib/utils';

// One post, as its own page shows it. Shared between the server-rendered page and
// the signed-in fallback that opens a post the anonymous render could not (D57).
//
// On the post's own page the words are shown whole. Where posts are stacked in a
// list (a run's page, a hashtag), `clamp` cuts a long one short with "Read more".
//
// A thread is shown as the first post and then each part under it, in order,
// joined by a line down the side. Each part is a post of its own, so each has
// its own likes and conversation; the audience is the first post's alone.

function PostCard({
  post,
  clamp,
  part,
}: {
  post: HasherPost;
  clamp: boolean;
  // Set on the posts after the first in a thread: their place, "2 of 5".
  part?: { number: number; of: number };
}) {
  const many = post.photos.length > 1;
  const bodyClass = 'mt-3 whitespace-pre-line leading-relaxed text-[15px]';

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x',
        part && 'relative border-l-4 border-l-primary/40',
      )}
      data-testid={part ? 'post-thread-part' : 'post-page'}
      id={part ? `part-${post.id}` : undefined}
    >
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
                {part && ` · ${part.number} of ${part.of}`}
              </span>
            )}
          </p>
        </div>

        {clamp ? (
          <ExpandableText text={post.body} href={`/posts/${post.id}`} className={bodyClass} data-testid="post-body" />
        ) : (
          <p className={bodyClass} data-testid="post-body">
            <RichText text={post.body} />
          </p>
        )}
        {post.poll && <PollCard postId={post.id} initial={post.poll} />}
        {post.linkPreview && <LinkPreviewCard preview={post.linkPreview} />}
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

      {post.run && !part && (
        <p className="px-4 py-3 text-sm">
          <Link href={`/runs/${post.run.id}`} className="font-medium text-primary-strong hover:underline">
            Run #{post.run.runNumber ?? '—'}
            {post.run.title ? ` · ${post.run.title}` : ''}
          </Link>
        </p>
      )}

      {/* Not carried through a list: the whole chain is on the post's own page. */}
      {!part && !post.thread?.length && post.threadCount > 0 && (
        <p className="px-4 py-3 text-sm">
          <Link
            href={`/posts/${post.id}`}
            className="inline-flex items-center gap-1.5 font-medium text-primary-strong hover:underline"
          >
            <ListTree className="h-4 w-4" aria-hidden />
            Thread · {post.threadCount} more {post.threadCount === 1 ? 'post' : 'posts'}
          </Link>
        </p>
      )}

      {!part && <AudienceControl kind="post" id={post.id} authorId={post.author.id} initial={post.visibility} />}

      <EngagementBar
        segment="posts"
        id={post.id}
        initial={post.engagement}
        authorId={post.author.id}
        countViewOnMount={!part}
      />
    </Card>
  );
}

export function PostDetail({ post, clamp = false }: { post: HasherPost; clamp?: boolean }) {
  const parts = post.thread ?? [];
  if (parts.length === 0) return <PostCard post={post} clamp={clamp} />;

  return (
    <div className="space-y-1" data-testid="post-thread">
      <PostCard post={post} clamp={false} />
      {parts.map((part, index) => (
        <PostCard key={part.id} post={part} clamp={false} part={{ number: index + 2, of: parts.length + 1 }} />
      ))}
    </div>
  );
}
