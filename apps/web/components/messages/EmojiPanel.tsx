'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { EMOJI_GROUPS, recentEmoji, rememberEmoji } from '@/lib/emoji';
import { cn } from '@/lib/utils';

// Emoji for the message box (D73). Opens above the composer rather than floating
// over the conversation, so it never covers the words being replied to.
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState<string>('smileys');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // localStorage is only there in the browser, after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(recentEmoji());
  }, []);

  const shown = group === 'recent' ? recent : (EMOJI_GROUPS.find((g) => g.id === group)?.emoji ?? []);

  function pick(emoji: string) {
    rememberEmoji(emoji);
    setRecent(recentEmoji());
    onPick(emoji);
  }

  const tab = (id: string, label: string, face: React.ReactNode) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={group === id}
      aria-label={label}
      onClick={() => setGroup(id)}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg hover:bg-muted',
        group === id && 'bg-muted ring-1 ring-border',
      )}
    >
      {face}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-2" data-testid="emoji-panel">
      <div role="tablist" className="flex gap-1 overflow-x-auto pb-2">
        {recent.length > 0 && tab('recent', 'Recently used', <Clock className="h-4 w-4" aria-hidden />)}
        {EMOJI_GROUPS.map((g) => tab(g.id, g.label, g.icon))}
      </div>
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto sm:grid-cols-10" role="tabpanel">
        {shown.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => pick(emoji)}
            className="grid h-9 w-9 place-items-center rounded-lg text-xl hover:bg-muted"
            aria-label={emoji}
            data-testid="emoji"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
