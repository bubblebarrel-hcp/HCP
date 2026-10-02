import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor } from '@/lib/format';
import { approveFollowRequest, declineFollowRequest, listFollowRequests } from '@/lib/social';
import type { FollowRequest } from '@/lib/types';

// Who is waiting on this hasher's yes (D57). Only a locked profile has a queue:
// on a public one a follow is immediate, and on a closed one nobody can ask.
// A decline is quiet: the person is not told, and can ask again.

export default function FollowRequestsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<FollowRequest[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listFollowRequests();
      setRows(page.items);
    } catch (err) {
      setRows([]);
      setNote(errorMessage(err, 'Could not load your follow requests'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) load();
  }, [user, load]);

  async function decide(request: FollowRequest, approve: boolean) {
    setWorking(request.id);
    setNote(null);
    try {
      if (approve) await approveFollowRequest(request.id);
      else await declineFollowRequest(request.id);
      setRows((current) => (current ?? []).filter((r) => r.id !== request.id));
      setNote(approve ? `${request.name} now follows you.` : 'Request declined. They are not told.');
    } catch (err) {
      setNote(errorMessage(err, 'Could not update that request'));
    } finally {
      setWorking(null);
    }
  }

  if (!user) {
    return (
      <ThemedView type="canvas" style={styles.center}>
        <ThemedText themeColor="textSecondary">Log in to see your follow requests.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle" accessibilityRole="header">Follow requests</ThemedText>
        <ThemedText themeColor="textSecondary">
          People who asked to follow you. Approve a request and they see your photos, posts and reels. Decline it and
          they are not told; they can ask again.
        </ThemedText>
        {note && <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>}

        {rows === null ? (
          <ActivityIndicator color={theme.primary} />
        ) : rows.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Nobody is waiting. Requests only come in while your profile is locked.
          </ThemedText>
        ) : (
          rows.map((request) => (
            <View key={request.id} style={[styles.row, { backgroundColor: theme.card }]}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${request.name}'s profile`}
                onPress={() => router.push(`/hashers/${request.id}`)}
                style={styles.who}>
                <Avatar
                  name={request.name}
                  size={44}
                  src={request.avatarUrl}
                  position={request.avatarPosition}
                  color={brandColor(request.homeKennel?.primaryColor)}
                />
                <View style={styles.text}>
                  <ThemedText type="smallBold" numberOfLines={1}>{request.name}</ThemedText>
                  {request.homeKennel && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {request.homeKennel.shortName}
                    </ThemedText>
                  )}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Approve ${request.name}`}
                disabled={working === request.id}
                onPress={() => decide(request, true)}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.primary, opacity: pressed || working === request.id ? 0.7 : 1 }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Approve</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decline ${request.name}`}
                disabled={working === request.id}
                onPress={() => decide(request, false)}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundElement, opacity: pressed || working === request.id ? 0.7 : 1 }]}>
                <ThemedText type="smallBold">Decline</ThemedText>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three, flexWrap: 'wrap' },
  who: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44 },
  text: { flex: 1, minWidth: 0 },
  action: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
});
