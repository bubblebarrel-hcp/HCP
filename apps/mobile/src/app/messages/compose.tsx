import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

// "New message": pick a hasher, then write to them (D71), as the web dialog does
// (components/messages/NewMessageDialog.tsx). The same search the @mention box
// uses, so blocked hashers are never offered (D60). Whether they can be written
// to at all is answered on the next screen, where a closed door says so.
export default function ComposeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<{ items: Suggestion[] }>(`/mentions/suggest?q=${encodeURIComponent(query)}&limit=8`)
        .then((data) => alive && setFound(data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [user, query]);

  return (
    <Subpage back="Messages" onBack={() => router.replace('/messages')}>
      <View style={styles.page} testID="compose">
        <ThemedText style={styles.title}>New message</ThemedText>
        <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
          <Search size={16} color={theme.textSecondary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or @username"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Search hashers"
            testID="new-message-search"
            style={[styles.input, { color: theme.text }]}
          />
        </View>
        {found.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            No one found.
          </ThemedText>
        ) : (
          found.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" testID="new-message-result" onPress={() => router.replace(`/messages/new?to=${s.id}`)} style={styles.row}>
              <Avatar name={s.name} size={44} src={s.avatarUrl} />
              <View style={styles.main}>
                <ThemedText numberOfLines={1} style={styles.name}>
                  {s.name}
                </ThemedText>
                <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.xs}>
                  @{s.username}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 16, minHeight: 42 },
  input: { flex: 1, fontSize: 14, paddingVertical: 8 },
  empty: { padding: 24, textAlign: 'center', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  xs: { fontSize: 12, lineHeight: 16 },
});
