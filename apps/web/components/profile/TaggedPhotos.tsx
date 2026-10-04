'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Page } from '@/lib/types';
import api from '@/services/api';

// Photos a hasher is in, because they said yes to being tagged (D60). Only what
// the viewer could open anyway; nothing at all when there are none.
interface Tagged {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
}

export function TaggedPhotos({ hasherId, name }: { hasherId: string; name: string }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Tagged[]>([]);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api
      .get<{ data: Page<Tagged> }>(`/hashers/${hasherId}/tagged-photos`, { params: { limit: 12 } })
      .then((res) => alive && setItems(res.data.data.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [hasherId, user, loading]);

  if (items.length === 0) return null;
  return (
    <section aria-label={`Photos of ${name}`} className="px-4 sm:px-0" data-testid="tagged-photos">
      <h2 className="pb-2 text-sm font-semibold text-muted-foreground">Tagged in</h2>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {items.map((photo) => (
          <li key={photo.id} className="aspect-square overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.caption ?? `A photo of ${name}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
