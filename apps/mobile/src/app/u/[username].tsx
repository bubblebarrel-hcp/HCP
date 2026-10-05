import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { api } from '@/lib/api';

// Where an @mention goes (D59), as the web does it (app/u/[username]/page.tsx): a
// mention is typed as a username and a hasher's page is addressed by id, so this
// looks the one up and hands over to the other. Nobody holding the name is a
// plain card rather than a broken link, because a mention is words somebody wrote
// and it may name nobody at all.
const USERNAME = /^[a-z0-9][a-z0-9_.]{1,28}[a-z0-9]$/;

export default function UsernameScreen() {
  const router = useRouter();
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const username = String(raw).toLowerCase();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!USERNAME.test(username)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMissing(true);
      return;
    }
    let alive = true;
    api<{ id: string }>(`/usernames/${encodeURIComponent(username)}`)
      .then((found) => alive && router.replace(`/hashers/${found.id}`))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [username, router]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          {missing ? (
            <Card style={styles.card}>
              <View testID="username-missing" style={styles.center}>
                <ThemedText accessibilityRole="header" style={styles.h1}>No hasher goes by @{username}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sm}>
                  They may have changed their username, or it may have been typed wrong.
                </ThemedText>
                <Button style={styles.button} onPress={() => router.push('/search')}>Search for a hasher</Button>
              </View>
            </Card>
          ) : (
            <Skeleton height={160} />
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16 },
  card: { padding: 32 },
  center: { alignItems: 'center' },
  h1: { fontSize: 20, lineHeight: 28, fontWeight: '600', textAlign: 'center' },
  sm: { marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: '400', textAlign: 'center' },
  button: { marginTop: 16 },
});
