import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PassportView } from '@/components/passport/passport-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { HashPassport } from '@/lib/types';

// FR-PASSPORT-007: a read-only passport for anyone holding the link, as the web has
// it (app/passport/shared/[token]/page.tsx). No account needed, no memories, no way
// back to the hasher's private data.
export default function SharedPassportScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [passport, setPassport] = useState<HashPassport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ passport: HashPassport }>(`/passports/shared/${token}`)
      .then((data) => alive && setPassport(data.passport))
      .catch((err) => alive && setError(errorMessage(err, 'This passport link is not valid')));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          {error ? (
            <Card style={styles.error}>
              <ThemedText testID="shared-passport-error" style={styles.semibold}>{error}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sm}>The hasher may have created a new link.</ThemedText>
              <Button variant="outline" style={styles.back} onPress={() => router.replace('/')}>Back to Shiggy Trails</Button>
            </Card>
          ) : !passport ? (
            <Skeleton height={384} />
          ) : (
            <>
              <PassportView passport={passport} />
              <ThemedText themeColor="textSecondary" style={[styles.sm, styles.footer]}>
                Shared Hash Passport, read only.{' '}
                <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]} onPress={() => router.push('/auth/register')}>
                  Start your own
                </ThemedText>
                .
              </ThemedText>
            </>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  error: { padding: 32, alignItems: 'center', gap: 4 },
  semibold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  back: { marginTop: 16 },
  footer: { paddingHorizontal: 16 },
});
