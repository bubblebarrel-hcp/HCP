import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountView } from '@/components/account/account-view';
import { LoginForm } from '@/components/auth/login-form';
import { ThemedView } from '@/components/themed-view';
import { Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

// The Menu tab is the web app's account page (see AccountView). Signed out it is
// the log-in form; the page never flashes its logged-out state while the session
// is still being restored.
export default function AccountScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView type="canvas" style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={[]}>
          <View style={styles.skeleton}>
            <Skeleton height={288} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (user) return <AccountView />;

  return (
    <ThemedView type="canvas" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <LoginForm />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  skeleton: { paddingVertical: 16, width: '100%' },
});
