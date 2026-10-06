'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Page } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api from '@/services/api';

interface KennelPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  run: { id: string; runNumber: number | null; title: string };
}

const PAGE = 24;

// Pictures hashers put on this kennel's runs. Each tile opens the run it was
// taken on; a photo of a members-only run only reaches its members.
export default function KennelPhotosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [photos, setPhotos] = useState<KennelPhoto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      try {
        const res = await api.get<{ data: Page<KennelPhoto> }>(`/kennels/${encodeURIComponent(slug)}/photos`, {
          params: { page: next, limit: PAGE },
        });
        setPhotos((current) => (next === 1 ? res.data.data.items : [...(current ?? []), ...res.data.data.items]));
        setTotal(res.data.data.total);
        setPage(next);
      } catch {
        setPhotos((current) => current ?? []);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load(1);
  }, [load]);

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link
          href={`/kennels/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to kennel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Photos</h1>
      </Card>

      {photos === null && <div className="h-48 animate-pulse bg-card sm:rounded-xl" aria-busy />}

      {photos?.length === 0 && (
        <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="kennel-photos-empty">
          <p className="font-semibold">No photos yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Pictures from this kennel&apos;s runs land here.</p>
        </Card>
      )}

      {photos && photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2" data-testid="kennel-photo-grid">
          {photos.map((photo) => (
            <li key={photo.id} className="aspect-square overflow-hidden bg-muted sm:rounded-md">
              <Link
                href={`/runs/${photo.run.id}`}
                title={`Run #${photo.run.runNumber} · ${photo.run.title}`}
                className="block h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user media from storage, not optimised by next/image */}
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.caption ?? `Photo from run #${photo.run.runNumber}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {photos && photos.length < total && (
        <div className="mt-4 text-center">
          <Button variant="outline" disabled={loading} onClick={() => void load(page + 1)}>
            {loading ? 'Loading…' : 'More photos'}
          </Button>
        </div>
      )}
    </FeedLayout>
  );
}
