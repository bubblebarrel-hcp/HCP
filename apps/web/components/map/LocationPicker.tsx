'use client';

import { useEffect, useState } from 'react';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Crosshair, Loader2 } from 'lucide-react';
import { GoogleMap, WORLD_CENTER, WORLD_ZOOM } from '@/components/map/GoogleMap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Where a kennel is, dropped on a map rather than typed. A kennel with no
// coordinates is listed in the directory but never pinned on the world map
// (D38), and nobody knows their own latitude off the top of their head.
//
// The map is an enhancement: the numeric fields beside it are the real input,
// so the form still works without JavaScript or without this island loading.

const PLACE_ZOOM = 12;

type Point = { latitude: number; longitude: number };

const round = (n: number) => Number(n.toFixed(6));

// Moves the view: when the pin would otherwise be off screen, and when asked to
// ("use my location"). Dragging the pin around should not yank the map from under
// the hand doing the dragging, so a pin that is still on screen leaves the view alone.
function Follow({ point, jump }: { point: Point | null; jump: { at: Point; n: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !point) return;
    const at = { lat: point.latitude, lng: point.longitude };
    if (!map.getBounds()?.contains(at)) {
      map.panTo(at);
      if ((map.getZoom() ?? 0) < PLACE_ZOOM) map.setZoom(PLACE_ZOOM);
    }
  }, [map, point]);

  useEffect(() => {
    if (!map || !jump) return;
    map.panTo({ lat: jump.at.latitude, lng: jump.at.longitude });
    map.setZoom(PLACE_ZOOM);
  }, [map, jump]);

  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  className,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (point: Point) => void;
  className?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [jump, setJump] = useState<{ at: Point; n: number } | null>(null);
  const pinned = latitude !== null && longitude !== null;
  const point = pinned ? { latitude, longitude } : null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setDenied('This browser cannot share a location. Drop the pin instead.');
      return;
    }
    setLocating(true);
    setDenied(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const at = { latitude: round(position.coords.latitude), longitude: round(position.coords.longitude) };
        onChange(at);
        setJump((prev) => ({ at, n: (prev?.n ?? 0) + 1 }));
      },
      () => {
        setLocating(false);
        setDenied('Could not read your location. Drop the pin on the map instead.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <GoogleMap
        className="h-64 w-full overflow-hidden rounded-lg border border-border"
        label="Map for choosing where the kennel hashes"
        testId="location-picker-map"
        defaultCenter={WORLD_CENTER}
        defaultZoom={WORLD_ZOOM}
        // A map inside a form should never swallow the page's scroll.
        gestureHandling="cooperative"
        draggableCursor="crosshair"
        onClick={(event) => {
          const at = event.detail.latLng;
          if (at) onChange({ latitude: round(at.lat), longitude: round(at.lng) });
        }}>
        <Follow point={point} jump={jump} />
        {point && (
          <AdvancedMarker
            position={{ lat: point.latitude, lng: point.longitude }}
            draggable
            onDragEnd={(event) => {
              const next = event.latLng;
              if (next) onChange({ latitude: round(next.lat()), longitude: round(next.lng()) });
            }}>
            <div className="h-5 w-5 rounded-full border-2 border-card bg-primary shadow-md" />
          </AdvancedMarker>
        )}
      </GoogleMap>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} data-testid="use-my-location">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          {locating ? 'Finding you…' : 'Use my location'}
        </Button>
        <p className="text-sm text-muted-foreground" data-testid="location-picker-status">
          {pinned
            ? `Pin at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Tap the map or drag the pin to move it.`
            : 'Tap the map where your kennel hashes.'}
        </p>
      </div>
      {denied && (
        <p className="text-sm text-muted-foreground" role="status">
          {denied}
        </p>
      )}
    </div>
  );
}
