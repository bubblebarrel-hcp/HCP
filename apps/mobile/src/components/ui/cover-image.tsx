import { useEffect, useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

// A picture cropped to a box and slid by a saved "x% y%" position, which is what the
// web does with CSS background-position for banners (lib/banner.ts). React Native's
// Image has no such property, so the crop is worked out from the picture's own size.
export type Point = { x: number; y: number };

export const CENTRED: Point = { x: 50, y: 50 };

export function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

export function parsePosition(value?: string | null): Point {
  const match = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec(value ?? '');
  if (!match) return CENTRED;
  return { x: clamp(Number(match[1])), y: clamp(Number(match[2])) };
}

export function formatPosition(point: Point) {
  return `${Math.round(point.x)}% ${Math.round(point.y)}%`;
}

export function CoverImage({
  uri,
  width,
  height,
  position,
  style,
}: {
  uri: string;
  width: number;
  height: number;
  position: Point;
  style?: StyleProp<ViewStyle>;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => alive && setNatural({ w, h }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  let box: { width: number; height: number; left: number; top: number } | null = null;
  if (natural && natural.w > 0 && natural.h > 0 && width > 0 && height > 0) {
    const scale = Math.max(width / natural.w, height / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    box = { width: w, height: h, left: -(w - width) * (position.x / 100), top: -(h - height) * (position.y / 100) };
  }

  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]}>
      <Image
        source={{ uri }}
        style={box ? { position: 'absolute', ...box } : { width, height }}
        resizeMode={box ? 'stretch' : 'cover'}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
