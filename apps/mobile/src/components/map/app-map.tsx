import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { type MapViewProps } from 'react-native-maps';

// Every map in the app is built on this, so the provider changes in one place. On
// Android it is Google Maps (the key is `android.config.googleMaps.apiKey` in app.json,
// restricted to this package and its signing keys); on iOS it is Apple Maps.
export const WORLD_REGION = { latitude: 15, longitude: 10, latitudeDelta: 120, longitudeDelta: 120 };

export const AppMap = forwardRef<MapView, MapViewProps>(function AppMap({ children, style, ...props }, ref) {
  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        mapType="standard"
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        {...props}>
        {children}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#e8e4da' },
});
