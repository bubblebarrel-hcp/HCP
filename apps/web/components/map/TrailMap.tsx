'use client';

import { useEffect, useRef } from 'react';
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatLike,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OSM_STYLE } from '@/components/map/osm-style';
import type { RouteGeoJson } from '@/lib/types';
import { cn } from '@/lib/utils';

// MapLibre 6 works out its worker's URL from import.meta.url, which a bundler
// turns into a file:// path, leaving it with an empty URL and no worker, so the
// GeoJSON route layer never loads. The worker is served from our own origin
// instead (copied from node_modules by scripts/sync-maplibre-worker.mjs).
// Module scope, so it is set before any map on the page is created.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export type MarkerTone = 'primary' | 'accent' | 'danger' | 'plain';

export interface MapPoint {
  id: string;
  mark: string;
  label: string;
  latitude: number;
  longitude: number;
  tone: MarkerTone;
}

// Written out in full so Tailwind keeps these classes.
const toneClass: Record<MarkerTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
  danger: 'bg-destructive text-destructive-foreground',
  plain: 'bg-card text-foreground',
};

function emptyRoute(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function routeData(route: RouteGeoJson | null): GeoJSON.FeatureCollection {
  if (!route || route.coordinates.length < 2) return emptyRoute();
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: route }] };
}

export function TrailMap({
  route,
  points,
  center,
  interactive = true,
  onMapClick,
  className,
}: {
  route: RouteGeoJson | null;
  points: MapPoint[];
  center?: [number, number] | null;
  interactive?: boolean;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  // The map is created once, so its click listener reads the latest handler here.
  const clickHandler = useRef(onMapClick);
  // Likewise the route: the source is only created once the style has loaded, and
  // the route can arrive before or after that, so the load handler reads it here
  // instead of relying on an effect having run at the right moment.
  const routeRef = useRef(route);

  useEffect(() => {
    clickHandler.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: OSM_STYLE,
      center: (center ?? [7.4913, 9.0658]) as LngLatLike,
      zoom: 13,
    });
    instance.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    instance.addControl(new ScaleControl({ unit: 'metric' }));
    instance.on('load', () => {
      instance.addSource('route', { type: 'geojson', data: routeData(routeRef.current) });
      instance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        // HCP Orange is the trail (D24).
        paint: { 'line-color': '#f4511e', 'line-width': 4 },
      });
    });
    instance.on('click', (e: MapMouseEvent) => clickHandler.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
    // `center` only seeds the first render; later framing is done by fitBounds.
  }, [center]);

  // Cursor hints that clicking does something.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.getCanvas().style.cursor = onMapClick ? 'crosshair' : '';
  }, [onMapClick]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    // Before the source exists there is nothing to update: the load handler will
    // create it from routeRef, which already holds this route.
    const source = instance.getSource('route') as GeoJSONSource | undefined;
    source?.setData(routeData(route));
  }, [route]);

  // Markers: the simplest correct thing is to redraw them when they change.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    markers.current.forEach((m) => m.remove());
    markers.current = points.map((point) => {
      const el = document.createElement('div');
      el.className = cn(
        'grid h-7 w-7 place-items-center rounded-full border-2 border-card text-[11px] font-bold shadow-md',
        toneClass[point.tone],
      );
      el.textContent = point.mark;
      el.title = point.label;
      el.setAttribute('aria-label', point.label);
      return new Marker({ element: el }).setLngLat([point.longitude, point.latitude]).addTo(instance);
    });
  }, [points]);

  // Keep the whole trail in view.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const coords: [number, number][] = [
      ...(route?.coordinates ?? []),
      ...points.map((p) => [p.longitude, p.latitude] as [number, number]),
    ];
    if (coords.length === 0) return;
    const bounds = coords.reduce(
      (acc, c) => acc.extend(c as LngLatLike),
      new LngLatBounds(coords[0] as LngLatLike, coords[0] as LngLatLike),
    );
    instance.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 });
  }, [route, points]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (interactive) instance.scrollZoom.enable();
    else instance.scrollZoom.disable();
  }, [interactive]);

  return (
    <div
      ref={container}
      className={cn('h-[24rem] w-full overflow-hidden border-y border-border sm:rounded-xl sm:border', className)}
      role="application"
      aria-label="Trail map"
      data-testid="trail-map"
    />
  );
}
