import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import { Marker, Polyline } from 'react-native-maps';

import { OsmMap } from '@/components/map/osm-map';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MapPoint } from '@/lib/trails';
import type { RouteGeoJson } from '@/lib/types';

// The trail on a map, as the web draws it (components/map/TrailMap.tsx): the route as an
// HCP Orange line (D24), a round mark per waypoint, beer check and chalk, and the whole
// trail kept in view. It only ever draws what it is handed: trail secrecy is the server's
// job, so a viewer who may not see the route is never given one to draw.
const DEFAULT_CENTER = { latitude: 9.0658, longitude: 7.4913 };

export function TrailMap({
  route,
  points,
  center,
  interactive = true,
  onMapClick,
  height = 384,
}: {
  route: RouteGeoJson | null;
  points: MapPoint[];
  // [longitude, latitude], as GeoJSON has it.
  center?: [number, number] | null;
  interactive?: boolean;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  height?: number;
}) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  // Custom marks are snapshotted by the native map; keep tracking on while they change.
  const [tracking, setTracking] = useState(true);

  const tone = {
    primary: { bg: theme.primary, fg: theme.onPrimary },
    accent: { bg: theme.accent, fg: '#171717' },
    danger: { bg: theme.danger, fg: '#ffffff' },
    plain: { bg: theme.card, fg: theme.text },
  } as const;

  const line = route && route.coordinates.length >= 2 ? route.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) : [];

  // Keep the whole trail in view.
  useEffect(() => {
    if (!ready) return;
    const coords = [
      ...(route?.coordinates ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      ...points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    ];
    if (coords.length === 0) return;
    map.current?.fitToCoordinates(coords, { edgePadding: { top: 56, right: 56, bottom: 56, left: 56 }, animated: false });
  }, [ready, route, points]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 800);
    return () => clearTimeout(t);
  }, [points]);

  return (
    <OsmMap
      ref={map}
      testID="trail-map"
      accessibilityLabel="Trail map"
      style={[styles.map, { height, borderColor: theme.border }]}
      initialRegion={{
        latitude: center ? center[1] : DEFAULT_CENTER.latitude,
        longitude: center ? center[0] : DEFAULT_CENTER.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      onMapReady={() => setReady(true)}
      onPress={(event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        onMapClick?.({ lng: longitude, lat: latitude });
      }}>
      {line.length > 0 && <Polyline coordinates={line} strokeColor="#f4511e" strokeWidth={4} lineCap="round" lineJoin="round" />}
      {points.map((point) => (
        <Marker
          key={point.id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          tracksViewChanges={tracking}
          title={point.label}
          accessibilityLabel={point.label}>
          {/* grid h-7 w-7 place-items-center rounded-full border-2 border-card text-[11px] font-bold */}
          <View style={[styles.mark, { backgroundColor: tone[point.tone].bg, borderColor: theme.card }]}>
            <ThemedText style={[styles.markText, { color: tone[point.tone].fg }]}>{point.mark}</ThemedText>
          </View>
        </Marker>
      ))}
    </OsmMap>
  );
}

const styles = StyleSheet.create({
  // h-[24rem] w-full overflow-hidden border-y border-border
  map: { width: '100%', borderTopWidth: 1, borderBottomWidth: 1 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
