import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';
import { Badge, Card } from '@/components/ui/card';
import {
  formatClock,
  formatRunDay,
  runHeading,
  runStatusLabel,
  runStatusTone,
  runTypeLabel,
  runVisibilityLabel,
} from '@/lib/runs';
import type { RunSummary } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';

// One run in a list: date block, title, time and place, lead hare, how many are
// going. Server-safe (no hooks), so public pages render it without JS.
export function RunCard({
  run,
  variant = 'card',
  showKennel = true,
}: {
  run: RunSummary;
  variant?: 'card' | 'row';
  showKennel?: boolean;
}) {
  const day = formatRunDay(run.startsAt, run.timeZone);
  const lead = run.hares.find((h) => h.isLead) ?? run.hares[0];
  const cancelled = run.status === 'CANCELLED';

  const body = (
    <div className="flex gap-4">
      <div
        aria-hidden
        className={cn(
          'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted',
          cancelled && 'opacity-60',
        )}
      >
        <span className="text-xs font-semibold text-primary-strong">{day.month}</span>
        <span className="text-2xl font-bold leading-none">{day.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/runs/${run.id}`}
            className={cn('font-semibold hover:underline', cancelled && 'line-through decoration-2')}
            data-testid="run-card-link"
          >
            {runHeading(run)}
          </Link>
          {run.status !== 'SCHEDULED' && (
            <Badge className={runStatusTone(run.status)}>{runStatusLabel[run.status]}</Badge>
          )}
          {run.visibility !== 'PUBLIC' && <Badge>{runVisibilityLabel[run.visibility]}</Badge>}
          {run.runType !== 'REGULAR' && <Badge>{runTypeLabel[run.runType]}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {showKennel && `${run.kennel.shortName} · `}
          {formatClock(run.startsAt, run.timeZone)}
          {run.meetingPointName && (
            <>
              {' · '}
              <MapPin className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> {run.meetingPointName}
            </>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {lead && (
            <span>
              Hare: {lead.displayName}
              {run.hares.length > 1 && ` +${run.hares.length - 1}`}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {run.goingCount} going{run.capacity ? ` of ${run.capacity}` : ''}
          </span>
        </p>
      </div>
    </div>
  );

  if (variant === 'row') {
    return (
      <div className="rounded-lg border border-border p-3" data-testid="run-card">
        {body}
      </div>
    );
  }
  return (
    <Card className={cn(bleedCard, 'p-4')} data-testid="run-card">
      {body}
    </Card>
  );
}
