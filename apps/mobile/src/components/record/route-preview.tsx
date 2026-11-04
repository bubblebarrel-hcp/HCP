import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// The shape of a route as a small drawing, for a list card (D79): no map tiles and
// no network, just the line scaled to fit. Longitude is squeezed by cos(latitude) so
// a route is not drawn wider than it is.
export function RoutePreview({ points, size = 72 }: { points: [number, number][]; size?: number }) {
  const theme = useTheme();

  const drawing = useMemo(() => {
    if (points.length < 2) return null;
    const midLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xy = points.map(([lat, lng]) => [lng * k, -lat] as const);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
    const pad = 6;
    const scale = (size - pad * 2) / span;
    const placed = xy.map(([x, y]) => [pad + (x - minX) * scale, pad + (y - minY) * scale] as const);
    return { line: placed.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), start: placed[0] };
  }, [points, size]);

  return (
    <View
      accessibilityLabel="Route shape"
      style={{ width: size, height: size, borderRadius: 8, backgroundColor: theme.backgroundElement, overflow: 'hidden' }}>
      {drawing && (
        <Svg width={size} height={size}>
          <Polyline points={drawing.line} fill="none" stroke="#f4511e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={drawing.start[0]} cy={drawing.start[1]} r={4} fill={theme.trail} />
        </Svg>
      )}
    </View>
  );
}
