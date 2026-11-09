'use client';

import { useEffect } from 'react';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { GoogleMap } from '@/components/map/GoogleMap';
import type { RouteGeoJson } from '@/lib/types';
import { cn } from '@/lib/utils';

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

const MAX_FIT_ZOOM = 17;

// The route as a line. HCP Orange is the trail (D24).
function RouteLine({ route }: { route: RouteGeoJson | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const path =
      route && route.coordinates.length >= 2 ? route.coordinates.map(([lng, lat]) => ({ lat, lng })) : [];
    const line = new google.maps.Polyline({ path, strokeColor: '#f4511e', strokeOpacity: 1, strokeWeight: 4, map });
    return () => line.setMap(null);
  }, [map, route]);
  return null;
}

// Keeps the whole trail in view.
function FitTrail({ route, points }: { route: RouteGeoJson | null; points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const coords = [
      ...(route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
      ...points.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    ];
    if (coords.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, 56);
    // A single point would otherwise zoom right in.
    const cap = google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
    });
    return () => cap.remove();
  }, [map, route, points]);
  return null;
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
  // [longitude, latitude], as GeoJSON has it. Only seeds the first view; framing is done by FitTrail.
  center?: [number, number] | null;
  interactive?: boolean;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  className?: string;
}) {
  return (
    <GoogleMap
      className={cn('h-[24rem] w-full overflow-hidden border-y border-border sm:rounded-xl sm:border', className)}
      label="Trail map"
      testId="trail-map"
      defaultCenter={center ? { lat: center[1], lng: center[0] } : { lat: 9.0658, lng: 7.4913 }}
      defaultZoom={14}
      gestureHandling={interactive ? 'greedy' : 'cooperative'}
      // Cursor hints that clicking does something.
      draggableCursor={onMapClick ? 'crosshair' : undefined}
      onClick={(event) => {
        const at = event.detail.latLng;
        if (at && onMapClick) onMapClick({ lng: at.lng, lat: at.lat });
      }}>
      <RouteLine route={route} />
      <FitTrail route={route} points={points} />
      {points.map((point) => (
        <AdvancedMarker key={point.id} position={{ lat: point.latitude, lng: point.longitude }} title={point.label}>
          <div
            aria-label={point.label}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-full border-2 border-card text-[11px] font-bold shadow-md',
              toneClass[point.tone],
            )}>
            {point.mark}
          </div>
        </AdvancedMarker>
      ))}
    </GoogleMap>
  );
}
