import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { ApiError } from './http';

// GPX 1.0 and 1.1, in and out (FR-TRAIL-002). Pure: no database, no request. The
// trail service decides what an import may touch; this only reads and writes the
// format.
//
// A GPX file comes from a stranger's watch or a website, so it is read as
// untrusted. Entities are not expanded and a DOCTYPE is refused outright (no
// billion-laughs, no external entities), every coordinate is range-checked, and
// the amount of each kind of thing is capped.

export interface GpxPoint {
  lat: number;
  lng: number;
}

export type ImportedKind = 'BEER_CHECK' | 'START' | 'FINISH' | 'CHECKPOINT' | 'REGROUP' | 'HAZARD' | 'SCENIC' | 'ON_IN' | 'OTHER';

export interface GpxWaypoint extends GpxPoint {
  kind: ImportedKind;
  name: string | null;
  notes: string | null;
}

export interface ParsedGpx {
  name: string | null;
  route: GpxPoint[];
  routeSource: 'track' | 'route' | null;
  waypoints: GpxWaypoint[];
  // What was left behind, so the hare is told rather than left guessing.
  skipped: { badPoints: number; overCap: number; chalk: number };
}

// The trail route is stored as a LineString of at most 5000 points (the API's
// own cap); a watch records one every second or so, far more than a trail needs.
export const MAX_ROUTE_POINTS = 2000;
export const MAX_WAYPOINTS = 200;
const MAX_TEXT = 500;

const ARRAYS = new Set(['trk', 'trkseg', 'trkpt', 'rte', 'rtept', 'wpt']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Never expand entities: nothing in a GPX file needs them.
  processEntities: false,
  htmlEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
  isArray: (name) => ARRAYS.has(name),
});

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = typeof value === 'object' ? (value as Record<string, unknown>)['#text'] : value;
  if (raw === undefined || raw === null) return null;
  const s = String(raw)
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e] ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
  return s ? s.slice(0, MAX_TEXT) : null;
}

function point(node: Record<string, unknown> | undefined): GpxPoint | null {
  if (!node) return null;
  const lat = Number(node['@_lat']);
  const lng = Number(node['@_lon']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// What a waypoint is, from the words around it. Our own export writes one of
// these words as the type, so a file round-trips; other apps' files fall to
// whatever their names suggest, and anything else is a plain checkpoint.
export function classify(name: string | null, type: string | null, sym: string | null, desc: string | null): ImportedKind {
  const own = (type ?? '').toLowerCase();
  const exact: Record<string, ImportedKind> = {
    'beer check': 'BEER_CHECK',
    start: 'START',
    finish: 'FINISH',
    checkpoint: 'CHECKPOINT',
    regroup: 'REGROUP',
    hazard: 'HAZARD',
    scenic: 'SCENIC',
    'on-in': 'ON_IN',
    other: 'OTHER',
  };
  if (exact[own]) return exact[own];

  const words = [name, type, sym, desc].filter(Boolean).join(' ').toLowerCase();
  if (/\bbeer\b|\bbrew|\bpub\b|\bbar\b|\bbc\b|\bdrinks?\b/.test(words)) return 'BEER_CHECK';
  if (/hazard|danger|warning|caution|crossing|traffic/.test(words)) return 'HAZARD';
  if (/re-?group|gather|rally/.test(words)) return 'REGROUP';
  if (/on[- ]?in\b/.test(words)) return 'ON_IN';
  if (/\bstart\b|\bbegin/.test(words)) return 'START';
  if (/\bfinish\b|\bend\b/.test(words)) return 'FINISH';
  if (/scenic|view|photo/.test(words)) return 'SCENIC';
  if (/check/.test(words)) return 'CHECKPOINT';
  return 'CHECKPOINT';
}

export function distanceM(a: GpxPoint, b: GpxPoint) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeLengthM(points: GpxPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceM(points[i - 1], points[i]);
  return Math.round(total);
}

// A watch that logs every second records the same spot a dozen times standing at
// a check. Drop points under a metre from the last kept one, then, if it is still
// too long, keep every nth with the two ends always kept.
export function thin(points: GpxPoint[], max = MAX_ROUTE_POINTS): GpxPoint[] {
  if (points.length <= 2) return points;
  const kept: GpxPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distanceM(kept[kept.length - 1], points[i]) >= 1) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  if (kept.length <= max) return kept;
  const stride = Math.ceil((kept.length - 1) / (max - 1));
  const out = kept.filter((_, i) => i % stride === 0);
  const last = kept[kept.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function parseGpx(xml: string): ParsedGpx {
  if (typeof xml !== 'string' || !xml.trim()) throw ApiError.badRequest('That file is empty.', 'INVALID_GPX');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw ApiError.badRequest('That GPX file uses features we do not read (a DOCTYPE or entities).', 'INVALID_GPX');
  }

  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml) as Record<string, any>;
  } catch {
    throw ApiError.badRequest('That does not read as a GPX file.', 'INVALID_GPX');
  }
  const gpx = doc.gpx as Record<string, any> | undefined;
  if (!gpx || typeof gpx !== 'object') {
    throw ApiError.badRequest('That does not read as a GPX file (no <gpx> element).', 'INVALID_GPX');
  }

  const skipped = { badPoints: 0, overCap: 0, chalk: 0 };

  const readPoints = (nodes: Record<string, unknown>[] | undefined) => {
    const out: GpxPoint[] = [];
    for (const n of nodes ?? []) {
      const p = point(n);
      if (p) out.push(p);
      else skipped.badPoints += 1;
    }
    return out;
  };

  // Prefer a recorded track; fall back to a planned route. If a file holds
  // several, the one with the most points is the trail, not a warm-up lap.
  const tracks: GpxPoint[][] = ((gpx.trk as Record<string, any>[] | undefined) ?? []).map((trk) =>
    ((trk.trkseg as Record<string, any>[] | undefined) ?? []).flatMap((seg) => readPoints(seg.trkpt)),
  );
  const routes: GpxPoint[][] = ((gpx.rte as Record<string, any>[] | undefined) ?? []).map((rte) => readPoints(rte.rtept));
  const longest = (list: GpxPoint[][]) => list.reduce<GpxPoint[]>((best, cur) => (cur.length > best.length ? cur : best), []);

  let route: GpxPoint[] = [];
  let routeSource: ParsedGpx['routeSource'] = null;
  const track = longest(tracks);
  const planned = longest(routes);
  if (track.length >= 2) {
    route = track;
    routeSource = 'track';
  } else if (planned.length >= 2) {
    route = planned;
    routeSource = 'route';
  }
  route = thin(route);

  const waypoints: GpxWaypoint[] = [];
  for (const w of (gpx.wpt as Record<string, any>[] | undefined) ?? []) {
    const p = point(w);
    if (!p) {
      skipped.badPoints += 1;
      continue;
    }
    const name = text(w.name);
    const type = text(w.type);
    // Our own export writes chalk as waypoints so other apps show it; it is a
    // record of where chalk went, not a place to go, so it is not read back.
    if ((type ?? '').toLowerCase() === 'chalk') {
      skipped.chalk += 1;
      continue;
    }
    if (waypoints.length >= MAX_WAYPOINTS) {
      skipped.overCap += 1;
      continue;
    }
    waypoints.push({
      ...p,
      kind: classify(name, type, text(w.sym), text(w.desc) ?? text(w.cmt)),
      name,
      notes: text(w.desc) ?? text(w.cmt),
    });
  }

  const metaName = text((gpx.metadata as Record<string, unknown> | undefined)?.name);
  return { name: metaName, route, routeSource, waypoints, skipped };
}

// ─── Writing ───

export interface GpxExportWaypoint extends GpxPoint {
  name: string | null;
  notes: string | null;
  type: string;
  sym: string;
}

const KIND_TYPE: Record<string, { type: string; sym: string }> = {
  START: { type: 'Start', sym: 'Flag, Green' },
  FINISH: { type: 'Finish', sym: 'Flag, Red' },
  CHECKPOINT: { type: 'Checkpoint', sym: 'Flag, Blue' },
  REGROUP: { type: 'Regroup', sym: 'Picnic Area' },
  HAZARD: { type: 'Hazard', sym: 'Danger Area' },
  SCENIC: { type: 'Scenic', sym: 'Scenic Area' },
  ON_IN: { type: 'On-in', sym: 'Flag, Red' },
  OTHER: { type: 'Other', sym: 'Waypoint' },
  BEER_CHECK: { type: 'Beer check', sym: 'Bar' },
  CHALK: { type: 'Chalk', sym: 'Waypoint' },
};

export function exportKind(kind: keyof typeof KIND_TYPE) {
  return KIND_TYPE[kind] ?? KIND_TYPE.OTHER;
}

// Pull every LineString out of whatever GeoJSON the route was stored as.
export function routeSegments(geojson: unknown): GpxPoint[][] {
  const segments: GpxPoint[][] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'LineString' && Array.isArray(node.coordinates)) {
      segments.push(toPoints(node.coordinates));
    } else if (node.type === 'MultiLineString' && Array.isArray(node.coordinates)) {
      for (const line of node.coordinates) segments.push(toPoints(line));
    } else if (node.type === 'Feature') visit(node.geometry);
    else if (node.type === 'FeatureCollection' && Array.isArray(node.features)) node.features.forEach(visit);
  };
  const toPoints = (coords: unknown[]): GpxPoint[] =>
    (coords as unknown[][])
      .map((c) => ({ lng: Number(c?.[0]), lat: Number(c?.[1]) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  visit(geojson);
  return segments.filter((s) => s.length > 0);
}

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
  processEntities: true,
});

const clean = (s: string | null | undefined) =>
  s ? s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '') : undefined;

export function buildGpx(input: {
  name: string;
  description?: string | null;
  route: GpxPoint[][];
  waypoints: GpxExportWaypoint[];
  time?: Date;
}) {
  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    gpx: {
      '@_version': '1.1',
      '@_creator': 'Shiggy Trails',
      '@_xmlns': 'http://www.topografix.com/GPX/1/1',
      metadata: {
        name: clean(input.name),
        desc: clean(input.description),
        time: (input.time ?? new Date()).toISOString(),
      },
      wpt: input.waypoints.map((w) => ({
        '@_lat': w.lat.toFixed(6),
        '@_lon': w.lng.toFixed(6),
        name: clean(w.name),
        desc: clean(w.notes),
        sym: w.sym,
        type: w.type,
      })),
      trk: input.route.length
        ? {
            name: clean(input.name),
            trkseg: input.route.map((seg) => ({
              trkpt: seg.map((p) => ({ '@_lat': p.lat.toFixed(6), '@_lon': p.lng.toFixed(6) })),
            })),
          }
        : undefined,
    },
  };
  return builder.build(doc) as string;
}
