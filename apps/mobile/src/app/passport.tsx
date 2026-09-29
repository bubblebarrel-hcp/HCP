import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { HashPassport } from '@/lib/types';

function Stat({ label, value }: { label: string; value: string | number }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.card }]}>
      <ThemedText type="title" style={styles.statValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

export default function PassportScreen() {
  const theme = useTheme();
  const [passport, setPassport] = useState<HashPassport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ passport: HashPassport }>('/me/passport');
      setPassport(data.passport);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your passport'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!passport) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  const km = (passport.distanceMeters / 1000).toFixed(1);

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.profile}>
            <Avatar name={passport.hasher.displayName} size={56} />
            <View style={styles.profileText}>
              <ThemedText type="subtitle">{passport.hasher.displayName}</ThemedText>
              <ThemedText themeColor="textSecondary">Hashing since {formatDate(passport.hasher.hashingSince)}</ThemedText>
            </View>
          </View>

          <View style={styles.grid}>
            <Stat label="Runs" value={passport.runsAttended} />
            <Stat label="Trails laid" value={passport.trailsLaid} />
            <Stat label="Beer checks" value={passport.beerChecks} />
            <Stat label="Reports" value={passport.reportsWritten} />
            <Stat label="Countries" value={passport.countriesHashed} />
            <Stat label="Kennels" value={passport.kennelsJoined} />
            <Stat label="Distance" value={`${km} km`} />
          </View>

          {passport.stamps.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">Stamps</ThemedText>
              <View style={styles.chipRow}>
                {passport.stamps.map((s) => (
                  <View key={s.id} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{s.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {passport.milestones.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">Milestones</ThemedText>
              <View style={styles.chipRow}>
                {passport.milestones.map((m) => (
                  <View key={m.id} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{m.threshold} runs</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {passport.places.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">Places hashed</ThemedText>
              {passport.places.map((p) => (
                <ThemedText key={p.id} themeColor="textSecondary">
                  {[p.city, p.stateProvince, p.country].filter(Boolean).join(', ')}
                </ThemedText>
              ))}
            </View>
          )}

          {passport.shareToken && (
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Share your passport"
              style={[styles.shareRow, { backgroundColor: theme.card }]}
              onTouchEnd={() =>
                Share.share({
                  message: `My Hash Passport: ${WEB_URL}/passport/shared/${passport.shareToken}`,
                  url: `${WEB_URL}/passport/shared/${passport.shareToken}`,
                })
              }>
              <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Share your passport</ThemedText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  profileText: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: { flexBasis: '30%', flexGrow: 1, borderRadius: 12, padding: Spacing.three, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22 },
  section: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  shareRow: { borderRadius: 12, padding: Spacing.three, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
});
