// Run-tracking maths (D79). Pure: points in, numbers out, no database.
//
// The phone sends its raw GPS fixes; the numbers are worked out here so a hasher
// cannot post a faster time than their track shows, and so every client (phone,
// web, replay) reads the same figures.

export interface TrackPoint {
  lat: number;
  lng: number;
  // Metres above sea level, when the phone had a fix on it.
  ele: number | null;
  // Epoch milliseconds.
  t: number;
  // Which stretch of the recording this fix belongs to. The phone starts a new
  // one each time the hasher resumes from a pause, so the way from where they
  // stopped to where they restarted is not counted as running.
  seg?: number;
  // Horizontal accuracy in metres, when the phone reported one.
  acc?: number | null;
}

export interface Split {
  index: number;
  distanceM: number;
  timeS: number;
  paceSPerKm: number;
}

export interface ActivityStats {
  startedAtMs: number;
  endedAtMs: number;
  elapsedTimeS: number;
  movingTimeS: number;
  distanceM: number;
  avgPaceSPerKm: number | null;
  elevationGainM: number;
  elevationLossM: number;
  splits: Split[];
  // [lat, lng, ele, msSinceStart]: the fixes that survived cleaning.
  track: [number, number, number | null, number][];
}

// A fix worse than this is a guess, not a position.
export const MAX_ACCURACY_M = 50;
// Faster than this between two fixes is a GPS jump (54 km/h; a sprinter peaks near 12 m/s).
export const MAX_SPEED_MS = 15;
// Slower than this is standing still: neither time nor distance counts (auto-pause).
export const MIN_MOVING_SPEED_MS = 0.5;
// Less than this from the last counted position is GPS drift, not a step.
export const MIN_STEP_M = 3;
// A rise or fall smaller than this is barometer and GPS noise, not a hill.
export const ELEVATION_NOISE_M = 3;
// A last partial split shorter than this is not worth a row.
export const MIN_PARTIAL_SPLIT_M = 50;
// What anyone but the hasher does not see at each end of a track (D79).
export const PRIVACY_TRIM_M = 200;

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Drop the fixes that cannot be right: poor accuracy, time standing still or
// running backwards, and jumps no runner makes.
export function cleanTrack(points: TrackPoint[]): TrackPoint[] {
  const kept: TrackPoint[] = [];
  for (const p of points) {
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(p);
      continue;
    }
    const dt = (p.t - last.t) / 1000;
    if (dt <= 0) continue;
    if ((p.seg ?? 0) === (last.seg ?? 0) && haversineM(last.lat, last.lng, p.lat, p.lng) / dt > MAX_SPEED_MS) continue;
    kept.push(p);
  }
  return kept;
}

// Climb and descent with the noise taken out: a move only counts once it has
// travelled ELEVATION_NOISE_M from the last height that counted.
export function elevationChange(heights: number[]) {
  let gain = 0;
  let loss = 0;
  if (heights.length === 0) return { gain, loss };
  let ref = heights[0];
  for (const h of heights) {
    const delta = h - ref;
    if (Math.abs(delta) < ELEVATION_NOISE_M) continue;
    if (delta > 0) gain += delta;
    else loss -= delta;
    ref = h;
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

export function computeStats(raw: TrackPoint[]): ActivityStats {
  const points = cleanTrack(raw);
  if (points.length < 2) {
    return { startedAtMs: 0, endedAtMs: 0, elapsedTimeS: 0, movingTimeS: 0, distanceM: 0, avgPaceSPerKm: null, elevationGainM: 0, elevationLossM: 0, splits: [], track: [] };
  }

  const startT = points[0].t;
  let movingTimeS = 0;
  let distanceM = 0;
  const splits: Split[] = [];
  let nextSplitAt = 1000;
  let lastSplitTimeS = 0;
  let lastSplitDistM = 0;

  // A step only counts once the hasher is MIN_STEP_M from the last position that
  // counted: a phone lying on a table drifts a metre or two a second, and that is
  // not running.
  let anchor = points[0];
  for (let i = 1; i < points.length; i++) {
    const a = anchor;
    // A resume starts afresh: nothing is counted across the pause.
    if ((points[i].seg ?? 0) !== (a.seg ?? 0)) {
      anchor = points[i];
      continue;
    }
    const b = points[i];
    const d = haversineM(a.lat, a.lng, b.lat, b.lng);
    if (d < MIN_STEP_M) continue;
    anchor = b;
    const dt = (b.t - a.t) / 1000;
    if (d / dt < MIN_MOVING_SPEED_MS) continue;

    // A segment can cross one split line or several (a long gap between fixes).
    while (distanceM + d >= nextSplitAt) {
      const f = (nextSplitAt - distanceM) / d;
      const timeAtLine = movingTimeS + f * dt;
      const timeS = timeAtLine - lastSplitTimeS;
      const dist = nextSplitAt - lastSplitDistM;
      splits.push({ index: splits.length + 1, distanceM: Math.round(dist), timeS: Math.round(timeS), paceSPerKm: Math.round(timeS / (dist / 1000)) });
      lastSplitTimeS = timeAtLine;
      lastSplitDistM = nextSplitAt;
      nextSplitAt += 1000;
    }
    distanceM += d;
    movingTimeS += dt;
  }

  const rest = distanceM - lastSplitDistM;
  if (rest >= MIN_PARTIAL_SPLIT_M) {
    const timeS = movingTimeS - lastSplitTimeS;
    splits.push({ index: splits.length + 1, distanceM: Math.round(rest), timeS: Math.round(timeS), paceSPerKm: Math.round(timeS / (rest / 1000)) });
  }

  const heights = points.map((p) => p.ele).filter((h): h is number => h != null);
  const { gain, loss } = elevationChange(heights);

  return {
    startedAtMs: startT,
    endedAtMs: points[points.length - 1].t,
    elapsedTimeS: Math.round((points[points.length - 1].t - startT) / 1000),
    movingTimeS: Math.round(movingTimeS),
    distanceM: Math.round(distanceM),
    avgPaceSPerKm: distanceM >= 10 ? Math.round(movingTimeS / (distanceM / 1000)) : null,
    elevationGainM: gain,
    elevationLossM: loss,
    splits,
    track: points.map((p) => [round6(p.lat), round6(p.lng), p.ele == null ? null : Math.round(p.ele * 10) / 10, p.t - startT]),
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

// What a viewer other than the hasher is given: the track without the first and
// last PRIVACY_TRIM_M metres, measured as a straight line from each end. A
// hasher's front door is exactly where a track starts and stops. A track too
// short to leave anything in the middle is dropped altogether.
export function trimTrackEnds(track: [number, number, number | null, number][], trimM = PRIVACY_TRIM_M) {
  if (track.length === 0) return [];
  const [startLat, startLng] = track[0];
  const [endLat, endLng] = track[track.length - 1];

  let from = 0;
  while (from < track.length && haversineM(startLat, startLng, track[from][0], track[from][1]) < trimM) from++;
  let to = track.length - 1;
  while (to >= 0 && haversineM(endLat, endLng, track[to][0], track[to][1]) < trimM) to--;

  return from > to ? [] : track.slice(from, to + 1);
}
