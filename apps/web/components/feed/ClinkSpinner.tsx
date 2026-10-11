'use client';

import { BeerMug } from '@/components/feed/BeerMug';
import { cn } from '@/lib/utils';

// Two mugs that clink (D46): the loading spinner. They keep striking for as long
// as something is loading. The motion lives in CSS (`.hcp-clink[data-state]` in
// globals.css) where the compositor can have it.

export function ClinkSpinner({
  className,
  size = 44,
  label = 'On On…',
}: {
  className?: string;
  size?: number;
  // Shown under the mugs and read out by screen readers; pass '' for mugs alone.
  label?: string;
}) {
  return (
    <div
      className={cn('hcp-clink flex flex-col items-center gap-1', className)}
      data-state="refreshing"
      data-testid="clink-spinner"
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <div className="flex items-end justify-center" aria-hidden>
        <BeerMug className="hcp-clink-mug" data-side="left" width={size} height={size} />
        <BeerMug mirrored className="hcp-clink-mug" data-side="right" width={size} height={size} />
      </div>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
    </div>
  );
}
