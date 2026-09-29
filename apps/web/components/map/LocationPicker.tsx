'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Loader2 } from 'lucide-react';
import { OSM_STYLE } from '@/components/map/osm-style';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Where a kennel is, dropped on a map rather than typed. A kennel with no
// coordinates is listed in the directory but never pinned on the world map
// (D38), and nobody knows their own latitude off the top of their head.
//
// The map is an enhancement: the numeric fields beside it are the real input,
// so the form still works without JavaScript or without this island loading.

const WORLD: { center: LngLatLike; zoom: number } = { center: [10, 15], zoom: 1.2 };
const PLACE_ZOOM = 11;

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  className,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (point: { latitude: number; longitude: number }) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  // The map is built once, so its handlers read the latest callback from here.
  const emit = useRef(onChange);
  useEffect(() => {
    emit.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: OSM_STYLE,
      center: WORLD.center,
      zoom: WORLD.zoom,
      // A map inside a form should never swallow the page's scroll.
      scrollZoom: false,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.on('click', (event) => {
      emit.current({ latitude: Number(event.lngLat.lat.toFixed(6)), longitude: Number(event.lngLat.lng.toFixed(6)) });
    });
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // The pin follows the value, wherever it was changed: the map, the fields, or
  // the browser's own idea of where it is.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (latitude === null || longitude === null) {
      marker.current?.remove();
      marker.current = null;
      return;
    }

    const point: LngLatLike = [longitude, latitude];
    if (!marker.current) {
      const element = document.createElement('div');
      element.className = 'h-5 w-5 rounded-full border-2 border-card bg-primary shadow-md';
      marker.current = new Marker({ element, draggable: true })
        .setLngLat(point)
        .addTo(instance);
      marker.current.on('dragend', () => {
        const next = marker.current?.getLngLat();
        if (next) emit.current({ latitude: Number(next.lat.toFixed(6)), longitude: Number(next.lng.toFixed(6)) });
      });
    } else {
      marker.current.setLngLat(point);
    }
    // Only fly when the pin would otherwise be off screen; dragging it around
    // should not yank the map from under the hand doing the dragging.
    if (!instance.getBounds().contains(point)) {
      instance.easeTo({ center: point, zoom: Math.max(instance.getZoom(), PLACE_ZOOM), duration: 400 });
    }
  }, [latitude, longitude]);

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
        emit.current({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        map.current?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: PLACE_ZOOM,
          duration: 400,
        });
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
      <div
        ref={container}
        className="h-64 w-full overflow-hidden rounded-lg border border-border"
        role="application"
        aria-label="Map for choosing where the kennel hashes"
        data-testid="location-picker-map"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} data-testid="use-my-location">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
          {locating ? 'Finding you…' : 'Use my location'}
        </Button>
        <p className="text-sm text-muted-foreground" data-testid="location-picker-status">
          {latitude !== null && longitude !== null
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
