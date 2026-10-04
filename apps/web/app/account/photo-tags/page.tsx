'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import type { PendingPhotoTag } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Photos hashers want to tag you in (D60). A tag is a request: it shows on the
// photo and on your profile only once you say yes, and a no is final. You can
// take an approved tag off yourself at any time, from the photo.

export default function PhotoTagsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PendingPhotoTag[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api
      .get<{ data: { items: PendingPhotoTag[] } }>('/me/photo-tags/pending')
      .then((res) => alive && setItems(res.data.data.items))
      .catch((err) => toast.error(errorMessage(err, 'Could not load your tag requests')));
    return () => {
      alive = false;
    };
  }, [user]);

  async function answer(item: PendingPhotoTag, approve: boolean) {
    try {
      await api.post(`/photo-tags/${item.id}/${approve ? 'approve' : 'decline'}`);
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? current);
      toast.success(approve ? 'You are tagged in it.' : 'Declined. They will not be able to ask again.');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to account
      </Link>
      <Card data-testid="photo-tag-requests">
        <CardHeader>
          <CardTitle className="text-2xl">Photo tags waiting for you</CardTitle>
          <CardDescription>Nothing shows until you say yes.</CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="photo-tags-empty">
              No tag requests right now.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3" data-testid="photo-tag-request">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.photo.thumbnailUrl ?? item.photo.url}
                    alt={item.photo.caption ?? 'A photo you were tagged in'}
                    className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link href={`/hashers/${item.by.id}`} className="font-medium hover:underline">
                        {item.by.name}
                      </Link>{' '}
                      tagged you.
                    </p>
                    {item.photo.caption && <p className="truncate text-sm text-muted-foreground">{item.photo.caption}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void answer(item, true)} data-testid="photo-tag-approve">
                        Yes, that is me
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void answer(item, false)} data-testid="photo-tag-decline">
                        No
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
