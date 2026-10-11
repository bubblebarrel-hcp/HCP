import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, CardContent, Skeleton, Subpage } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { canMessage, clientKey, MAX_MESSAGE, startConversation } from '@/lib/messages';
import type { HasherProfile } from '@/lib/types';

// The first message to somebody (D71), as the web has it (app/messages/new). If a
// conversation already exists this goes straight to it. If they do not follow you
// and share no kennel with you, it is sent as a request, and you can send one
// message until they accept.
export default function NewMessageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to: string }>();
  const { user, loading } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const key = useRef(clientKey());

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !to) return;
    let alive = true;
    canMessage(to)
      .then(async (can) => {
        if (!alive) return;
        if (can.conversationId) return router.replace(`/messages/${can.conversationId}`);
        if (!can.allowed) {
          setBlocked(can.reason === 'CLOSED' ? 'This hasher is not taking new messages.' : 'You cannot message this hasher.');
          return;
        }
        const data = await api<{ hasher: HasherProfile }>(`/hashers/${to}`);
        if (alive) setName(data.hasher.name);
      })
      .catch(() => alive && setBlocked('You cannot message this hasher.'));
    return () => {
      alive = false;
    };
  }, [user, to, router]);

  async function send() {
    const text = body.trim();
    if (!text || sending || !to) return;
    setSending(true);
    try {
      const sent = await startConversation(to, text, key.current);
      router.replace(`/messages/${sent.conversationId}`);
    } catch (err) {
      Alert.alert('Could not send that', errorMessage(err, 'Try again'));
      setSending(false);
    }
  }

  return (
    <Subpage back="Messages" onBack={() => router.replace('/messages')}>
      <View testID="new-message">
        {blocked ? (
          <Card bleed={false}>
            <ThemedText themeColor="textSecondary" style={styles.sm} testID="new-message-blocked">
              {blocked}
            </ThemedText>
          </Card>
        ) : !name ? (
          <Skeleton height={160} />
        ) : (
          <Card bleed={false}>
            <CardContent style={styles.gap}>
              <View style={styles.who}>
                <Avatar name={name} size={40} />
                <View>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    New message to
                  </ThemedText>
                  <ThemedText style={styles.name}>{name}</ThemedText>
                </View>
              </View>
              <TextInput
                testID="new-message-body"
                value={body}
                onChangeText={setBody}
                maxLength={MAX_MESSAGE}
                multiline
                placeholder="Write your message"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              />
              <View style={styles.foot}>
                <ThemedText themeColor="textSecondary" style={styles.xs}>
                  {body.length}/{MAX_MESSAGE}
                </ThemedText>
                <Button testID="new-message-send" busy={sending} disabled={!body.trim() || sending} onPress={() => void send()}>
                  Send
                </Button>
              </View>
            </CardContent>
          </Card>
        )}
      </View>
    </Subpage>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20 },
  xs: { fontSize: 12, lineHeight: 16 },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
