import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Modal, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { fetchVersionPolicy, installedVersion, updateState, type VersionPolicy } from '@/lib/app-version';

// Asks the API at launch and whenever the app comes back to the front. Too old
// (below `min`) and nothing else can be used until the hasher updates; merely
// behind (below `latest`) and it asks once per version, then lets them carry on.
// A failed check lets the app run: being offline must never lock anyone out.
export function UpdateGate() {
  const theme = useTheme();
  const [policy, setPolicy] = useState<VersionPolicy | null>(null);
  // Kept in memory: "Not now" lasts until the app is next opened.
  const [dismissed, setDismissed] = useState<string | null>(null);

  const check = useCallback(() => {
    fetchVersionPolicy().then(setPolicy).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [check]);

  if (!policy) return null;
  const state = updateState(policy);
  if (state === 'ok' || (state === 'available' && dismissed === policy.latest)) return null;
  const required = state === 'required';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !required && setDismissed(policy.latest)}>
      <View style={styles.backdrop} testID="update-gate">
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {required ? 'Please update Shiggy Trails' : 'A new version is out'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {required
              ? `This version (${installedVersion}) is too old to keep working. Update to ${policy.latest} to carry on.`
              : `Version ${policy.latest} is ready. You have ${installedVersion}.`}
          </ThemedText>
          <View style={styles.footer}>
            {!required && (
              <Button variant="outline" onPress={() => setDismissed(policy.latest)} testID="update-later">
                Not now
              </Button>
            )}
            {policy.storeUrl ? (
              <Button onPress={() => void Linking.openURL(policy.storeUrl!)} testID="update-now">
                Update
              </Button>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 448, borderWidth: 1, borderRadius: 12, padding: 24, gap: 6 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  footer: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
