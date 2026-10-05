import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import type { MentionItem, Page } from '@/lib/types';

// Everywhere somebody has mentioned you (D60), as far as you can still open it
// (web components/social/MentionsList.tsx). A notification can be missed or
// muted; this stays, and it only ever holds what you could read anyway.

const WHERE: Record<MentionItem['in'], string> = {
  POST: 'in a post',
  REEL: 'in a reel',
  COMMENT: 'in a comment',
};

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function MentionsList() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<MentionItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    api<Page<MentionItem>>('/me/mentions?limit=20&page=1')
      .then((data) => {
        if (!alive) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Could not load your mentions')));
    return () => {
      alive = false;
    };
  }, []);

  async function more() {
    setLoadingMore(true);
    try {
      const data = await api<Page<MentionItem>>(`/me/mentions?limit=20&page=${page + 1}`);
      setItems((current) => [...(current ?? []), ...data.items]);
      setPage(page + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load more'));
    } finally {
      setLoadingMore(false);
    }
  }

  function open(item: MentionItem) {
    if (item.segment === 'posts') router.push(`/posts/${item.targetId}`);
    else if (item.segment === 'reels') router.push(`/reels/${item.targetId}`);
    else if (item.segment === 'runs') router.push(`/run/${item.targetId}`);
    else if (item.segment === 'reports') router.push(`/trail-reports/${item.targetId}` as never);
    else if (item.segment === 'capsules') router.push(`/capsules/${item.targetId}` as never);
    else void Linking.openURL(`${WEB_URL}/${item.segment}/${item.targetId}`);
  }

  if (error) return <ThemedText style={[styles.message, { color: theme.danger }]}>{error}</ThemedText>;
  if (items === null) return <View style={[styles.skeleton, { backgroundColor: theme.backgroundElement }]} />;
  if (items.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.empty} testID="mentions-empty">
        Nobody has mentioned you yet. When they do, it is kept here.
      </ThemedText>
    );
  }
  return (
    <>
      <View testID="mentions-list">
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            testID="mention-row"
            onPress={() => open(item)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              pressed && { backgroundColor: theme.backgroundElement },
            ]}>
            <Avatar name={item.by.name} size={36} src={item.by.avatarUrl} />
            <View style={styles.main}>
              <ThemedText style={styles.line}>
                <ThemedText style={styles.name}>{item.by.name}</ThemedText>{' '}
                <ThemedText themeColor="textSecondary" style={styles.line}>mentioned you {WHERE[item.in]}</ThemedText>
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.sm}>{item.excerpt}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.xs}>{timeAgo(item.createdAt)}</ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
      {items.length < total && (
        <View style={[styles.more, { borderTopColor: theme.border }]}>
          <Button variant="outline" size="sm" disabled={loadingMore} onPress={() => void more()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  message: { padding: 32, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  empty: { padding: 40, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  skeleton: { height: 160 },
  row: { flexDirection: 'row', gap: 12, padding: 16 },
  main: { flex: 1, minWidth: 0 },
  line: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  more: { borderTopWidth: 1, padding: 12, alignItems: 'center' },
});
