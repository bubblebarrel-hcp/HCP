import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor } from '@/lib/format';
import { approveFollowRequest, declineFollowRequest, listFollowRequests } from '@/lib/social';
import type { FollowRequest } from '@/lib/types';

// Who is waiting on this hasher's yes (D57), as the web has it
// (app/account/follow-requests/page.tsx). Only a locked profile has a queue: on a
// public one a follow is immediate, and on a closed one nobody can ask.
export default function FollowRequestsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<FollowRequest[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listFollowRequests()
      .then((page) => alive && setRows(page.items))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [user]);

  const decide = useCallback(async (request: FollowRequest, approve: boolean) => {
    setWorking(request.id);
    try {
      if (approve) await approveFollowRequest(request.id);
      else await declineFollowRequest(request.id);
      setRows((current) => (current ?? []).filter((r) => r.id !== request.id));
    } catch (err) {
      Alert.alert('Could not update that request', errorMessage(err, 'Could not update that request'));
    } finally {
      setWorking(null);
    }
  }, []);

  if (loading || !user) {
    return (
      <Subpage>
        <Skeleton height={256} />
      </Subpage>
    );
  }

  return (
    <Subpage back="Back to privacy" onBack={() => router.replace('/privacy')}>
      <Card bleed={false}>
        <View testID="follow-requests">
          <CardHeader>
            <CardTitle style={styles.title}>Follow requests</CardTitle>
            <CardDescription>
              People who asked to follow you. Approve a request and they see your photos, posts and reels. Decline it and they
              are not told; they can ask again.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.flush}>
            {rows === null ? (
              <ThemedText themeColor="textSecondary" style={styles.message}>Loading…</ThemedText>
            ) : rows.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.message} testID="follow-requests-empty">
                Nobody is waiting. Requests only come in while your profile is locked.
              </ThemedText>
            ) : (
              rows.map((request, index) => (
                <View key={request.id} testID="follow-request" style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <Avatar
                    name={request.name}
                    size={40}
                    src={request.avatarUrl}
                    position={request.avatarPosition}
                    color={brandColor(request.homeKennel?.primaryColor)}
                  />
                  <View style={styles.main}>
                    <Pressable accessibilityRole="link" onPress={() => router.push(`/hashers/${request.id}`)}>
                      <ThemedText style={styles.name}>{request.name}</ThemedText>
                    </Pressable>
                    {request.homeKennel ? (
                      <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.sm}>{request.homeKennel.shortName}</ThemedText>
                    ) : null}
                  </View>
                  <Button size="sm" disabled={working === request.id} testID="request-approve" onPress={() => void decide(request, true)}>
                    <Check size={16} color={theme.onPrimary} />
                    <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>Approve</ThemedText>
                  </Button>
                  <Button size="sm" variant="outline" disabled={working === request.id} testID="request-decline" onPress={() => void decide(request, false)}>
                    <X size={16} color={theme.text} />
                    <ThemedText style={styles.buttonLabel}>Decline</ThemedText>
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
  flush: { padding: 0 },
  message: { padding: 24, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  main: { flex: 1, minWidth: 120 },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
