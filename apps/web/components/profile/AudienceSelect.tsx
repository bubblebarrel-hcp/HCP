'use client';

import { Globe, Lock, Users } from 'lucide-react';
import type { Audience } from '@/lib/types';
import { cn } from '@/lib/utils';

// The compact form of the audience choice (D57), for a toolbar or a card where
// the full radio cards in AudiencePicker would be too much: a native select with
// the matching icon in front of it, so it works with a keyboard and a screen
// reader with nothing added.

const ICON = { PUBLIC: Globe, FOLLOWERS: Users, ONLY_ME: Lock } as const;

const LABEL: Record<Audience, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Followers',
  ONLY_ME: 'Only me',
};

export function AudienceSelect({
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  disabled?: boolean;
  // What is being chosen, for the accessible name: "Who can read this post".
  label: string;
  className?: string;
}) {
  const Icon = ICON[value];
  return (
    <span
      className={cn(
        'relative inline-flex items-center rounded-lg border border-border bg-background text-sm',
        disabled && 'opacity-60',
        className,
      )}
    >
      <Icon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Audience)}
        className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent py-0 pl-8 pr-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        data-testid="audience-select"
      >
        {(Object.keys(LABEL) as Audience[]).map((option) => (
          <option key={option} value={option}>
            {LABEL[option]}
          </option>
        ))}
      </select>
    </span>
  );
}
