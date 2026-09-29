import type { RsvpStatus, RunStatus, RunType, RunVisibility } from '@/lib/types';

export const runStatusLabel: Record<RunStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PLANNING: 'Planning',
  TRAIL_HIDDEN: 'Trail hidden',
  TRAIL_RELEASED: 'Trail released',
  CHECK_IN_OPEN: 'Check-in open',
  LIVE: 'Live',
  CIRCLE: 'Circle',
  REPORTING: 'Reporting',
  ARCHIVED: 'Archived',
  CANCELLED: 'Cancelled',
};

export const runTypeLabel: Record<RunType, string> = {
  REGULAR: 'Regular run',
  FULL_MOON: 'Full moon',
  RED_DRESS: 'Red dress',
  CAMPOUT: 'Campout',
  CHARITY: 'Charity',
  INTERHASH: 'Interhash',
  NASH_HASH: 'Nash Hash',
  THEMED: 'Themed',
  SPECIAL: 'Special',
};

export const runVisibilityLabel: Record<RunVisibility, string> = {
  PUBLIC: 'Public',
  MEMBERS_ONLY: 'Members only',
  INVITE_ONLY: 'Invite only',
};

export const rsvpLabel: Record<RsvpStatus, string> = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  NOT_GOING: 'Not going',
  CANCELLED: 'Withdrawn',
};

export const runTimelineLabel: Record<string, string> = {
  RunCreated: 'Run created',
  RunScheduled: 'Published',
  RunPlanningStarted: 'Planning started',
  RunPlanningLocked: 'Planning locked',
  TrailHidden: 'Trail hidden',
  TrailReleased: 'Trail released',
  CheckInOpened: 'Check-in opened',
  RunStarted: 'Run started',
  RunPaused: 'Run paused',
  RunResumed: 'Run resumed',
  RunEnded: 'Run ended',
  CircleClosed: 'Circle closed',
  CircleSkipped: 'Circle skipped',
  RunArchived: 'Archived',
  RunCancelled: 'Cancelled',
};

// Badge colours; the label always carries the meaning too.
export function runStatusTone(status: RunStatus) {
  if (status === 'LIVE' || status === 'CHECK_IN_OPEN' || status === 'CIRCLE') {
    return 'border-primary/30 bg-primary/10 text-primary-strong';
  }
  if (status === 'CANCELLED') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (status === 'DRAFT') return 'border-accent/30 bg-accent/10 text-accent-strong';
  if (status === 'ARCHIVED' || status === 'REPORTING') return 'text-muted-foreground';
  return '';
}

// Runs are shown in the run's own time zone: "Sat 19 Sept, 15:00" in Abuja is
// 15:00 for everyone reading it, wherever they are.
export function formatRunDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatRunDay(iso: string, timeZone: string) {
  const d = new Date(iso);
  return {
    month: new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short' }).format(d).toUpperCase(),
    day: new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric' }).format(d),
  };
}

export function formatClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function runHeading(run: { runNumber: number; title: string }) {
  return `#${run.runNumber} · ${run.title}`;
}

// "Saturday 19 September, 16:00" — the way a kennel writes it on a flyer.
export function formatRunWhen(iso: string, timeZone: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return `${day}, ${formatClock(iso, timeZone)}`;
}
