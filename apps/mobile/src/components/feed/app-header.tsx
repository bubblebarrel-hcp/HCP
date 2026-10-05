import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Moon, Search, Sun } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';

import { HashLogo } from '@/components/brand/hash-logo';
import { Avatar } from '@/components/feed/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useThemePreference } from '@/context/theme-preference';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

// Orange is a fill and carries Hash Black text in both schemes.
const HASH_BLACK = '#171717';

// The web header's mascot (components/layout/Header.tsx): one of five, picked
// once per launch.
const COMPANIONS = [
  require('../../../assets/images/companions/alt-image1.png'),
  require('../../../assets/images/companions/alt-image2.png'),
  require('../../../assets/images/companions/alt-image3.png'),
  require('../../../assets/images/companions/alt-image4.png'),
  require('../../../assets/images/companions/alt-image5.png'),
];
const companion = COMPANIONS[Math.floor(Math.random() * COMPANIONS.length)];

// The phone top bar from the web app: the mark and the day's companion on the
// left; on the right search, a light/dark swap, notifications and the account
// avatar (or "Join Shiggy Trails" for a visitor). 56pt, hairline below.
export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { scheme, setPreference } = useThemePreference();
  const [unread, setUnread] = useState(0);

  // Asked again whenever the route changes, so the badge is right after coming
  // back from the notifications screen (the header lives above the navigator,
  // so there is no screen focus to hang this on).
  const pathname = usePathname();
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnread(0);
      return;
    }
    api<{ unread: number }>('/me/notifications/unread-count')
      .then((data) => setUnread(data.unread))
      .catch(() => {});
  }, [user, pathname]);

  const next = scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.brand}>
        <HashLogo size={44} color={theme.text} />
        <Image source={companion} style={styles.companion} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={onSearch}
          style={({ pressed }) => [styles.round, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
          <Search size={20} color={theme.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${next} theme`}
          testID="theme-toggle-button"
          onPress={() => setPreference(next)}
          style={({ pressed }) => [styles.round, { opacity: pressed ? 0.7 : 1 }]}>
          {scheme === 'dark' ? <Sun size={20} color={theme.text} /> : <Moon size={20} color={theme.text} />}
        </Pressable>
        {user && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            testID="notification-bell"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [styles.round, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} size={20} />
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]} testID="notification-count">
                <ThemedText style={[styles.badgeText, { color: HASH_BLACK }]}>{unread > 9 ? '9+' : unread}</ThemedText>
              </View>
            )}
          </Pressable>
        )}
        {loading ? (
          <View style={[styles.round, { backgroundColor: theme.backgroundElement }]} />
        ) : user ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account"
            testID="header-account"
            onPress={() => router.push('/account')}
            style={styles.round}>
            <Avatar name={user.displayName} size={40} src={user.avatarUrl} position={user.avatarPosition} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth/register')}
            style={({ pressed }) => [styles.join, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={{ color: HASH_BLACK }}>Join</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  companion: { width: 40, height: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  join: { minHeight: 40, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
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
