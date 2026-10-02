import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';

// "50% 30%": the part of the picture the round crop shows, as the web saves it.
function parsePosition(value?: string | null) {
  const match = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec(value ?? '');
  if (!match) return null;
  return { x: Math.min(100, Number(match[1])), y: Math.min(100, Number(match[2])) };
}

// The picture's own size, which a crop position needs and React Native's Image
// has no object-position to do without. Only asked for when there is a position.
function useImageSize(src: string | null | undefined, wanted: boolean) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src || !wanted) return;
    let alive = true;
    Image.getSize(
      src,
      (w, h) => {
        if (alive) setSize({ w, h });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [src, wanted]);
  return size;
}

// Initials, or the picture the hasher or kennel chose (D37, D56) when there is
// one, cropped where the hasher put it (`position`, D56) rather than always centred.
export function Avatar({
  name,
  size = 40,
  color,
  src,
  position,
}: {
  name: string;
  size?: number;
  color?: string | null;
  src?: string | null;
  // A saved "x% y%" crop; absent or unreadable is centred.
  position?: string | null;
}) {
  const theme = useTheme();
  const point = parsePosition(position);
  const natural = useImageSize(src, Boolean(point));

  // Cover the circle, then slide the overflow by the saved percentage, which is
  // what CSS object-position does on the web.
  let cropped: { width: number; height: number; left: number; top: number } | null = null;
  if (point && natural && natural.w > 0 && natural.h > 0) {
    const scale = Math.max(size / natural.w, size / natural.h);
    const width = natural.w * scale;
    const height = natural.h * scale;
    cropped = { width, height, left: -(width - size) * (point.x / 100), top: -(height - size) * (point.y / 100) };
  }

  return (
    <View
      accessible={false}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? theme.primary },
      ]}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={cropped ? { position: 'absolute', ...cropped } : { width: size, height: size }}
          resizeMode={cropped ? 'stretch' : 'cover'}
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.36, color: color ? '#ffffff' : theme.onPrimary }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontWeight: '700' },
});
