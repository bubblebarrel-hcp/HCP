import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { CheckCircle2, Mail, XCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { typeLabel } from '@/lib/membership';

// FR-MEMBER-005 / D53, as the web has it (app/invitations/[token]/page.tsx): the one
// join path that reaches a hidden kennel. The preview is anonymous; accepting needs
// a session, the same shape as the password-reset and email-verification links.
interface InvitationPreview {
  kennel: { name: string; shortName: string; slug: string };
  membershipType: string;
  expiresAt: string;
}

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let alive = true;
    api<InvitationPreview>(`/invitations/token/${token}`)
      .then((data) => alive && setPreview(data))
      .catch((err) => alive && setError(errorMessage(err, 'That invitation link is no longer valid.')));
    return () => {
      alive = false;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    try {
      const data = await api<{ kennel: { slug: string; name: string } }>(`/invitations/token/${token}/accept`, { method: 'POST' });
      setAccepted(true);
      router.replace(`/kennels/${data.kennel.slug}`);
    } catch (err) {
      Alert.alert('Could not accept that invitation', errorMessage(err, 'Could not accept that invitation'));
    } finally {
      setAccepting(false);
    }
  }

  let body: React.ReactNode;
  if (error) {
    body = (
      <Card bleed={false}>
        <View testID="invitation-invalid">
          <CardHeader>
            <View style={styles.titleRow}>
              <XCircle size={24} color={theme.danger} />
              <CardTitle style={styles.title}>That link did not work</CardTitle>
            </View>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" style={styles.start} onPress={() => router.replace('/kennels')}>Find a kennel</Button>
          </CardContent>
        </View>
      </Card>
    );
  } else if (!preview || authLoading) {
    body = <Skeleton height={256} />;
  } else {
    body = (
      <Card bleed={false}>
        <View testID="invitation-preview">
          <CardHeader>
            <View style={styles.titleRow}>
              <Mail size={24} color={theme.primaryStrong} />
              <CardTitle style={styles.title}>You’re invited to {preview.kennel.name}</CardTitle>
            </View>
            <CardDescription>
              As a {typeLabel[preview.membershipType] ?? preview.membershipType}. This invitation is good until{' '}
              {new Date(preview.expiresAt).toLocaleDateString()}.
            </CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {accepted ? (
              <View style={styles.titleRow}>
                <CheckCircle2 size={20} color={theme.primaryStrong} />
                <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>Accepted. Taking you to the kennel…</ThemedText>
              </View>
            ) : user ? (
              <Button disabled={accepting} testID="accept-invitation" onPress={() => void accept()}>
                {accepting ? 'Joining…' : `Join ${preview.kennel.shortName}`}
              </Button>
            ) : (
              <View style={styles.stack}>
                <ThemedText themeColor="textSecondary" style={styles.sm}>
                  Log in or create an account, then come back to this link to accept.
                </ThemedText>
                <View style={styles.wrapRow}>
                  <Button onPress={() => router.push('/account')}>Log in</Button>
                  <Button variant="outline" onPress={() => router.push('/auth/register')}>Create an account</Button>
                </View>
              </View>
            )}
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
  // mx-auto flex max-w-md px-4 py-16
  page: { width: '100%', maxWidth: 448, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 64 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: 24, lineHeight: 32 },
  stack: { gap: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  start: { alignSelf: 'flex-start' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  medium: { fontWeight: '500' },
});
