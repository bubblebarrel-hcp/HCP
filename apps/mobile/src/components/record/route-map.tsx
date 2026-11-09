import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import { Marker, Polyline } from 'react-native-maps';

import { AppMap } from '@/components/map/app-map';
import { useTheme } from '@/hooks/use-theme';

// A recorded route on the map (D79): the line the hasher ran, in HCP Orange as the
// trail is drawn (trail-map.tsx), with a mark at the start and at the latest
// position. Used live, where it follows the runner, and afterwards, where it frames
// the whole run. A run with pauses is several lines, so a pause is not drawn as a
// straight run to wherever the hasher restarted.
export interface RouteSegment {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER = { latitude: 9.0658, longitude: 7.4913 };

export function RouteMap({
  segments,
  follow = false,
  height = 320,
  testID = 'route-map',
}: {
  segments: RouteSegment[][];
  // Keep the latest position centred (live), rather than the whole route in view.
  follow?: boolean;
  height?: number;
  testID?: string;
}) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  const all = segments.flat();
  const first = all[0];
  const last = all[all.length - 1];
  const count = all.length;

  useEffect(() => {
    if (!ready || count === 0) return;
    if (follow && last) {
      map.current?.animateCamera({ center: last, zoom: 17 }, { duration: 400 });
    } else {
      map.current?.fitToCoordinates(all, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false });
    }
    // The route changes by growing; the length is the signal, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, count, follow]);

  return (
    <AppMap
      ref={map}
      testID={testID}
      accessibilityLabel="Route map"
      style={[styles.map, { height, borderColor: theme.border }]}
      initialRegion={{
        latitude: first?.latitude ?? DEFAULT_CENTER.latitude,
        longitude: first?.longitude ?? DEFAULT_CENTER.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      scrollEnabled={!follow}
      zoomEnabled={!follow}
      onMapReady={() => setReady(true)}>
      {segments.map(
        (line, i) =>
          line.length >= 2 && (
            <Polyline key={i} coordinates={line} strokeColor="#f4511e" strokeWidth={5} lineCap="round" lineJoin="round" />
          ),
      )}
      {first && (
        <Marker coordinate={first} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[styles.dot, { backgroundColor: theme.trail, borderColor: theme.card }]} />
        </Marker>
      )}
      {last && count > 1 && (
        <Marker coordinate={last} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={[styles.dot, styles.dotLast, { backgroundColor: theme.primary, borderColor: theme.card }]} />
        </Marker>
      )}
    </AppMap>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderTopWidth: 1, borderBottomWidth: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  dotLast: { width: 20, height: 20, borderRadius: 10 },
});
