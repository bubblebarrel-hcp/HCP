import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type MapView from 'react-native-maps';
import { Marker } from 'react-native-maps';
import { Crosshair } from 'lucide-react-native';
import * as Location from 'expo-location';

import { OsmMap, WORLD_REGION } from '@/components/map/osm-map';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// Where a kennel is, dropped on a map rather than typed (components/map/LocationPicker.tsx).
// A kennel with no coordinates is listed in the directory but never pinned on the world
// map (D38), and nobody knows their own latitude off the top of their head. The numeric
// fields beside it are the real input; this is the convenience.
const PLACE_DELTA = 0.2;

const round = (n: number) => Number(n.toFixed(6));

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (point: { latitude: number; longitude: number }) => void;
}) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const pinned = latitude !== null && longitude !== null;

  async function locateMe() {
    setLocating(true);
    setDenied(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setDenied('Could not read your location. Drop the pin on the map instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: round(position.coords.latitude), longitude: round(position.coords.longitude) };
      onChange(point);
      map.current?.animateToRegion({ ...point, latitudeDelta: PLACE_DELTA, longitudeDelta: PLACE_DELTA }, 400);
    } catch {
      setDenied('Could not read your location. Drop the pin on the map instead.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.root} testID="found-location">
      <OsmMap
        ref={map}
        testID="location-picker-map"
        accessibilityLabel="Map for choosing where the kennel hashes"
        style={[styles.map, { borderColor: theme.border }]}
        initialRegion={
          pinned ? { latitude, longitude, latitudeDelta: PLACE_DELTA, longitudeDelta: PLACE_DELTA } : WORLD_REGION
        }
        onPress={(event) => {
          const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
          onChange({ latitude: round(lat), longitude: round(lng) });
        }}>
        {pinned && (
          <Marker
            draggable
            coordinate={{ latitude, longitude }}
            onDragEnd={(event) => {
              const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
              onChange({ latitude: round(lat), longitude: round(lng) });
            }}
          />
        )}
      </OsmMap>
      <View style={styles.row}>
        <Button variant="outline" size="sm" testID="use-my-location" disabled={locating} onPress={() => void locateMe()}>
          {locating ? <ActivityIndicator size="small" color={theme.text} /> : <Crosshair size={16} color={theme.text} />}
          <ThemedText style={styles.buttonText}>{locating ? 'Finding you…' : 'Use my location'}</ThemedText>
        </Button>
      </View>
      <ThemedText themeColor="textSecondary" testID="location-picker-status" style={styles.sm}>
        {pinned
          ? `Pin at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Tap the map or drag the pin to move it.`
          : 'Tap the map where your kennel hashes.'}
      </ThemedText>
      {denied ? (
        <ThemedText themeColor="textSecondary" accessibilityRole="alert" style={styles.sm}>{denied}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  // h-64 w-full overflow-hidden rounded-lg border
  map: { height: 256, width: '100%', borderRadius: 8, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
