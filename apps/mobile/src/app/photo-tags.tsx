import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { PendingPhotoTag } from '@/lib/types';

// Photos hashers want to tag you in (D60), as the web has it
// (app/account/photo-tags/page.tsx). A tag is a request: it shows on the photo and
// on your profile only once you say yes, and a no is final.
export default function PhotoTagsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<PendingPhotoTag[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    api<{ items: PendingPhotoTag[] }>('/me/photo-tags/pending')
      .then((data) => alive && setItems(data.items))
      .catch((err) => Alert.alert('Could not load your tag requests', errorMessage(err, 'Could not load your tag requests')));
    return () => {
      alive = false;
    };
  }, [user]);

  async function answer(item: PendingPhotoTag, approve: boolean) {
    try {
      await api(`/photo-tags/${item.id}/${approve ? 'approve' : 'decline'}`, { method: 'POST' });
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? current);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    }
  }

  return (
    <Subpage back="Back to account" onBack={() => router.replace('/account')}>
      <Card bleed={false}>
        <View testID="photo-tag-requests">
          <CardHeader>
            <CardTitle style={styles.title}>Photo tags waiting for you</CardTitle>
            <CardDescription>Nothing shows until you say yes.</CardDescription>
          </CardHeader>
          <CardContent>
            {items === null ? (
              <View style={[styles.pulse, { backgroundColor: theme.backgroundElement }]} />
            ) : items.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm} testID="photo-tags-empty">
                No tag requests right now.
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {items.map((item) => (
                  <View key={item.id} testID="photo-tag-request" style={styles.item}>
                    <Image
                      source={{ uri: item.photo.thumbnailUrl ?? item.photo.url }}
                      accessibilityLabel={item.photo.caption ?? 'A photo you were tagged in'}
                      style={[styles.photo, { borderColor: theme.border }]}
                      resizeMode="cover"
                    />
                    <View style={styles.main}>
                      <ThemedText style={styles.sm}>
                        <ThemedText style={[styles.sm, styles.medium]} onPress={() => router.push(`/hashers/${item.by.id}`)}>
                          {item.by.name}
                        </ThemedText>{' '}
                        tagged you.
                      </ThemedText>
                      {item.photo.caption ? (
                        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.sm}>{item.photo.caption}</ThemedText>
                      ) : null}
                      <View style={styles.actions}>
                        <Button size="sm" testID="photo-tag-approve" onPress={() => void answer(item, true)}>Yes, that is me</Button>
                        <Button size="sm" variant="outline" testID="photo-tag-decline" onPress={() => void answer(item, false)}>No</Button>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
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
  medium: { fontWeight: '500' },
  list: { gap: 16 },
  item: { flexDirection: 'row', gap: 12 },
  photo: { width: 96, height: 96, borderRadius: 8, borderWidth: 1 },
  main: { flex: 1, minWidth: 0 },
  actions: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
