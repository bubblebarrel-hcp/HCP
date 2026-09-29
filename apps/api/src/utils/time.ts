import { ApiError } from './http';

// Runs are planned in the kennel's local wall-clock time ("Saturday 15:00 in
// Abuja") but stored as UTC. Intl does the zone maths, so no tz library.

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function wallParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

// Milliseconds the zone is ahead of UTC at that instant.
function offsetMs(date: Date, timeZone: string) {
  const w = wallParts(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// "2026-09-19T15:00" in "Africa/Lagos" -> 2026-09-19T14:00:00.000Z
export function zonedWallTimeToUtc(local: string, timeZone: string): Date {
  const m = LOCAL_RE.exec(local);
  if (!m) throw ApiError.badRequest('Start time must look like 2026-09-19T15:00.', 'VALIDATION_ERROR');
  if (!isValidTimeZone(timeZone)) throw ApiError.badRequest(`Unknown time zone "${timeZone}".`, 'VALIDATION_ERROR');
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Two passes settle the offset across a daylight-saving boundary.
  let utc = guess - offsetMs(new Date(guess), timeZone);
  utc = guess - offsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

// The inverse, for pre-filling an edit form: "YYYY-MM-DDTHH:mm" in the zone.
export function utcToZonedWallTime(date: Date, timeZone: string): string {
  const w = wallParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}
