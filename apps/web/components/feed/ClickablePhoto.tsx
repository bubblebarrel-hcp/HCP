'use client';

import { useState } from 'react';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import type { PostPhoto as PostPhotoItem } from '@/lib/types';

// The one picture on a post, which opens full screen when clicked. A client
// component only for that: PostMedia stays a server component for the rest.
export function ClickablePhoto({ item, tallest }: { item: PostPhotoItem; tallest: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open photo full screen"
        data-testid="post-photo"
        className="block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        {/* Storage is an arbitrary host, so next/image would need every
            deployment's domain configured up front. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt=""
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          loading="lazy"
          style={{ maxHeight: tallest }}
          className="w-full bg-muted object-cover"
        />
      </button>
      <PhotoViewer photos={[{ url: item.url }]} open={open} onOpenChange={setOpen} />
    </>
  );
}
