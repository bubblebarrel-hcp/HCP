'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StickerMaker } from '@/components/messages/StickerMaker';
import { deleteSticker, getStickers, setStickerFavorite, type Sticker, type StickerTray } from '@/lib/messages';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// The sticker tray (D73): what I sent lately, what I starred, and what I made.
// Tapping one sends it. A star keeps one close; the bin removes one I made from
// my tray (conversations it was already sent in keep showing it).

type Tab = 'recent' | 'favorites' | 'mine';

const LABEL: Record<Tab, string> = { recent: 'Recent', favorites: 'Favourites', mine: 'Mine' };

export function StickerPanel({ onSend, sending }: { onSend: (sticker: Sticker) => void; sending: boolean }) {
  const [tray, setTray] = useState<StickerTray | null>(null);
  const [tab, setTab] = useState<Tab>('recent');

  const load = useCallback(async () => {
    try {
      const next = await getStickers();
      setTray(next);
      return next;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load your stickers'));
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getStickers()
      .then((next) => {
        if (!alive) return;
        setTray(next);
        // First time here: nothing recent, so land on what is there.
        if (next.recent.length === 0) setTab(next.favorites.length ? 'favorites' : 'mine');
      })
      .catch((err) => alive && toast.error(errorMessage(err, 'Could not load your stickers')));
    return () => {
      alive = false;
    };
  }, []);

  async function star(sticker: Sticker) {
    try {
      await setStickerFavorite(sticker.id, !sticker.favorite);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  async function remove(sticker: Sticker) {
    try {
      await deleteSticker(sticker.id);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete that sticker'));
    }
  }

  const shown = tray ? tray[tab] : [];

  return (
    <div className="rounded-xl border border-border bg-card p-2" data-testid="sticker-panel">
      <div className="flex items-center gap-1 pb-2">
        <div role="tablist" className="flex flex-1 gap-1">
          {(Object.keys(LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded-full px-3 py-1 text-sm hover:bg-muted', tab === t && 'bg-muted font-medium')}
            >
              {LABEL[t]}
            </button>
          ))}
        </div>
        <StickerMaker
          onCreated={() => {
            setTab('mine');
            void load();
          }}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
              data-testid="sticker-new"
            >
              <Plus className="h-4 w-4" aria-hidden /> Make
            </button>
          }
        />
      </div>

      {!tray ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy />
      ) : shown.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground" data-testid="sticker-empty">
          {tab === 'recent'
            ? 'Stickers you send show up here.'
            : tab === 'favorites'
              ? 'Star a sticker you were sent, or one you made, to keep it here.'
              : 'You have not made any yet. Press Make to turn a picture into a sticker.'}
        </p>
      ) : (
        <ul className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5" data-testid="sticker-grid">
          {shown.map((s) => (
            <li key={s.id} className="group relative">
              <button
                type="button"
                disabled={sending || !s.url}
                onClick={() => onSend(s)}
                className="grid aspect-square w-full place-items-center rounded-lg p-1 hover:bg-muted disabled:opacity-50"
                aria-label="Send this sticker"
                data-testid="sticker"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.url && <img src={s.url} alt="" className="h-full w-full object-contain" loading="lazy" />}
              </button>
              <button
                type="button"
                onClick={() => void star(s)}
                aria-label={s.favorite ? 'Remove from favourites' : 'Add to favourites'}
                aria-pressed={s.favorite}
                className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full bg-card/90 opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Star className={cn('h-3.5 w-3.5', s.favorite && 'fill-current text-accent-strong')} aria-hidden />
              </button>
              {s.mine && tab === 'mine' && (
                <button
                  type="button"
                  onClick={() => void remove(s)}
                  aria-label="Delete this sticker"
                  className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-card/90 opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
