import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Footprints, Home, Menu, Plus, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoPostComposer } from '@/components/feed/photo-post-composer';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

// The phone tab bar from the web app (components/layout/BottomNav.tsx), drawn once
// by the shared frame so it is on every screen, as web's fixed bar is on every
// page: Home, Kennels, Runs, then Menu (or Log in when signed out). 56pt tall, a
// 24pt icon over a 12pt medium label, primary-strong when active and muted
// otherwise, hairline above. No messaging tab: Shiggy Trails has no direct
// messaging (D8).

interface Item {
  label: string;
  icon: LucideIcon;
  href: '/' | '/kennels' | '/runs' | '/account';
  match: (path: string) => boolean;
}

// The account sub-pages (privacy, blocked...) belong to Menu, as /account/* does on web.
const ACCOUNT_PAGES = ['/account', '/privacy', '/blocked', '/follow-requests', '/photo-tags', '/reports', '/saved', '/auth'];

export function BottomNav() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [posting, setPosting] = useState(false);

  const items: Item[] = [
    { label: 'Home', icon: Home, href: '/', match: (p) => p === '/' || p === '/index' },
    { label: 'Kennels', icon: Users, href: '/kennels', match: (p) => p.startsWith('/kennels') },
    { label: 'Runs', icon: Footprints, href: '/runs', match: (p) => p.startsWith('/runs') || p.startsWith('/run/') },
    {
      label: user ? 'Me' : 'Log in',
      icon: user ? Menu : UserRound,
      href: '/account',
      match: (p) => ACCOUNT_PAGES.some((page) => p.startsWith(page)),
    },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom }]}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        const color = active ? theme.primaryStrong : theme.textSecondary;
        return (
          <Fragment key={item.label}>
            {/* The + sits in the middle of the bar: post photos (signed in), or log in first. */}
            {index === 2 && (
              <View style={styles.slot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Post photos"
                testID="nav-post"
                onPress={() => (user ? setPosting(true) : router.navigate('/account'))}
                style={({ pressed }) => [styles.plusWrap, pressed && { opacity: 0.8 }]}>
                <View style={[styles.plus, { backgroundColor: theme.primary }]}>
                  <Plus size={26} color={theme.onPrimary} strokeWidth={2.5} />
                </View>
              </Pressable>
              </View>
            )}
          <View style={styles.slot}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(item.href)}
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: theme.backgroundElement }]}>
            <Icon size={24} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </Pressable>
          </View>
          </Fragment>
        );
      })}
      <PhotoPostComposer visible={posting} onClose={() => setPosting(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  slot: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  plusWrap: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 44, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  button: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, lineHeight: 16, fontFamily: 'Geist_500Medium' },
});
