import { DigestFrequency } from '@prisma/client';
import { isValidTimeZone, utcToZonedWallTime, zonedWallTimeToUtc } from './time';

// FR-NOT-007. A digest has no state of its own: a held notification is due once
// the most recent digest time for its owner has passed since it was held. So
// asking "is this due?" needs only the clock and the hasher's time zone, and
// nothing has to remember when the last digest went out. A restart, a second
// sweep or a missed hour changes nothing: the next sweep finds the same answer.

export const MORNING_HOUR = 8;
export const EVENING_HOUR = 18;
// Monday, the way Hash weeks are counted from the run on Saturday.
const WEEKLY_DAY = 1;

const pad = (n: number) => String(n).padStart(2, '0');

// The wall-clock date in a zone, as numbers.
function localDate(at: Date, timeZone: string) {
  const [date] = utcToZonedWallTime(at, timeZone).split('T');
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function atLocalHour(y: number, m: number, d: number, hour: number, timeZone: string) {
  return zonedWallTimeToUtc(`${y}-${pad(m)}-${pad(d)}T${pad(hour)}:00`, timeZone);
}

function addDays(y: number, m: number, d: number, days: number) {
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
}

function weekday(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The latest moment at or before `now` at which a digest of this frequency
 * went out (or would have). A notification held at or before it is due.
 * IMMEDIATE has no schedule: everything is due at once.
 *
 * The zone is the hasher's own; an unset or unknown one falls back to UTC, the
 * same fallback quiet hours use, rather than guessing.
 */
export function lastDigestTime(frequency: DigestFrequency, timeZone: string | null | undefined, now: Date): Date {
  if (frequency === DigestFrequency.IMMEDIATE) return now;

  if (frequency === DigestFrequency.HOURLY) {
    // The top of the hour, in UTC: every real zone's hour boundary lines up with
    // it closely enough for "about once an hour", and it is the same everywhere.
    return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  }

  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const hour = frequency === DigestFrequency.EVENING ? EVENING_HOUR : MORNING_HOUR;
  let { y, m, d } = localDate(now, zone);

  // Walk back to the most recent day whose digest time has already passed (and,
  // for the weekly one, which is a Monday). Seven steps always find it.
  for (let i = 0; i < 8; i++) {
    const candidate = atLocalHour(y, m, d, hour, zone);
    const dayOk = frequency !== DigestFrequency.WEEKLY || weekday(y, m, d) === WEEKLY_DAY;
    if (dayOk && candidate.getTime() <= now.getTime()) return candidate;
    ({ y, m, d } = addDays(y, m, d, -1));
  }
  // Unreachable, but a schedule must never throw inside a sweep.
  return now;
}

/** Is something held at `heldAt` due at `now`? */
export function isDue(frequency: DigestFrequency, timeZone: string | null | undefined, heldAt: Date, now: Date) {
  return heldAt.getTime() <= lastDigestTime(frequency, timeZone, now).getTime();
}

export const DIGEST_LABELS: Record<DigestFrequency, string> = {
  IMMEDIATE: 'straight away',
  HOURLY: 'every hour',
  MORNING: 'every morning',
  EVENING: 'every evening',
  WEEKLY: 'every Monday morning',
};
