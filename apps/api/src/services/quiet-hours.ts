import { DeliveryChannel, NotificationPriority } from '@prisma/client';
import prisma from '../config/prisma';

// FR-NOT-006. The schema has carried `quietHoursStart` / `quietHoursEnd` since
// the first migration and nothing ever read them, which was harmless while
// in-app was the only channel: a badge waiting in the morning wakes nobody.
// Push is different, so quiet hours start mattering the moment push ships.
//
// Scope is deliberately narrow. Quiet hours suppress PUSH only. In-app still
// lands (it is silent by nature) and email still sends (a mailbox is not an
// interruption), so a hasher who sleeps through a window still has everything
// waiting when they wake up. Nothing is lost, only quietened.

export interface QuietHours {
  start: string; // "22:00" in the hasher's own time zone
  end: string; // "07:00"
}

/** Minutes past midnight, or null if the value is not a "HH:MM" clock time. */
function minutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * The local wall-clock time in a time zone, as minutes past midnight.
 * `Intl` does the zone arithmetic, which keeps this correct across daylight
 * saving without a date library.
 */
export function localMinutes(timeZone: string | null | undefined, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    // en-GB renders midnight as 24 in some engines.
    return (hour % 24) * 60 + minute;
  } catch {
    // An unknown zone should not silently mute someone's phone, so treat it as
    // "not in quiet hours" by answering with a time no window can contain.
    return -1;
  }
}

/**
 * Is `at` inside the window? Windows normally wrap midnight (22:00 → 07:00),
 * so a plain `start <= now <= end` comparison would be wrong for the common
 * case. Start equal to end is treated as no window rather than all day: a
 * hasher who fat-fingers both fields should miss nothing.
 */
export function within(window: QuietHours, nowMinutes: number): boolean {
  const start = minutes(window.start);
  const end = minutes(window.end);
  if (start === null || end === null || start === end || nowMinutes < 0) return false;
  return start < end
    ? nowMinutes >= start && nowMinutes < end
    : nowMinutes >= start || nowMinutes < end;
}

/**
 * A hasher's quiet hours, read from their account-wide PUSH preferences. The
 * schema hangs the window off a preference row, so any account-wide PUSH row
 * that carries one speaks for the account; the first is taken.
 */
export async function quietHoursFor(userId: string): Promise<QuietHours | null> {
  const row = await prisma.notificationPreference.findFirst({
    where: {
      userId,
      channel: DeliveryChannel.PUSH,
      kennelId: null,
      eventId: null,
      NOT: { quietHoursStart: null },
    },
    select: { quietHoursStart: true, quietHoursEnd: true },
  });
  if (!row?.quietHoursStart || !row.quietHoursEnd) return null;
  return { start: row.quietHoursStart, end: row.quietHoursEnd };
}

export interface QuietDecision {
  suppressed: boolean;
  /** Plain words for `Notification.evaluationReason` (FR-NOT-010). */
  reason: string | null;
}

/**
 * Should this push be held back? CRITICAL rings through, which is FR-NOT-006's
 * own carve-out for safety: a run paused because someone is hurt is exactly the
 * message a sleeping hasher needs. Everything quieter waits for morning.
 */
export async function evaluateQuietHours(
  userId: string,
  priority: NotificationPriority,
  timeZone: string | null | undefined,
  at: Date = new Date(),
): Promise<QuietDecision> {
  const window = await quietHoursFor(userId);
  if (!window) return { suppressed: false, reason: null };
  if (!within(window, localMinutes(timeZone, at))) return { suppressed: false, reason: null };

  if (priority === NotificationPriority.CRITICAL) {
    return {
      suppressed: false,
      reason: `Quiet hours ${window.start}-${window.end} were overridden because this is critical.`,
    };
  }
  return {
    suppressed: true,
    reason: `Push held back by quiet hours ${window.start}-${window.end}; it is waiting in the app.`,
  };
}
