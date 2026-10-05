import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { BlockedHasher } from '@/lib/types';

// Hashers you have blocked or muted (D60), as the web has it
// (app/account/blocked/page.tsx). A block works both ways and ends any follow; a
// mute is quiet and one-way. Neither tells the other person, and this is where
// either is undone.
export default function BlockedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<BlockedHasher[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const load = useCallback(() => {
    api<{ items: BlockedHasher[] }>('/me/blocks')
      .then((data) => setItems(data.items))
      .catch((err) => Alert.alert('Could not load this list', errorMessage(err, 'Could not load this list')));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function undo(item: BlockedHasher) {
    try {
      await api(`/hashers/${item.id}/${item.kind === 'BLOCK' ? 'block' : 'mute'}`, { method: 'DELETE' });
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? current);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    }
  }

  return (
    <Subpage back="Back to privacy" onBack={() => router.replace('/privacy')}>
      <Card bleed={false}>
        <View testID="blocked-list">
          <CardHeader>
            <CardTitle style={styles.title}>Blocked and muted</CardTitle>
            <CardDescription>
              Blocked hashers cannot see your posts, reels or photos, follow you, or reach you; you cannot see theirs. Muted
              hashers just disappear from your feed and notifications, and are not told.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items === null ? (
              <View style={[styles.pulse, { backgroundColor: theme.backgroundElement }]} />
            ) : items.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm} testID="blocked-empty">
                You have not blocked or muted anybody.
              </ThemedText>
            ) : (
              items.map((item, index) => (
                <View
                  key={item.id}
                  testID="blocked-row"
                  style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }, index === 0 && { paddingTop: 0 }, index === items.length - 1 && { paddingBottom: 0 }]}>
                  <Avatar name={item.name} size={36} src={item.avatarUrl} />
                  <View style={styles.main}>
                    <Pressable accessibilityRole="link" onPress={() => router.push(`/hashers/${item.id}`)}>
                      <ThemedText style={styles.name}>{item.name}</ThemedText>
                    </Pressable>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      {item.kind === 'BLOCK' ? 'Blocked' : 'Muted'} {new Date(item.since).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <Button variant="outline" size="sm" onPress={() => void undo(item)}>
                    {item.kind === 'BLOCK' ? 'Unblock' : 'Unmute'}
                  </Button>
                </View>
              ))
            )}
          </CardContent>
        </View>
      </Card>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 32 },
  pulse: { height: 96, borderRadius: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
});
