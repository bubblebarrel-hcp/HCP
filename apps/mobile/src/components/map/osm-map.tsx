import { forwardRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { UrlTile, type MapViewProps } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';

// D15, as on the web (components/map/osm-style.ts): OpenStreetMap raster tiles, no API
// key. A real tile provider is needed before launch (OSM's tile policy). Every map in
// the app is built on this, so the provider changes in one place.
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const WORLD_REGION = { latitude: 15, longitude: 10, latitudeDelta: 120, longitudeDelta: 120 };

export const OsmMap = forwardRef<MapView, MapViewProps>(function OsmMap({ children, style, ...props }, ref) {
  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        // The tiles are the map: Android can drop its own base layer entirely; Apple
        // Maps cannot, so there the tiles replace it (shouldReplaceMapContent).
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        {...props}>
        <UrlTile urlTemplate={OSM_TILES} maximumZ={19} tileSize={256} zIndex={-1} shouldReplaceMapContent />
        {children}
      </MapView>
      <View pointerEvents="none" style={styles.attribution}>
        <ThemedText style={styles.attributionText}>© OpenStreetMap contributors</ThemedText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#e8e4da' },
  attribution: { position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4 },
  attributionText: { fontSize: 10, lineHeight: 14, color: '#333', fontWeight: '400' },
});
