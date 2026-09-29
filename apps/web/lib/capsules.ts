import type { CapsuleStatus, CapsuleTimelineEntry, SupplementalType } from '@/lib/types';

// Chapter 22 A.6, in words a hasher would use rather than state names.
export const capsuleStatusLabel: Record<CapsuleStatus, string> = {
  PLANNED: 'Planned',
  PREPARING: 'Preparing',
  LIVE: 'Live',
  DRAFT: 'Gathering',
  PENDING_PUBLICATION: 'Ready to publish',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  LEGACY: 'Legacy',
};

export function capsuleStatusTone(status: CapsuleStatus) {
  if (status === 'PUBLISHED') return 'bg-primary text-primary-foreground';
  if (status === 'PENDING_PUBLICATION') return 'bg-accent text-accent-foreground';
  if (status === 'ARCHIVED' || status === 'LEGACY') return 'text-muted-foreground';
  return '';
}

export const supplementTypeLabel: Record<SupplementalType, string> = {
  PHOTO: 'Photo',
  SCANNED_NEWSLETTER: 'Scanned newsletter',
  INTERVIEW: 'Interview',
  REFLECTION: 'Reflection',
  DOCUMENT: 'Document',
  OTHER: 'Other',
};

// The timeline mixes what the platform recorded with what people wrote down.
export function timelineTone(kind: CapsuleTimelineEntry['kind']) {
  switch (kind) {
    case 'REPORT':
      return 'text-primary-strong';
    case 'AWARD':
      return 'text-accent-strong';
    case 'STORY':
      return 'text-foreground';
    default:
      return 'text-muted-foreground';
  }
}
