import { Image, StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { Avatar } from '@/components/feed/avatar';
import { useTheme } from '@/hooks/use-theme';
import { brandColor } from '@/lib/format';

// The top of a hasher's or a kennel's page, as the web draws it on a phone
// (components/profile/ProfileBranding.tsx, kennels/KennelBranding.tsx): a 160pt
// banner, the 128pt picture overlapping its bottom edge with a 4pt ring in the
// card colour, and the page's own content centred beneath.
export function Branding({
  name,
  color,
  avatarUrl,
  avatarPosition,
  bannerUrl,
  bannerHeight = 160,
  children,
}: {
  name: string;
  color?: string | null;
  avatarUrl?: string | null;
  avatarPosition?: string | null;
  bannerUrl?: string | null;
  // Pages differ in how much banner they want: 160 by default, 128 on a hasher's page.
  bannerHeight?: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  // Covers are imagery; with none, a wash from the kennel's colour (HCP Orange
  // by default) to near-black, as the web's coverBackground does.
  const base = brandColor(color) ?? '#f4511e';
  return (
    <View>
      <View style={[styles.banner, { height: bannerHeight }]}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={base} />
                <Stop offset="1" stopColor="#6e240e" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#cover)" />
          </Svg>
        )}
      </View>
      <View style={styles.identity}>
        <View style={[styles.ring, { backgroundColor: theme.card }]}>
          <Avatar name={name} size={128} color={brandColor(color)} src={avatarUrl} position={avatarPosition} />
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 160, overflow: 'hidden' },
  // flex flex-col items-center gap-3 px-4 pb-4; the picture sits -mt-16.
  identity: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  ring: { marginTop: -68, padding: 4, borderRadius: 68 },
});
