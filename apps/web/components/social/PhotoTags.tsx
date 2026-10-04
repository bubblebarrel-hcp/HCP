'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import type { PhotoTag } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Who is in a photo (D60). Tagging somebody asks them: until they say yes the tag
// shows to the two of you only, and a no is final. The tagged person, whoever
// tagged them and whoever took the photo can take a tag off.

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export function PhotoTags({ mediaId }: { mediaId: string }) {
  const { user } = useAuth();
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ data: { items: PhotoTag[] } }>(`/photos/${mediaId}/tags`)
      .then((res) => setTags(res.data.data.items))
      .catch(() => undefined);
  }, [mediaId]);

  useEffect(() => {
    load();
  }, [load, user]);

  // The same picker the composer's "@" uses, just opened by a button.
  useEffect(() => {
    if (!adding || !user) return;
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get<{ data: { items: Suggestion[] } }>('/mentions/suggest', { params: { q: query, limit: 6 } })
        .then((res) => alive && setFound(res.data.data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, adding, user]);

  async function tag(person: Suggestion) {
    try {
      await api.post(`/photos/${mediaId}/tags`, { userId: person.id });
      toast.success(`${person.name} has been asked.`);
      setAdding(false);
      setQuery('');
      load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not tag them'));
    }
  }

  async function remove(tagId: string) {
    try {
      await api.post(`/photo-tags/${tagId}/remove`);
      setTags((current) => current.filter((t) => t.id !== tagId));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove that'));
    }
  }

  if (!user && tags.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="photo-tags">
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-2 text-sm"
              data-testid="photo-tag"
            >
              <Avatar name={t.user.name} size="sm" src={t.user.avatarUrl} className="h-6 w-6 text-[10px]" />
              <Link href={`/hashers/${t.user.id}`} className="hover:underline">
                {t.user.name}
              </Link>
              {t.status === 'PENDING' && <span className="text-xs text-muted-foreground">(asked)</span>}
              {t.canRemove && (
                <button
                  type="button"
                  onClick={() => void remove(t.id)}
                  aria-label={`Remove ${t.user.name}'s tag`}
                  className="rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {user && (
        <div>
          {adding ? (
            <div className="relative max-w-xs">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Who is in it?"
                aria-label="Find a hasher to tag"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
                data-testid="photo-tag-input"
              />
              {found.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-1 shadow-lg">
                  {found.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => void tag(person)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        data-testid="photo-tag-suggestion"
                      >
                        <Avatar name={person.name} size="sm" src={person.avatarUrl} className="h-7 w-7 text-xs" />
                        <span className="min-w-0 flex-1 truncate">{person.name}</span>
                        <span className="text-xs text-muted-foreground">@{person.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-sm text-primary-strong hover:underline"
              data-testid="photo-tag-add"
            >
              <Tag className="h-4 w-4" aria-hidden /> Tag a hasher
            </button>
          )}
        </div>
      )}
    </div>
  );
}
