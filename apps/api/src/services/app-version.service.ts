import { getStringSetting } from './settings.service';

// What the phone app asks at launch: the oldest version still allowed, the newest
// one out, and where to get it. The app does the comparing (it knows its own
// version); the server only says what the platform wants.
export async function versionPolicy(platform: 'android' | 'ios') {
  const [min, latest, storeUrl] = await Promise.all([
    getStringSetting('mobile.version.min'),
    getStringSetting('mobile.version.latest'),
    getStringSetting(platform === 'ios' ? 'mobile.storeUrl.ios' : 'mobile.storeUrl.android'),
  ]);
  return { min, latest, storeUrl: storeUrl || null };
}
