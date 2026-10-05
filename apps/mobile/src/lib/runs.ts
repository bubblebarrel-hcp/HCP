import type { RunStatus, RunType, RunVisibility } from '@/lib/types';

// The web app's run helpers (apps/web/lib/runs.ts), so a run reads the same on
// both. Runs are shown in the run's own time zone: "Sat 19 Sept, 15:00" in
// Abuja is 15:00 for everyone reading it, wherever they are.

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

// "Saturday 19 September, 16:00": the way a kennel writes it on a flyer.
export function formatRunWhen(iso: string, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
  return `${day}, ${formatClock(iso, timeZone)}`;
}

export const rsvpLabel = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  NOT_GOING: 'Not going',
  CANCELLED: 'Withdrawn',
} as const;

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
