import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';

// Initials, or the picture the hasher or kennel chose (D37, D56) when there is one.
export function Avatar({
  name,
  size = 40,
  color,
  src,
}: {
  name: string;
  size?: number;
  color?: string | null;
  src?: string | null;
}) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? theme.primary },
      ]}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} resizeMode="cover" />
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
