'use client';

import { BeerMug } from '@/components/feed/BeerMug';
import { cn } from '@/lib/utils';

// Two mugs that clink (D46). The spinner for pull-to-refresh: the gap closes as
// you pull, they strike at the threshold, and they keep striking while the feed
// loads. Nothing moves on its own before that — the sloshing belongs to the
// clink, not to the waiting.
//
// All four states are the same two mugs; only `data-state` and `--pull` change,
// which keeps the motion in CSS where the compositor can have it.

export type ClinkState = 'idle' | 'pulling' | 'armed' | 'refreshing';

const caption: Record<ClinkState, string> = {
  idle: '',
  pulling: 'Pull to refresh',
  armed: 'Let go for a clink',
  refreshing: 'On On…',
};

export function ClinkSpinner({
  state,
  progress = 0,
  className,
  size = 44,
}: {
  state: ClinkState;
  // 0 at rest, 1 at the point where letting go triggers a refresh.
  progress?: number;
  className?: string;
  size?: number;
}) {
  const pull = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={cn('hcp-clink flex flex-col items-center gap-1', className)}
      data-state={state}
      style={{ ['--pull' as string]: pull.toFixed(3) }}
      data-testid="clink-spinner"
      // The caption below carries the meaning; the mugs are decoration.
      role="status"
      aria-live="polite"
    >
      <div className="flex items-end justify-center">
        <BeerMug className="hcp-clink-mug" data-side="left" width={size} height={size} />
        <BeerMug mirrored className="hcp-clink-mug" data-side="right" width={size} height={size} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{caption[state]}</span>
    </div>
  );
}
