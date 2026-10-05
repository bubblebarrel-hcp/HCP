import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { UserMinus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { FollowButton } from '@/components/social/follow-button';
import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { brandColor } from '@/lib/format';
import { listHasherFollowers, listHasherFollowing, removeFollower } from '@/lib/social';
import type { FollowedKennelRow, FollowerRow, FollowingEntry } from '@/lib/types';

// Who follows this hasher, and who they follow (D50), as the web lists them
// (components/social/FollowLists.tsx, `flat`): a bordered, rounded box of rows
// with the picture, the name and what they run with, and a follow button or, on
// your own followers, Remove (D57). Handles and pictures only (D11).

function HasherRow({ hasher, onRemove }: { hasher: FollowerRow; onRemove?: (hasher: FollowerRow) => Promise<void> }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Avatar
        name={hasher.name}
        size={40}
        src={hasher.avatarUrl}
        position={hasher.avatarPosition}
        color={brandColor(hasher.homeKennel?.primaryColor)}
      />
      <View style={styles.main}>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/hashers/${hasher.id}`)}>
          <ThemedText style={styles.name}>{hasher.name}</ThemedText>
        </Pressable>
        {hasher.homeKennel ? (
          <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.sub}>{hasher.homeKennel.shortName}</ThemedText>
        ) : null}
      </View>
      {onRemove ? (
        <ActionDialog
          title={`Remove ${hasher.name}?`}
          description="They stop following you and, if your profile is locked, lose access to your photos, posts and reels. They are not told, and they can ask again."
          confirmLabel="Remove follower"
          destructive
          onConfirm={async () => {
            try {
              await onRemove(hasher);
            } catch (err) {
              Alert.alert('Could not remove that follower', errorMessage(err));
              throw err;
            }
          }}
          trigger={(open) => (
            <Button variant="outline" size="sm" testID="remove-follower" onPress={open}>
              <UserMinus size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Remove</ThemedText>
            </Button>
          )}
        />
      ) : (
        !hasher.isMe && <FollowButton kind="hasher" target={hasher.id} showCount={false} size="sm" />
      )}
    </View>
  );
}

function KennelRow({ kennel }: { kennel: FollowedKennelRow }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Avatar name={kennel.shortName} size={40} src={kennel.logoUrl} color={brandColor(kennel.primaryColor)} />
      <View style={styles.main}>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${kennel.slug}`)}>
          <ThemedText style={styles.name}>{kennel.shortName}</ThemedText>
        </Pressable>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.sub}>
          {kennel.city}, {kennel.country}
        </ThemedText>
      </View>
      <FollowButton kind="kennel" target={kennel.slug} showCount={false} size="sm" />
    </View>
  );
}

export function FollowLists({
  hasherId,
  only,
  canRemove = false,
  onFollowerRemoved,
}: {
  hasherId: string;
  only: 'followers' | 'following';
  canRemove?: boolean;
  onFollowerRemoved?: () => void;
}) {
  const theme = useTheme();
  const [followerRows, setFollowerRows] = useState<FollowerRow[] | null>(null);
  const [followingRows, setFollowingRows] = useState<FollowingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (which: 'followers' | 'following') => {
      setLoading(true);
      try {
        if (which === 'followers') setFollowerRows((await listHasherFollowers(hasherId)).items);
        else setFollowingRows((await listHasherFollowing(hasherId)).items);
      } catch {
        // A list that will not load shows its empty state rather than an alarm.
        if (which === 'followers') setFollowerRows([]);
        else setFollowingRows([]);
      } finally {
        setLoading(false);
      }
    },
    [hasherId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (only === 'followers' && followerRows === null) void load('followers');
    if (only === 'following' && followingRows === null) void load('following');
  }, [only, followerRows, followingRows, load]);

  const rows = only === 'followers' ? followerRows : followingRows;

  return (
    <View style={[styles.box, { borderColor: theme.border }]} testID="follow-lists">
      {loading && rows === null ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>Loading…</ThemedText>
      ) : (rows?.length ?? 0) === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          {only === 'followers' ? 'Nobody yet.' : 'Not following anybody yet.'}
        </ThemedText>
      ) : only === 'followers' ? (
        followerRows?.map((hasher, index) => (
          <View key={hasher.id} style={index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }}>
            <HasherRow
              hasher={hasher}
              onRemove={
                canRemove
                  ? async (h) => {
                      await removeFollower(h.id);
                      setFollowerRows((current) => (current ?? []).filter((row) => row.id !== h.id));
                      onFollowerRemoved?.();
                    }
                  : undefined
              }
            />
          </View>
        ))
      ) : (
        followingRows?.map((entry, index) => (
          <View key={entry.kind === 'HASHER' ? `h-${entry.hasher.id}` : `k-${entry.kennel.id}`} style={index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }}>
            {entry.kind === 'HASHER' ? <HasherRow hasher={entry.hasher} /> : <KennelRow kennel={entry.kennel} />}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow-hidden rounded-lg border
  box: { overflow: 'hidden', borderRadius: 8, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  message: { padding: 16, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
