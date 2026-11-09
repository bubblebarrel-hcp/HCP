'use client';

import type { ReactNode } from 'react';
import { APIProvider, Map, type MapProps } from '@vis.gl/react-google-maps';
import { cn } from '@/lib/utils';

// Every map on the site is built on this, so the provider changes in one place.
//
// The key is a browser key for the Maps JavaScript API, restricted in Google Cloud to
// this site's addresses (HTTP referrers) and to that one API. It ships in the page, so
// the restriction is the protection, not secrecy. It is a different key from the
// mobile app's, which is restricted to the Android package.
//
// AdvancedMarker needs a Map ID. DEMO_MAP_ID works for development; create a real one
// in Google Cloud (Map Management) and set NEXT_PUBLIC_GOOGLE_MAP_ID for production.
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

export const WORLD_CENTER = { lat: 15, lng: 10 };
export const WORLD_ZOOM = 2;

export function GoogleMap({
  className,
  label,
  testId,
  children,
  ...props
}: {
  className?: string;
  label: string;
  testId: string;
  children?: ReactNode;
} & Omit<MapProps, 'children' | 'className' | 'mapId'>) {
  return (
    <div className={cn('relative', className)} role="application" aria-label={label} data-testid={testId}>
      {API_KEY ? (
        <APIProvider apiKey={API_KEY}>
          <Map
            mapId={MAP_ID}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            clickableIcons={false}
            {...props}>
            {children}
          </Map>
        </APIProvider>
      ) : (
        <div className="grid h-full w-full place-items-center bg-muted p-4 text-center text-sm text-muted-foreground" role="status">
          The map is not available right now.
        </div>
      )}
    </div>
  );
}
