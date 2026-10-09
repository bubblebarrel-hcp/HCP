import { cn } from '@/lib/utils';
import type { PostPhoto } from '@/lib/types';

// The pictures and the clip on a post, edge to edge under its words. One item
// fills the width; several tile two to a row, and a clip takes a whole row so its
// controls stay usable. A server component: a clip is a plain <video controls>,
// so it plays on a page that never ran any script. `preload="metadata"` keeps a
// feed of clips from downloading all of them to show a poster.
export function PostMedia({ items, tallest = '36rem' }: { items: PostPhoto[]; tallest?: string }) {
  if (items.length === 0) return null;
  const many = items.length > 1;

  return (
    <div className={cn('grid gap-0.5', many && 'grid-cols-2')} data-testid="post-media">
      {items.map((item) =>
        item.kind === 'VIDEO' ? (
          <video
            key={item.id}
            src={item.url}
            poster={item.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            style={{ maxHeight: tallest }}
            className={cn('w-full bg-black', many && 'col-span-2')}
            data-testid="post-video"
          />
        ) : (
          // Storage is an arbitrary host, so next/image would need every
          // deployment's domain configured up front.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt=""
            width={item.width ?? undefined}
            height={item.height ?? undefined}
            loading="lazy"
            style={many ? undefined : { maxHeight: tallest }}
            className={cn('w-full bg-muted object-cover', many && 'aspect-square')}
          />
        ),
      )}
    </div>
  );
}
