'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OSM_STYLE } from '@/components/map/osm-style';
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

export function KennelMap({ kennels, className }: { kennels: KennelPin[]; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const router = useRouter();
  // The map is built once, so its markers read the latest router from here.
  const open = useRef((slug: string) => router.push(`/kennels/${slug}`));

  useEffect(() => {
    open.current = (slug: string) => router.push(`/kennels/${slug}`);
  }, [router]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: OSM_STYLE,
      // The whole world, since a kennel could be anywhere.
      center: [10, 15] as LngLatLike,
      zoom: 1.2,
      // A map sitting inside a page should never swallow the page's scroll.
      scrollZoom: false,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  // Redrawing the pins when they change is the simplest correct thing.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    markers.current.forEach((m) => m.remove());
    markers.current = kennels.map((kennel) => {
      const el = document.createElement('button');
      el.type = 'button';
      // MapLibre positions this element by writing `transform: translate(...)`
      // onto it on every render of the map. Anything that sets a CSS transform
      // here (a hover scale, a transition) overwrites that translate and the pin
      // jumps away from its location. The hover effect lives on the inner svg,
      // which MapLibre does not touch.
      el.className =
        'group block cursor-pointer border-0 bg-transparent p-0 leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
      // A pin, not a dot: the tip of the teardrop is the kennel's location, which
      // is why the marker is anchored at its bottom rather than its centre.
      // D24: orange is a fill, and the letter sits on the pale disc, not on orange.
      const initial = kennel.shortName.slice(0, 1).toUpperCase().replace(/[^A-Z0-9]/, '');
      el.innerHTML = `
        <svg
          width="26"
          height="34"
          viewBox="0 0 26 34"
          aria-hidden="true"
          focusable="false"
          class="origin-bottom drop-shadow-md transition-transform duration-150 group-hover:scale-110"
        >
          <path
            class="fill-primary stroke-card"
            stroke-width="1.5"
            d="M13 1C6.4 1 1 6.3 1 12.9c0 8.6 10.5 19.3 11 19.8.3.3.8.3 1.1 0 .5-.5 11-11.2 11-19.8C24 6.3 19.6 1 13 1Z"
          />
          <circle class="fill-card" cx="13" cy="12.8" r="6.6" />
          <text
            class="fill-foreground"
            x="13"
            y="16"
            text-anchor="middle"
            font-size="9"
            font-weight="700"
            font-family="system-ui, sans-serif"
          >${initial}</text>
        </svg>`;
      const label = `${kennel.name}, ${kennel.city}, ${kennel.country}`;
      el.title = label;
      el.setAttribute('aria-label', label);
      el.addEventListener('click', () => open.current(kennel.slug));
      return new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([kennel.longitude, kennel.latitude])
        .addTo(instance);
    });
  }, [kennels]);

  // Frame the pins, but never so tightly that it stops reading as a world map.
  useEffect(() => {
    const instance = map.current;
    if (!instance || kennels.length === 0) return;
    const first: LngLatLike = [kennels[0].longitude, kennels[0].latitude];
    const bounds = kennels.reduce(
      (acc, k) => acc.extend([k.longitude, k.latitude] as LngLatLike),
      new LngLatBounds(first, first),
    );
    instance.fitBounds(bounds, { padding: 64, maxZoom: 4, duration: 0 });
  }, [kennels]);

  return (
    <div
      ref={container}
      className={cn('h-[18rem] w-full overflow-hidden sm:h-[22rem]', className)}
      role="application"
      aria-label="Map of kennels around the world"
      data-testid="kennel-map"
    />
  );
}
