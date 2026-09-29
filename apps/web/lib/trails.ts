import type { ChalkSymbol, ReleaseMode, TrailStatus, TrailStyle, WaypointKind } from '@/lib/types';

export const trailStatusLabel: Record<TrailStatus, string> = {
  IDEA: 'Idea',
  DRAFT: 'Draft',
  PLANNING: 'Planning',
  REVIEW: 'In review',
  LOCKED: 'Locked',
  HIDDEN: 'Hidden',
  RELEASED: 'Released',
  LIVE: 'Live',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
  HISTORIC: 'Historic',
};

export const trailStyleLabel: Record<TrailStyle, string> = {
  LIVE_HARE: 'Live hare',
  DEAD_HARE: 'Dead hare',
  A_TO_A: 'A to A',
  A_TO_B: 'A to B',
  OTHER: 'Other',
};

export const releaseModeLabel: Record<ReleaseMode, string> = {
  AT_RUN_START: 'When the run starts',
  SCHEDULED: 'At a set time',
  MANUAL: 'When the hare says so',
  CHECK_IN: 'When check-in opens',
  GEOFENCE: 'At the start location',
};

export const waypointKindLabel: Record<WaypointKind, string> = {
  START: 'Start',
  FINISH: 'Finish',
  CHECKPOINT: 'Check',
  REGROUP: 'Regroup',
  HAZARD: 'Hazard',
  SCENIC: 'Scenic',
  ON_IN: 'On In',
  OTHER: 'Other',
};

export const chalkLabel: Record<ChalkSymbol, string> = {
  ON_ON: 'On On',
  CHECK: 'Check',
  FALSE_TRAIL: 'False trail',
  BACK_CHECK: 'Back check',
  REGROUP: 'Regroup',
  BEER_NEAR: 'Beer near',
  TRUE_TRAIL: 'True trail',
  ON_IN: 'On In',
  HAZARD: 'Hazard',
  CUSTOM: 'Custom',
};

// Short marks for the map. The full trail mark language comes with the brand
// work (D24); these are readable stand-ins, not emoji.
export const chalkMark: Record<ChalkSymbol, string> = {
  ON_ON: 'ON',
  CHECK: '?',
  FALSE_TRAIL: 'X',
  BACK_CHECK: 'BC',
  REGROUP: 'RG',
  BEER_NEAR: 'BN',
  TRUE_TRAIL: 'TT',
  ON_IN: 'IN',
  HAZARD: '!',
  CUSTOM: '*',
};

export const waypointMark: Record<WaypointKind, string> = {
  START: 'S',
  FINISH: 'F',
  CHECKPOINT: 'C',
  REGROUP: 'R',
  HAZARD: '!',
  SCENIC: 'V',
  ON_IN: 'IN',
  OTHER: '•',
};

export function trailStatusTone(status: TrailStatus) {
  if (status === 'RELEASED' || status === 'LIVE') return 'border-primary/30 bg-primary/10 text-primary-strong';
  if (status === 'HIDDEN' || status === 'LOCKED') return 'border-accent/30 bg-accent/10 text-accent-strong';
  if (status === 'ARCHIVED' || status === 'COMPLETED' || status === 'HISTORIC') return 'text-muted-foreground';
  return '';
}

export function formatDistance(metres: number | null) {
  if (!metres) return null;
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
}

export function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Ch.22 A.4, as the planner sees it: one step at a time.
export const trailSteps: Record<string, { action: string; label: string; needsLead: boolean }> = {
  DRAFT: { action: 'start-planning', label: 'Start planning', needsLead: false },
  PLANNING: { action: 'submit-review', label: 'Send for review', needsLead: false },
  REVIEW: { action: 'lock', label: 'Lock the trail', needsLead: true },
  LOCKED: { action: 'hide', label: 'Hide the trail', needsLead: true },
  HIDDEN: { action: 'release', label: 'Release the trail', needsLead: true },
};
