import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';

// Initials only: there is no media storage yet, so no uploaded avatars or logos.
export function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string | null }) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? theme.primary },
      ]}>
      <Text style={[styles.text, { fontSize: size * 0.36, color: color ? '#ffffff' : theme.onPrimary }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700' },
});
