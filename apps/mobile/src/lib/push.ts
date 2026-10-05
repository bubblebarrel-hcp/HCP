import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { api } from '@/lib/api';

// expo-notifications throws at import time in Expo Go on Android (SDK 53+
// removed remote push from it). A static import would take every route down
// with it, so load it defensively: null means "no push in this runtime" and the
// app carries on with in-app notifications only. A development build gets the
// real module.
export const Notifications: typeof import('expo-notifications') | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
})();

// Registering this handset for push (D12).
//
// The token comes from Expo, is handed to the API, and is what the server
// addresses when a trail goes live. Everything here is allowed to fail: a
// hasher who says no to the permission prompt, or runs the app in a simulator,
// still gets every notification in the app. Push is an extra way to hear, never
// the only one.

// A notification arriving while the app is open should still be seen. Safe to
// call on web, where it warns and does nothing.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushOutcome =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: 'web' | 'unavailable' | 'simulator' | 'denied' | 'unconfigured' | 'error';
      message: string;
    };

/**
 * Expo needs to know which project a token belongs to. `eas init` writes this
 * into app.json; without it there is no token to get, which is a setup gap
 * rather than something the hasher did wrong.
 */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || !Notifications) return;
  // Android decides how loudly to interrupt from the channel, not the message,
  // so the channel has to exist before the first notification lands.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Runs and trails',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F4511E',
  });
}

/** Ask for permission and hand the resulting token to the API. */
export async function registerForPush(): Promise<PushOutcome> {
  // Browser push is a different build entirely — VAPID keys and a service
  // worker — and is not built (D36). Saying so beats letting a native module
  // throw an error nobody can act on. Checked before isDevice, which is true in
  // a browser on a real machine.
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'web', message: 'Push works in the Shiggy Trails phone app. Browser notifications are not built yet.' };
  }

  if (!Notifications) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Push is not available in Expo Go. Use a development build to receive push notifications.',
    };
  }

  // A simulator has no push service behind it, so there is no token to get.
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator', message: 'Push needs a real device.' };
  }

  const id = projectId();
  if (!id) {
    return {
      ok: false,
      reason: 'unconfigured',
      message: 'This build has no Expo project id yet, so push cannot be set up. Run `eas init` in apps/mobile.',
    };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    // Only prompt when we have not been answered before; asking again after a
    // refusal is how apps get muted at the OS level.
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) {
      return { ok: false, reason: 'denied', message: 'Notifications are turned off for Shiggy Trails in your settings.' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api('/me/devices', {
      method: 'POST',
      body: { pushToken: token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' },
    });
    return { ok: true, token };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Hand the device back on the way out, so the next person holding this phone
 * does not get the last one's mail. Best-effort: signing out must not fail
 * because a network call did.
 */
export async function unregisterForPush(): Promise<void> {
  try {
    const id = projectId();
    if (!Notifications || !id || !Device.isDevice || Platform.OS === 'web') return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api('/me/devices/revoke', { method: 'POST', body: { pushToken: token } });
  } catch {
    // The server retires a token it cannot deliver to anyway.
  }
}

/** Where a tapped notification should take the hasher. */
export function routeFor(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const type = typeof data.contextType === 'string' ? data.contextType : null;
  const id = typeof data.contextId === 'string' ? data.contextId : null;
  if (!type || !id) return '/notifications';
  switch (type) {
    case 'Run':
    case 'Trail':
      return `/run/${id}`;
    // Somebody asked to follow a locked profile (D57): the thing to do is answer.
    case 'FollowRequest':
      return '/follow-requests';
    // Somebody tagged you in a photo and wants your yes (D60).
    // The outcome of something you reported (D61).
    case 'Report':
      return '/reports';
    case 'PhotoTag':
      return '/photo-tags';
    // A like or a comment names the thing it was on (D50).
    case 'Post':
      return `/posts/${id}`;
    case 'Reel':
      return `/reels/${id}`;
    // A social notice about a person (an approved request) opens them.
    case 'User':
      return `/hashers/${id}`;
    case 'Kennel':
    case 'Membership':
      return '/kennels';
    default:
      return '/notifications';
  }
}
