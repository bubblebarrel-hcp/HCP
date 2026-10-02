'use client';

import { useId } from 'react';
import { Globe, Lock, Users } from 'lucide-react';
import type { Audience } from '@/lib/types';
import { cn } from '@/lib/utils';

// Who sees something a hasher made (D57): everybody, the people they have let
// follow them, or only themself. The same three steps whether it is a whole
// profile or one reel, so the choice reads the same wherever it is made.

const ICON = { PUBLIC: Globe, FOLLOWERS: Users, ONLY_ME: Lock } as const;

const LABEL: Record<Audience, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Followers',
  ONLY_ME: 'Only me',
};

const HINT = {
  profile: {
    PUBLIC: 'Anyone on HCP, signed in or not, can see your photos, posts and reels.',
    FOLLOWERS:
      'Your profile is locked. People ask to follow you, and only the ones you approve see your photos, posts and reels.',
    ONLY_ME: 'Nobody sees them but you, and nobody can follow you.',
  },
  reel: {
    PUBLIC: 'Anyone can watch it.',
    FOLLOWERS: 'Only people who follow you.',
    ONLY_ME: 'Only you. It is posted, but kept to yourself.',
  },
} as const;

export function AudiencePicker({
  value,
  onChange,
  kind,
  disabled,
  compact = false,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  kind: 'profile' | 'reel';
  disabled?: boolean;
  // Drops the explanation under each choice and keeps it for the chosen one.
  compact?: boolean;
}) {
  const name = useId();
  const options: Audience[] = ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'];

  return (
    <div role="radiogroup" className={cn('grid gap-2', compact ? 'sm:grid-cols-3' : '')} data-testid={`audience-${kind}`}>
      {options.map((option) => {
        const Icon = ICON[option];
        const selected = value === option;
        return (
          <label
            key={option}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
              selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/40',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
              data-testid={`audience-${option.toLowerCase()}`}
            />
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'text-primary-strong' : 'text-muted-foreground')} aria-hidden />
            <span className="min-w-0">
              <span className="block font-medium">{LABEL[option]}</span>
              {(!compact || selected) && <span className="block text-muted-foreground">{HINT[kind][option]}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
