/**
 * The HCP palette for the active theme (D24). Follows the phone unless the
 * hasher picked Light or Dark in Menu → Display.
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/context/theme-preference';

export function useTheme() {
  const { scheme } = useThemePreference();
  return Colors[scheme];
}
