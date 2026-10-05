import type { ChalkSymbol, ReleaseMode, Trail, TrailStatus, TrailStyle, WaypointKind } from '@/lib/types';

// Trail wording, marks and formatters from the web (apps/web/lib/trails.ts).

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

// Short marks for the map: readable stand-ins until the trail mark language (D24).
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

// The web's trailStatusTone, as a native Badge tone.
export function trailStatusTone(status: TrailStatus) {
  if (status === 'RELEASED' || status === 'LIVE') return 'soft-primary' as const;
  if (status === 'HIDDEN' || status === 'LOCKED') return 'soft-accent' as const;
  if (status === 'ARCHIVED' || status === 'COMPLETED' || status === 'HISTORIC') return 'muted' as const;
  return 'plain' as const;
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

export type MarkerTone = 'primary' | 'accent' | 'danger' | 'plain';

export interface MapPoint {
  id: string;
  mark: string;
  label: string;
  latitude: number;
  longitude: number;
  tone: MarkerTone;
}

// Every point the trail has, as map markers. Only what the API returned: when the viewer
// may not see the secret, `secret` is null and so is this.
export function trailPoints(trail: Trail): MapPoint[] {
  const secret = trail.secret;
  if (!secret) return [];
  return [
    ...secret.waypoints.map((w) => ({
      id: w.id,
      mark: waypointMark[w.kind],
      label: `${waypointKindLabel[w.kind]}${w.label ? `: ${w.label}` : ''}`,
      latitude: w.latitude,
      longitude: w.longitude,
      tone: w.kind === 'HAZARD' ? ('danger' as const) : ('primary' as const),
    })),
    ...secret.beerChecks.map((b) => ({
      id: b.id,
      mark: 'B',
      label: `Beer check: ${b.name}`,
      latitude: b.latitude,
      longitude: b.longitude,
      tone: 'accent' as const,
    })),
    ...secret.chalk.map((c) => ({
      id: c.id,
      mark: chalkMark[c.symbol],
      label: `${chalkLabel[c.symbol]}${c.customLabel ? `: ${c.customLabel}` : ''}`,
      latitude: c.latitude,
      longitude: c.longitude,
      tone: 'plain' as const,
    })),
  ];
}
