import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';

// One page, two jobs (D31), as the web has it (app/auth/verify/page.tsx): "we
// have sent you a link" straight after registering, and "here is my link" when
// they come back from the inbox.
export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token, sent: sentTo } = useLocalSearchParams<{ token?: string; sent?: string }>();
  const [state, setState] = useState<'checking' | 'done' | 'failed'>(token ? 'checking' : 'done');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api<{ alreadyVerified: boolean }>('/auth/verify-email', { method: 'POST', body: { token } })
      .then((data) => {
        if (!alive) return;
        setMessage(
          data.alreadyVerified
            ? 'That address was already confirmed. You can log in.'
            : 'Your email is confirmed. Welcome to Shiggy Trails.',
        );
        setState('done');
      })
      .catch((err) => {
        if (!alive) return;
        setMessage(errorMessage(err, 'That confirmation link is no longer valid.'));
        setState('failed');
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function resend() {
    if (!sentTo) return;
    setSending(true);
    try {
      await api('/auth/verification/resend', { method: 'POST', body: { email: sentTo } });
      // The API answers the same way whether or not the address is registered,
      // so this message must not claim more than it knows.
      Alert.alert('If that address needs confirming, a new link is on its way.');
    } catch {
      Alert.alert('Could not send it just now. Try again in a minute.');
    } finally {
      setSending(false);
    }
  }

  let body: React.ReactNode;
  if (token && state === 'checking') {
    body = <Skeleton height={160} />;
  } else if (token) {
    // Came back from the inbox.
    const ok = state === 'done';
    body = (
      <Card bleed={false}>
        <View testID="verify-result">
          <CardHeader>
            <View style={styles.titleRow}>
              {ok ? <CheckCircle2 size={24} color={theme.primaryStrong} /> : <XCircle size={24} color={theme.danger} />}
              <CardTitle style={styles.title}>{ok ? 'You are confirmed' : 'That link did not work'}</CardTitle>
            </View>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent style={styles.wrapRow}>
            {ok ? (
              <Button testID="verify-login" onPress={() => router.replace('/account')}>Log in</Button>
            ) : (
              <>
                <Button variant="outline" onPress={() => router.replace('/account')}>Back to sign in</Button>
                <ThemedText themeColor="textSecondary" style={styles.note}>
                  Links last 24 hours and can only be used once. Ask for a fresh one from the sign-in page.
                </ThemedText>
              </>
            )}
          </CardContent>
        </View>
      </Card>
    );
  } else {
    // Just registered.
    body = (
      <Card bleed={false}>
        <View testID="verify-sent">
          <CardHeader>
            <View style={styles.titleRow}>
              <MailCheck size={24} color={theme.primaryStrong} />
              <CardTitle style={styles.title}>Check your email</CardTitle>
            </View>
            <CardDescription>
              {sentTo
                ? `We sent a confirmation link to ${sentTo}. Click it and you are in.`
                : 'We sent you a confirmation link. Click it and you are in.'}
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.sent}>
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              The link lasts 24 hours. Nothing else to do until you have clicked it: your account is not usable yet.
            </ThemedText>
            <View style={styles.wrapRow}>
              {sentTo ? (
                <Button variant="outline" disabled={sending} testID="verify-resend" onPress={() => void resend()}>
                  {sending ? 'Sending…' : 'Send it again'}
                </Button>
              ) : null}
              <Button variant="outline" onPress={() => router.replace('/account')}>Back to sign in</Button>
            </View>
          </CardContent>
        </View>
      </Card>
    );
  }

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>{body}</ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, lineHeight: 32 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { width: '100%', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  sent: { gap: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
