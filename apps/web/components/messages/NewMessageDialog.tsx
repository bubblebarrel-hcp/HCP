'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import api from '@/services/api';

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

// "New message": pick a hasher, then write to them (D71). The same search the
// @mention box uses, so blocked hashers are never offered (D60). Whether they
// can be written to at all is answered on the next page, where a closed door
// says so rather than being hidden here.
export function NewMessageDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get<{ data: { items: Suggestion[] } }>('/mentions/suggest', { params: { q: query, limit: 8 } })
        .then((res) => alive && setFound(res.data.data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setFound([]);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && (
        <DialogContent title="New message" description="Search for a hasher by name or @username.">
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search hashers"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-testid="new-message-search"
              />
            </label>
            <ul className="max-h-72 overflow-y-auto" data-testid="new-message-results">
              {found.length === 0 ? (
                <li className="p-4 text-center text-sm text-muted-foreground">No one found.</li>
              ) : (
                found.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/messages/new?to=${s.id}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                      data-testid="new-message-result"
                    >
                      <Avatar name={s.name} src={s.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{s.username}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
