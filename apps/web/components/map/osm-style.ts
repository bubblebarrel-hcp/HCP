import type { StyleSpecification } from 'maplibre-gl';

// D15: MapLibre on OpenStreetMap raster tiles. No API key, which is right for
// development; a real tile provider is needed before launch (OSM's tile policy).
//
// Both maps read this, so the provider changes in one place rather than two.
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
