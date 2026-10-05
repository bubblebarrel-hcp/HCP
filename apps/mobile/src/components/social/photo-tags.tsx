import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Tag, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { PhotoTag } from '@/lib/types';

// Who is in a photo (D60), as the web has it (components/social/PhotoTags.tsx). Tagging
// somebody asks them: until they say yes the tag shows to the two of you only, and a no
// is final. The tagged person, whoever tagged them and whoever took the photo can take a
// tag off.
interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export function PhotoTags({ mediaId }: { mediaId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Suggestion[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api<{ items: PhotoTag[] }>(`/photos/${mediaId}/tags`)
      .then((data) => setTags(data.items))
      .catch(() => undefined);
  }, [mediaId]);

  useEffect(() => {
    load();
  }, [load, user]);

  // The same picker the composer's "@" uses, just opened by a button.
  useEffect(() => {
    if (!adding || !user) return;
    let alive = true;
    const timer = setTimeout(() => {
      api<{ items: Suggestion[] }>(`/mentions/suggest?q=${encodeURIComponent(query)}&limit=6`)
        .then((data) => alive && setFound(data.items))
        .catch(() => alive && setFound([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, adding, user]);

  async function tag(person: Suggestion) {
    try {
      await api(`/photos/${mediaId}/tags`, { method: 'POST', body: { userId: person.id } });
      Alert.alert(`${person.name} has been asked.`);
      setAdding(false);
      setQuery('');
      load();
    } catch (err) {
      Alert.alert('Could not tag them', errorMessage(err, 'Could not tag them'));
    }
  }

  async function remove(tagId: string) {
    try {
      await api(`/photo-tags/${tagId}/remove`, { method: 'POST' });
      setTags((current) => current.filter((t) => t.id !== tagId));
    } catch (err) {
      Alert.alert('Could not remove that', errorMessage(err, 'Could not remove that'));
    }
  }

  if (!user && tags.length === 0) return null;

  return (
    <View style={styles.root} testID="photo-tags">
      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((t) => (
            <View key={t.id} testID="photo-tag" style={[styles.chip, { borderColor: theme.border }]}>
              <Avatar name={t.user.name} size={24} src={t.user.avatarUrl} />
              <ThemedText accessibilityRole="link" onPress={() => router.push(`/hashers/${t.user.id}`)} style={styles.sm}>
                {t.user.name}
              </ThemedText>
              {t.status === 'PENDING' ? <ThemedText themeColor="textSecondary" style={styles.xs}>(asked)</ThemedText> : null}
              {t.canRemove ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${t.user.name}'s tag`} hitSlop={8} onPress={() => void remove(t.id)}>
                  <X size={14} color={theme.text} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {user ? (
        adding ? (
          <View>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Who is in it?"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Find a hasher to tag"
              testID="photo-tag-input"
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            {found.length > 0 && (
              <View style={[styles.list, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {found.map((person) => (
                  <Pressable key={person.id} testID="photo-tag-suggestion" onPress={() => void tag(person)} style={styles.suggestion}>
                    <Avatar name={person.name} size={28} src={person.avatarUrl} />
                    <ThemedText numberOfLines={1} style={[styles.sm, styles.flex]}>{person.name}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>@{person.username}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Pressable accessibilityRole="button" testID="photo-tag-add" onPress={() => setAdding(true)} style={styles.add}>
            <Tag size={16} color={theme.primaryStrong} />
            <ThemedText style={[styles.sm, { color: theme.primaryStrong }]}>Tag a hasher</ThemedText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  input: { minHeight: 36, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 14 },
  list: { marginTop: 4, borderWidth: 1, borderRadius: 8, padding: 4 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 44 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
});
