import type { StoryCategory, TrailReportStatus } from '@/lib/types';

// Chapter 22 A.5, in the words a Scribe would use.
export const reportStatusLabel: Record<TrailReportStatus, string> = {
  DRAFT: 'Draft',
  SCRIBE_EDITING: 'Being written',
  REVIEW: 'In review',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export function reportStatusTone(status: TrailReportStatus) {
  if (status === 'PUBLISHED') return 'bg-primary text-primary-foreground';
  if (status === 'REVIEW') return 'bg-accent text-accent-foreground';
  if (status === 'ARCHIVED') return 'text-muted-foreground';
  return '';
}

export const storyCategoryLabel: Record<StoryCategory, string> = {
  TRAIL: 'Trail',
  BEER_CHECK: 'Beer check',
  CIRCLE: 'Circle',
  VISITOR: 'Visitor',
  AWARD: 'Award',
  SONG: 'Song',
  INCIDENT: 'Incident',
  HUMOR: 'Humour',
  SAFETY: 'Safety',
  HISTORICAL: 'Historical',
  GENERAL: 'General',
};

// The action a report can take next, given where it is.
export function nextActions(status: TrailReportStatus) {
  switch (status) {
    case 'DRAFT':
      return [{ action: 'start-editing', label: 'Start writing', primary: true }];
    case 'SCRIBE_EDITING':
      return [
        { action: 'publish', label: 'Publish', primary: true },
        { action: 'submit-review', label: 'Send for review', primary: false },
      ];
    case 'REVIEW':
      return [
        { action: 'publish', label: 'Publish', primary: true },
        { action: 'return-to-editing', label: 'Take it back', primary: false },
      ];
    default:
      return [];
  }
}
