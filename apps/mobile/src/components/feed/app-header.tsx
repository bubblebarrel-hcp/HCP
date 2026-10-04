import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// Orange is a fill and carries Hash Black text in both schemes.
const HASH_BLACK = '#171717';

// Facebook-style app bar: the Shiggy Trails mark and wordmark on the left, round action buttons on the right.
export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // On focus rather than mount, so the badge is right again after coming back
  // from the notifications screen.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setUnread(0);
        return;
      }
      api<{ unread: number }>('/me/notifications/unread-count')
        .then((data) => setUnread(data.unread))
        .catch(() => {});
    }, [user]),
  );

  return (
    <View style={[styles.bar, { backgroundColor: theme.card }]}>
      <View style={styles.brand}>
        <HashLogo size={40} color={theme.text} />
        <ThemedText style={[styles.wordmark, { color: theme.primary }]} accessibilityRole="header">
          hcp
        </ThemedText>
      </View>
      <View style={styles.actions}>
        {user && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            testID="notification-bell"
            onPress={() => router.push('/notifications')}
            hitSlop={4}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icon name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} size={20} />
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]} testID="notification-count">
                <ThemedText style={[styles.badgeText, { color: HASH_BLACK }]}>
                  {unread > 9 ? '9+' : unread}
                </ThemedText>
              </View>
            )}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search kennels"
          onPress={onSearch}
          hitSlop={4}
          style={({ pressed }) => [
            styles.round,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wordmark: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -1 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
