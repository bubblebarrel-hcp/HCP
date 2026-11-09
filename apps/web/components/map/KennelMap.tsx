'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { GoogleMap, WORLD_CENTER, WORLD_ZOOM } from '@/components/map/GoogleMap';
import { cn } from '@/lib/utils';

// Where the hash is in the world: one pin per kennel, and selecting one opens
// it. The page renders without this (it is an island), so a reader with no
// JavaScript still gets the list below.

export interface KennelPin {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

// Never frame so tightly that it stops reading as a world map.
const MAX_FIT_ZOOM = 5;

// Frames the pins once the map exists.
function FitPins({ kennels }: { kennels: KennelPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || kennels.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    kennels.forEach((k) => bounds.extend({ lat: k.latitude, lng: k.longitude }));
    map.fitBounds(bounds, 64);
    const cap = google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM);
    });
    return () => cap.remove();
  }, [map, kennels]);
  return null;
}

export function KennelMap({ kennels, className }: { kennels: KennelPin[]; className?: string }) {
  const router = useRouter();

  return (
    <GoogleMap
      className={cn('h-[18rem] w-full overflow-hidden sm:h-[22rem]', className)}
      label="Map of kennels around the world"
      testId="kennel-map"
      defaultCenter={WORLD_CENTER}
      defaultZoom={WORLD_ZOOM}
      // A map sitting inside a page should never swallow the page's scroll.
      gestureHandling="cooperative">
      <FitPins kennels={kennels} />
      {kennels.map((kennel) => {
        const label = `${kennel.name}, ${kennel.city}, ${kennel.country}`;
        // D24: orange is a fill, and the letter sits on the pale disc, not on orange.
        const initial = kennel.shortName.slice(0, 1).toUpperCase().replace(/[^A-Z0-9]/, '');
        return (
          <AdvancedMarker key={kennel.id} position={{ lat: kennel.latitude, lng: kennel.longitude }} title={label}>
            {/* A pin, not a dot: the tip of the teardrop is the kennel's location, which is
                why the marker sits on its bottom edge. */}
            <button
              type="button"
              aria-label={label}
              onClick={() => router.push(`/kennels/${kennel.slug}`)}
              className="group block cursor-pointer border-0 bg-transparent p-0 leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <svg
                width="26"
                height="34"
                viewBox="0 0 26 34"
                aria-hidden="true"
                focusable="false"
                className="origin-bottom drop-shadow-md transition-transform duration-150 group-hover:scale-110">
                <path
                  className="fill-primary stroke-card"
                  strokeWidth="1.5"
                  d="M13 1C6.4 1 1 6.3 1 12.9c0 8.6 10.5 19.3 11 19.8.3.3.8.3 1.1 0 .5-.5 11-11.2 11-19.8C24 6.3 19.6 1 13 1Z"
                />
                <circle className="fill-card" cx="13" cy="12.8" r="6.6" />
                <text
                  className="fill-foreground"
                  x="13"
                  y="16"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif">
                  {initial}
                </text>
              </svg>
            </button>
          </AdvancedMarker>
        );
      })}
    </GoogleMap>
  );
}
