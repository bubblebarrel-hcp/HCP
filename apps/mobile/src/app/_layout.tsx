import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BottomNav } from '@/components/bottom-nav';
import { AppHeader } from '@/components/feed/app-header';
import { AuthProvider } from '@/context/auth';
import { ThemePreferenceProvider, useThemePreference } from '@/context/theme-preference';
import { Notifications, routeFor } from '@/lib/push';
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
  // Only mounted when Notifications loaded (see Shell), so the hook is stable.
  const response = Notifications!.useLastNotificationResponse();

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

// Screens pushed on top of the tab group. The web app has one header on every
// page, so there is no per-screen navigation bar here: the shared AppHeader is
// drawn once by Shell, and going back is the platform's own gesture or button.
function PushedScreens() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.canvas },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="run/[id]" options={{ title: 'Run' }} />
      <Stack.Screen name="trail-reports/index" options={{ title: 'Trail reports' }} />
      <Stack.Screen name="trail-reports/[id]" options={{ title: 'Trail report' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="saved" options={{ title: 'Saved' }} />
      <Stack.Screen name="settings/notifications" options={{ title: 'Notification settings' }} />
      <Stack.Screen name="passport" options={{ title: 'Hash Passport' }} />
      <Stack.Screen name="kennels/[slug]/index" options={{ title: 'Kennel' }} />
      <Stack.Screen name="kennels/[slug]/runs" options={{ title: 'Kennel runs' }} />
      <Stack.Screen name="kennels/[slug]/officers" options={{ title: 'Officers' }} />
      <Stack.Screen name="comments/[segment]/[id]" options={{ title: 'Comments' }} />
      <Stack.Screen name="hashers/[id]" options={{ title: 'Hasher' }} />
      <Stack.Screen name="posts/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="reels/[id]" options={{ title: 'Reel' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="follow-requests" options={{ title: 'Follow requests' }} />
      <Stack.Screen name="tags/[tag]" options={{ title: 'Tag' }} />
      <Stack.Screen name="u/[username]" options={{ title: 'Hasher' }} />
      <Stack.Screen name="blocked" options={{ title: 'Blocked and muted' }} />
      <Stack.Screen name="photo-tags" options={{ title: 'Photo tags' }} />
      <Stack.Screen name="report/[type]/[id]" options={{ title: 'Report' }} />
      <Stack.Screen name="reports" options={{ title: 'My reports' }} />
      <Stack.Screen name="auth/register" options={{ title: 'Create account' }} />
      <Stack.Screen name="auth/verify" options={{ title: 'Confirm email' }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: 'Forgot password' }} />
      <Stack.Screen name="auth/reset-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}

// The header sits above the Stack so it is on every screen, as the web's sticky
// header is on every page: the status bar area is painted in the header's own
// colour, then the 56pt bar, then the screen.
function Frame() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: theme.canvas }}>
      <View style={{ backgroundColor: theme.card, paddingTop: insets.top }}>
        <AppHeader onSearch={() => router.push('/search' as never)} />
      </View>
      <View style={{ flex: 1 }}>
        <PushedScreens />
      </View>
      <BottomNav />
    </View>
  );
}

function Shell() {
  const { scheme } = useThemePreference();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        {Platform.OS !== 'web' && Notifications && <PushRouting />}
        <Frame />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function TabLayout() {
  // The web app's typeface. Nothing renders until it is in, so the splash stays up
  // rather than text changing face under the reader.
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  if (!fontsLoaded && !fontError) return null;

  // Gesture Handler needs a root view above every GestureDetector (the feed's
  // pull-to-refresh uses one).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <Shell />
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
