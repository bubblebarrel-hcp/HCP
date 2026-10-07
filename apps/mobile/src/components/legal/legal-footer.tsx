import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { LEGAL_ENTITY } from '@/lib/legal';

// The same lines as the web footer. Privacy and Terms open the reader screens
// (src/app/legal/[doc].tsx), which need no account, so they are reachable from the
// log-in form as well as from a signed-in account.
export function LegalFooter() {
  const router = useRouter();
  const theme = useTheme();
  const open = (slug: 'privacy' | 'terms') => router.push(`/legal/${slug}` as never);

  return (
    <View style={styles.wrap} testID="legal-footer">
      <ThemedText themeColor="textSecondary" style={styles.text}>
        &copy; {new Date().getFullYear()} Shiggy Trails &middot; {LEGAL_ENTITY}. All rights reserved.
      </ThemedText>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" hitSlop={8} testID="footer-privacy" onPress={() => open('privacy')}>
          <ThemedText style={[styles.text, styles.link, { color: theme.primaryStrong }]}>Privacy</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="link" hitSlop={8} testID="footer-terms" onPress={() => open('terms')}>
          <ThemedText style={[styles.text, styles.link, { color: theme.primaryStrong }]}>Terms of Service</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '400', textAlign: 'center' },
  links: { flexDirection: 'row', gap: 20 },
  link: { textDecorationLine: 'underline' },
});
