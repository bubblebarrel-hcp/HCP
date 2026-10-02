import { useEffect } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { ThemePreferenceProvider, useThemePreference } from '@/context/theme-preference';
import { routeFor } from '@/lib/push';
import { useTheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

// Tapping a push should open the thing it is about. The hook rather than a
// listener because it also answers when the tap is what launched the app from
// cold, which a listener mounted afterwards would miss.
//
// Never mounted on web: the hook reaches for a native method that does not
// exist there, and the throw takes the whole app down with it rather than
// degrading. Conditional mounting rather than a conditional hook call, so the
// hook count stays stable.
function PushRouting() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const path = routeFor(data);
    // routeFor returns a plain string; typed routes only accept literal Hrefs,
    // so this is the one deliberate escape hatch rather than widening Href everywhere.
    if (path) router.push(path as Parameters<typeof router.push>[0]);
  }, [response, router]);

  return null;
}

// Screens pushed on top of the tab group. Headers are themed plainly here;
// each screen still renders its own in-content heading for the tab-group look,
// so this bar mainly carries the native back gesture/button.
function PushedScreens() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.primaryStrong,
        headerStyle: { backgroundColor: theme.card },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.canvas },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="run/[id]" options={{ title: 'Run' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="passport" options={{ title: 'Hash Passport' }} />
      <Stack.Screen name="kennels/[slug]/index" options={{ title: 'Kennel' }} />
      <Stack.Screen name="kennels/[slug]/officers" options={{ title: 'Officers' }} />
      <Stack.Screen name="comments/[segment]/[id]" options={{ title: 'Comments' }} />
      <Stack.Screen name="hashers/[id]" options={{ title: 'Hasher' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="follow-requests" options={{ title: 'Follow requests' }} />
      <Stack.Screen name="auth/register" options={{ title: 'Create account' }} />
      <Stack.Screen name="auth/verify" options={{ title: 'Confirm email' }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: 'Forgot password' }} />
      <Stack.Screen name="auth/reset-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}

function Shell() {
  const { scheme } = useThemePreference();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        {Platform.OS !== 'web' && <PushRouting />}
        <PushedScreens />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <ThemePreferenceProvider>
      <Shell />
    </ThemePreferenceProvider>
  );
}
