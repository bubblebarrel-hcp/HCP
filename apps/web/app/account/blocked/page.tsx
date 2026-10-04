'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import type { BlockedHasher } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Hashers you have blocked or muted (D60). A block works both ways and ends any
// follow; a mute is quiet and one-way. Neither tells the other person, and this
// is where either is undone.

export default function BlockedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BlockedHasher[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const load = useCallback(() => {
    api
      .get<{ data: { items: BlockedHasher[] } }>('/me/blocks')
      .then((res) => setItems(res.data.data.items))
      .catch((err) => toast.error(errorMessage(err, 'Could not load this list')));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function undo(item: BlockedHasher) {
    try {
      await api.delete(`/hashers/${item.id}/${item.kind === 'BLOCK' ? 'block' : 'mute'}`);
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? current);
      toast.success(item.kind === 'BLOCK' ? `${item.name} is unblocked.` : `${item.name} is unmuted.`);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link href="/account/privacy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to privacy
      </Link>
      <Card data-testid="blocked-list">
        <CardHeader>
          <CardTitle className="text-2xl">Blocked and muted</CardTitle>
          <CardDescription>
            Blocked hashers cannot see your posts, reels or photos, follow you, or reach you; you cannot see theirs.
            Muted hashers just disappear from your feed and notifications, and are not told.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="blocked-empty">
              You have not blocked or muted anybody.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3" data-testid="blocked-row">
                  <Avatar name={item.name} size="sm" src={item.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <Link href={`/hashers/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {item.kind === 'BLOCK' ? 'Blocked' : 'Muted'} {new Date(item.since).toLocaleDateString()}
                    </span>
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void undo(item)}>
                    {item.kind === 'BLOCK' ? 'Unblock' : 'Unmute'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
