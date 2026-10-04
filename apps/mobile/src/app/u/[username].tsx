import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// Where an @mention goes (D59): a mention is typed as a username and a hasher's
// page is addressed by id, so this looks the one up and hands over to the other.
// Nobody holding the name is a plain message rather than a broken link, because
// a mention is words somebody wrote and it may name nobody at all.
export default function UsernameScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ id: string }>(`/usernames/${encodeURIComponent(String(username).toLowerCase())}`)
      .then((found) => alive && router.replace(`/hashers/${found.id}`))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [username, router]);

  return (
    <ThemedView type="canvas" style={styles.center}>
      {missing ? (
        <>
          <ThemedText type="subtitle">No hasher goes by @{username}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.text}>
            They may have changed their username, or it may have been typed wrong.
          </ThemedText>
        </>
      ) : (
        <ActivityIndicator color={theme.primary} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  text: { textAlign: 'center' },
});
