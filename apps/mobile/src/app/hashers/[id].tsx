import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { followHasher, hasherProfile } from '@/lib/social';
import type { HasherProfile } from '@/lib/types';

// The public face of a hasher (D11/D50): handle, picture, words, kennels, and
// a follow button. Never biodata — that stays private (D5).

export default function HasherProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hasher, setHasher] = useState<HasherProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await hasherProfile(id);
      setHasher(data.hasher);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this hasher'));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleFollow() {
    if (!hasher) return;
    const next = !hasher.isFollowing;
    setBusy(true);
    setHasher({ ...hasher, isFollowing: next, followers: hasher.followers + (next ? 1 : -1) });
    try {
      await followHasher(hasher.id, next);
    } catch {
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!hasher) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Avatar name={hasher.name} size={72} />
          <ThemedText type="title">{hasher.name}</ThemedText>
          {!hasher.isNamed && <ThemedText themeColor="textSecondary">Not yet named by a kennel</ThemedText>}
          {hasher.bio ? <ThemedText style={styles.bio}>{hasher.bio}</ThemedText> : null}
          <ThemedText themeColor="textSecondary">Hashing since {formatDate(hasher.joinedAt)}</ThemedText>

          <View style={styles.statsRow}>
            <ThemedText type="smallBold">{hasher.followers} followers</ThemedText>
            <ThemedText type="smallBold">{hasher.following} following</ThemedText>
          </View>

          {!hasher.isMe && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: hasher.isFollowing }}
              disabled={busy}
              onPress={toggleFollow}
              style={({ pressed }) => [
                styles.followButton,
                {
                  backgroundColor: hasher.isFollowing ? theme.backgroundElement : theme.primary,
                  opacity: pressed || busy ? 0.8 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: hasher.isFollowing ? theme.text : theme.onPrimary }}>
                {hasher.isFollowing ? 'Following' : 'Follow'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {hasher.homeKennel && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Home kennel</ThemedText>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/kennels/${hasher.homeKennel!.slug}`)}
              style={({ pressed }) => [styles.kennelRow, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
              <Avatar name={hasher.homeKennel.shortName} color={brandColor(hasher.homeKennel.primaryColor)} size={32} />
              <ThemedText type="smallBold">{hasher.homeKennel.shortName}</ThemedText>
            </Pressable>
          </View>
        )}

        {hasher.kennels.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">Kennels</ThemedText>
            {hasher.kennels.map((k) => (
              <Pressable
                key={k.slug}
                accessibilityRole="link"
                onPress={() => router.push(`/kennels/${k.slug}`)}
                style={({ pressed }) => [styles.kennelRow, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}>
                <Avatar name={k.shortName} color={brandColor(k.primaryColor)} size={32} />
                <ThemedText type="smallBold">{k.name}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  header: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
  bio: { textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.two },
  followButton: { marginTop: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.five, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  section: { gap: Spacing.two },
  kennelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: 12, minHeight: 56 },
});
