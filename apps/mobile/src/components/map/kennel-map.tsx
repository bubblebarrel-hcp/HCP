import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { OsmMap, WORLD_REGION } from '@/components/map/osm-map';
import { useTheme } from '@/hooks/use-theme';

// Where the hash is in the world, as the web draws it (components/map/KennelMap.tsx):
// one teardrop pin per kennel with its initial on a pale disc, and selecting one opens
// the kennel. D24: orange is a fill, and the letter sits on the pale disc.
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

export function KennelMap({ kennels, height = 288 }: { kennels: KennelPin[]; height?: number }) {
  const theme = useTheme();
  const router = useRouter();
  // Custom pin views are snapshotted by the native map; keep tracking on for a moment so
  // the first paint is not blank, then stop (it is expensive on Android).
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracking(false), 800);
    return () => clearTimeout(t);
  }, [kennels]);

  // Frame the pins, but never so tightly that it stops reading as a world map.
  const region = useMemo(() => {
    if (kennels.length === 0) return WORLD_REGION;
    const lats = kennels.map((k) => k.latitude);
    const lngs = kennels.map((k) => k.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.min(150, Math.max(30, (maxLat - minLat) * 1.6)),
      longitudeDelta: Math.min(300, Math.max(30, (maxLng - minLng) * 1.6)),
    };
  }, [kennels]);

  return (
    <OsmMap style={{ height, width: '100%' }} initialRegion={region} testID="kennel-map" accessibilityLabel="Map of kennels around the world">
      {kennels.map((kennel) => {
        const initial = kennel.shortName.slice(0, 1).toUpperCase().replace(/[^A-Z0-9]/, '');
        return (
          <Marker
            key={kennel.id}
            coordinate={{ latitude: kennel.latitude, longitude: kennel.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracking}
            title={kennel.name}
            description={`${kennel.city}, ${kennel.country}`}
            accessibilityLabel={`${kennel.name}, ${kennel.city}, ${kennel.country}`}
            onCalloutPress={() => router.push(`/kennels/${kennel.slug}`)}
            onPress={() => router.push(`/kennels/${kennel.slug}`)}>
            <Svg width={26} height={34} viewBox="0 0 26 34" style={styles.pin}>
              <Path
                d="M13 1C6.4 1 1 6.3 1 12.9c0 8.6 10.5 19.3 11 19.8.3.3.8.3 1.1 0 .5-.5 11-11.2 11-19.8C24 6.3 19.6 1 13 1Z"
                fill={theme.primary}
                stroke={theme.card}
                strokeWidth={1.5}
              />
              <Circle cx={13} cy={12.8} r={6.6} fill={theme.card} />
              <SvgText x={13} y={16} textAnchor="middle" fontSize={9} fontWeight="700" fill={theme.text}>
                {initial}
              </SvgText>
            </Svg>
          </Marker>
        );
      })}
    </OsmMap>
  );
}

const styles = StyleSheet.create({
  pin: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
});
