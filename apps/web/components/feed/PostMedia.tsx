import { MediaCarousel } from '@/components/feed/MediaCarousel';
import type { PostPhoto } from '@/lib/types';

// The pictures and the clip on a post, edge to edge under its words. One item
// fills the width; several become a carousel (MediaCarousel). A server component
// for the single case: a clip is a plain <video controls>, so it plays on a page
// that never ran any script. `preload="metadata"` keeps a feed of clips from
// downloading all of them to show a poster.
export function PostMedia({ items, tallest = '36rem' }: { items: PostPhoto[]; tallest?: string }) {
  if (items.length === 0) return null;
  if (items.length > 1) return <MediaCarousel items={items} tallest={tallest} />;

  const [item] = items;
  return (
    <div data-testid="post-media">
      {item.kind === 'VIDEO' ? (
        <video
          src={item.url}
          poster={item.thumbnailUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          style={{ maxHeight: tallest }}
          className="w-full bg-black"
          data-testid="post-video"
        />
      ) : (
        // Storage is an arbitrary host, so next/image would need every
        // deployment's domain configured up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          loading="lazy"
          style={{ maxHeight: tallest }}
          className="w-full bg-muted object-cover"
        />
      )}
    </div>
  );
}
