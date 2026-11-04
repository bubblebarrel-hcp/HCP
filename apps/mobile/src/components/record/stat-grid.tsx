import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// The figures of a run (D79), the same tiles live and afterwards: a big first tile
// (the clock, or the distance), then the rest in a grid.
export interface Stat {
  label: string;
  value: string;
  unit?: string;
  testID?: string;
}

export function StatGrid({ hero, stats }: { hero: Stat; stats: Stat[] }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText themeColor="textSecondary" style={styles.label}>{hero.label}</ThemedText>
        <ThemedText testID={hero.testID} style={styles.heroValue} accessibilityLabel={`${hero.label} ${hero.value}${hero.unit ? ` ${hero.unit}` : ''}`}>
          {hero.value}
          {hero.unit ? <ThemedText themeColor="textSecondary" style={styles.heroUnit}> {hero.unit}</ThemedText> : null}
        </ThemedText>
      </View>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={[styles.tile, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.label}>{s.label}</ThemedText>
            <ThemedText testID={s.testID} style={styles.value}>
              {s.value}
              {s.unit ? <ThemedText themeColor="textSecondary" style={styles.unit}> {s.unit}</ThemedText> : null}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 16 },
  hero: { borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  heroValue: { fontSize: 56, lineHeight: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: 12, padding: 12 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
