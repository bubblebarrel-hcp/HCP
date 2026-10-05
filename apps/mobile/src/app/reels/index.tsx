import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ReelsGrid } from '@/components/feed/reels-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import type { Page, Reel } from '@/lib/types';

// Reels, newest first (D57), as the web's /reels page lays it out: a heading and a
// grid. Signed out, the public ones; signed in, the hashers you follow and your own.
// The rail on Home is the same list, cut short; this is where "See all" goes.
// 30 is the API's cap; paging is the follow-up, as on the web.
export default function ReelsScreen() {
  const { user, loading } = useAuth();
  const [reels, setReels] = useState<Reel[] | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<Page<Reel>>('/reels?limit=30')
      .then((page) => alive && setReels(page.items))
      .catch(() => alive && setReels([]));
    return () => {
      alive = false;
    };
  }, [user, loading]);

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.head}>
            <ThemedText accessibilityRole="header" style={styles.h1}>Reels</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lead}>
              On trail, at the Circle, at a meeting, or holding a beer at home.
            </ThemedText>
          </View>
          {reels === null ? (
            <Skeleton height={256} />
          ) : (
            <ReelsGrid
              reels={reels}
              emptyText={
                user
                  ? 'Nothing here yet. Follow hashers and their reels land here; post one of your own and it does too.'
                  : 'No public reels yet. Sign in and follow hashers to fill this with theirs.'
              }
            />
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  head: { paddingHorizontal: 16, paddingBottom: 0 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
});
