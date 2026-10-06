import { Badge } from '@/components/ui/card';
import { cn, humanize } from '@/lib/utils';

// Gold, trail green and red are semantic only (D24): a status colour says what
// state something is in, never decorates. Every badge also carries its text, so
// colour is never the only signal.
type Tone = 'neutral' | 'good' | 'warn' | 'bad';

const toneClass: Record<Tone, string> = {
  neutral: '',
  good: 'border-trail/40 bg-trail/10 text-trail',
  warn: 'border-accent/50 bg-accent/10 text-accent-strong',
  bad: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const TONES: Record<string, Tone> = {
  // positive / live
  ACTIVE: 'good', PUBLISHED: 'good', ALLOWED: 'good', TRAIL_RELEASED: 'good', LIVE: 'good',
  COMMUNITY_VERIFIED: 'good', OFFICER_VERIFIED: 'good', PLATFORM_VERIFIED: 'good', APPOINTED: 'good',
  // needs a person to look
  PENDING_REVIEW: 'warn', APPLICANT: 'warn', PENDING_VERIFICATION: 'warn', REVIEW: 'warn', REPORTING: 'warn',
  CIRCLE: 'warn', SCRIBE_EDITING: 'warn', NOMINATED: 'warn', SUSPENDED: 'warn', PENDING_PUBLICATION: 'warn',
  // negative / terminal-bad
  DENIED: 'bad', REMOVED: 'bad', REJECTED: 'bad', CANCELLED: 'bad', DELETED: 'bad', REVOKED: 'bad', DEACTIVATED: 'bad',
};

export function StatusBadge({ value, tone, className }: { value: string; tone?: Tone; className?: string }) {
  return <Badge className={cn('whitespace-nowrap', toneClass[tone ?? TONES[value] ?? 'neutral'], className)}>{humanize(value)}</Badge>;
}
