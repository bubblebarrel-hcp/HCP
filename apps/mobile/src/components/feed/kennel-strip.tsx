import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/api';
import { brandColor } from '@/lib/format';
import type { PublicKennel } from '@/lib/types';

// The stories row, as a strip of kennel tiles.
export function KennelStrip({ kennels }: { kennels: PublicKennel[] }) {
  const theme = useTheme();
  return (
    <FlatList
      horizontal
      data={kennels}
      keyExtractor={(k) => k.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      accessibilityLabel="Kennels on Shiggy Trails"
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${item.shortName}, ${item.city}`}
          onPress={() => Linking.openURL(`${WEB_URL}/kennels/${item.slug}`)}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: brandColor(item.primaryColor) ?? theme.primary, opacity: pressed ? 0.85 : 1 },
          ]}>
          <View style={[styles.badge, { backgroundColor: theme.card }]}>
            <Text style={[styles.badgeText, { color: theme.primaryStrong }]}>{item.shortName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.scrim}>
            <Text style={styles.name} numberOfLines={2}>{item.shortName}</Text>
            <Text style={styles.city} numberOfLines={1}>{item.city}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  tile: { width: 104, height: 168, borderRadius: 12, overflow: 'hidden', justifyContent: 'space-between' },
  badge: {
    margin: Spacing.two,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '800', fontSize: 14 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.two },
  name: { color: '#ffffff', fontWeight: '700', fontSize: 14, lineHeight: 18 },
  city: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
});
