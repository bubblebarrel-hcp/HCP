import { Footprints, Award, Globe2, MapPin, Ruler, Users, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import type { HashPassport } from '@/lib/types';

// The passport itself, shown the same way to its owner and to anyone holding a share
// link (web components/passport/PassportView.tsx): the header with five stat tiles,
// Stamps, Milestones and "Where you have hashed". Memories and the share token are
// only ever populated for the owner.

function formatKm(metres: number) {
  if (!metres) return '0 km';
  return `${(metres / 1000).toFixed(metres >= 10_000 ? 0 : 1)} km`;
}

function placeLabel(place: { country: string; stateProvince: string | null; city: string | null }) {
  return [place.city, place.stateProvince, place.country].filter(Boolean).join(', ');
}

export function PassportView({ passport }: { passport: HashPassport }) {
  const theme = useTheme();
  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Runs attended', value: String(passport.runsAttended), icon: Footprints },
    { label: 'Trails laid', value: String(passport.trailsLaid), icon: Award },
    { label: 'Countries hashed', value: String(passport.countriesHashed), icon: Globe2 },
    { label: 'Kennels', value: String(passport.kennelsJoined), icon: Users },
    { label: 'Distance', value: formatKm(passport.distanceMeters), icon: Ruler },
  ];

  const byCountry = passport.places.reduce<Record<string, typeof passport.places>>((acc, place) => {
    (acc[place.country] ??= []).push(place);
    return acc;
  }, {});

  return (
    <>
      <Card style={styles.header} >
        <View testID="passport-header" style={styles.headerRow}>
          <Avatar name={passport.hasher.displayName} size={56} />
          <View style={styles.headerText}>
            <ThemedText style={[styles.eyebrow, { color: theme.primaryStrong }]}>HASH PASSPORT</ThemedText>
            <ThemedText accessibilityRole="header" testID="passport-name" style={styles.h1}>{passport.hasher.displayName}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sm}>Hashing since {formatDate(passport.hasher.hashingSince)}</ThemedText>
          </View>
        </View>
        <View testID="passport-stats" style={styles.stats}>
          {stats.map(({ label, value, icon: Icon }) => (
            <View key={label} style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
              <Icon size={20} color={theme.textSecondary} />
              <ThemedText style={styles.statValue}>{value}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.xs}>{label}</ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View testID="passport-stamps">
          <CardHeader style={styles.tight}>
            <CardTitle>Stamps</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.stamps.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Your first stamp arrives when you check in to a run.</ThemedText>
            ) : (
              <View style={styles.stamps}>
                {passport.stamps.map((stamp) => (
                  <View key={stamp.id} style={[styles.stamp, { borderColor: theme.accent + '66', backgroundColor: theme.accent + '1a' }]}>
                    <ThemedText style={[styles.stampLabel, { color: theme.accentStrong }]}>{stamp.label}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>{formatDate(stamp.awardedAt)}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-milestones">
          <CardHeader style={styles.tight}>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.milestones.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                The first milestone is 10 runs. {passport.runsAttended} so far.
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {passport.milestones.map((milestone) => (
                  <View key={milestone.id} style={styles.between}>
                    <ThemedText style={[styles.sm, styles.semibold]}>{milestone.threshold} runs</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>{formatDate(milestone.reachedAt)}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-places">
          <CardHeader style={styles.tight}>
            <CardTitle>Where you have hashed</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.places.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nowhere yet. That changes on your first run.</ThemedText>
            ) : (
              <View style={styles.countries}>
                {Object.entries(byCountry).map(([country, places]) => (
                  <View key={country}>
                    <View style={styles.countryRow}>
                      <Globe2 size={16} color={theme.primaryStrong} />
                      <ThemedText style={styles.semibold16}>{country}</ThemedText>
                      <Badge>{String(places.length)}</Badge>
                    </View>
                    <View style={styles.places}>
                      {places.map((place) => (
                        <View key={place.id} style={styles.placeRow}>
                          <MapPin size={14} color={theme.textSecondary} />
                          <ThemedText themeColor="textSecondary" style={[styles.sm, styles.flex]}>
                            {placeLabel(place)} · first visit {formatDate(place.firstVisitedAt)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: 20 },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.8 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  semibold: { fontWeight: '600' },
  semibold16: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  stats: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  statValue: { marginTop: 4, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  tight: { paddingBottom: 12 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stampLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  list: { gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  countries: { gap: 12 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  places: { marginTop: 4, gap: 4, paddingLeft: 24 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

// Silences "unused" for the View import when a variant has no wrapper.
void View;
