'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { mentionQueryAt } from '@/lib/entities';
import { cn } from '@/lib/utils';
import api from '@/services/api';

// A textarea that offers hashers when you type "@" (D59). It is a plain textarea
// in every other respect — the words stay a string, and the API reads the
// mentions out of them — so the picker only saves typing a username by hand.
//
// People you follow come first, and an empty "@" offers just them.

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  following: boolean;
}

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (next: string) => void;
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onValueChange, onKeyDown, onBlur, onSelect, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  const listId = useId();
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const query = trigger?.query;
  const start = trigger?.start;
  useEffect(() => {
    if (query === undefined) {
      setItems([]);
      return;
    }
    let cancelled = false;
    // A short pause, so typing "@pothole" is one request and not eight.
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: { items: Suggestion[] } }>('/mentions/suggest', {
          params: { q: query, limit: 6 },
        });
        if (cancelled) return;
        setItems(res.data.data.items);
        setActive(0);
      } catch {
        // Signed out, or offline: the textarea still works, it just does not offer.
        if (!cancelled) setItems([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, start]);

  const look = (el: HTMLTextAreaElement) => setTrigger(mentionQueryAt(el.value, el.selectionStart));

  const choose = (item: Suggestion) => {
    const el = inner.current;
    if (!trigger || !el) return;
    const caret = el.selectionStart;
    const insert = `@${item.username} `;
    onValueChange(value.slice(0, trigger.start) + insert + value.slice(caret));
    setTrigger(null);
    setItems([]);
    const position = trigger.start + insert.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  const open = trigger !== null && items.length > 0;

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={inner}
        value={value}
        className={className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          onValueChange(event.target.value);
          look(event.target);
        }}
        onSelect={(event) => {
          look(event.currentTarget);
          onSelect?.(event);
        }}
        onBlur={(event) => {
          setTrigger(null);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((current) => (current + step + items.length) % items.length);
              return;
            }
            // Enter and Tab take the highlighted hasher instead of sending the
            // comment or leaving the box.
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              choose(items[active]);
              return;
            }
          }
          onKeyDown?.(event);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Hashers to mention"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg"
          data-testid="mention-suggestions"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Mouse down, not click: the textarea would lose focus first, and
              // blur closes this list before a click could land.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                index === active && 'bg-muted',
              )}
              data-testid="mention-suggestion"
            >
              <Avatar name={item.name} size="sm" src={item.avatarUrl} className="h-7 w-7 text-xs" />
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">@{item.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
