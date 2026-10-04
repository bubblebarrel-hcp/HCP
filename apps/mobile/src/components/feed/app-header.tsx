import { Pressable, StyleSheet, View } from 'react-native';

import { HashLogo } from '@/components/brand/hash-logo';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Facebook-style app bar: the Shiggy Trails mark and wordmark on the left, round action buttons on the right.
export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.card }]}>
      <View style={styles.brand}>
        <HashLogo size={40} color={theme.text} />
        <ThemedText style={[styles.wordmark, { color: theme.primary }]} accessibilityRole="header">
          hcp
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search kennels"
        onPress={onSearch}
        hitSlop={4}
        style={({ pressed }) => [
          styles.round,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wordmark: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -1 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
