/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// HCP brand system (D24): Orange × Black × Flour. Mirrors the web/admin
// globals.css tokens.
//
// `primary` is a FILL colour: on Flour it is 3.1:1, so small text uses
// `primaryStrong` (Ember on light, a lighter orange on dark). Same for
// `accent` (Beer Gold) and `accentStrong`. `trail` is for trail and map UI;
// `danger` is Hash Red, lightened on dark so it stays readable.
export const Colors = {
  light: {
    text: '#171717',
    background: '#f4f1e8',
    canvas: '#eae5d6',
    card: '#ffffff',
    backgroundElement: '#f0ece0',
    backgroundSelected: '#e8e2d2',
    textSecondary: '#6b6b63',
    primary: '#f4511e',
    primaryStrong: '#b83a0e',
    onPrimary: '#171717',
    accent: '#d9a441',
    accentStrong: '#7a5c14',
    trail: '#3f6b4f',
    border: '#e0d9c6',
    danger: '#c62828',
  },
  dark: {
    text: '#f4f1e8',
    background: '#111111',
    canvas: '#0c0c0c',
    card: '#1c1c1c',
    backgroundElement: '#242424',
    backgroundSelected: '#2e2e2e',
    textSecondary: '#a6a39b',
    primary: '#f4511e',
    primaryStrong: '#ff7043',
    onPrimary: '#171717',
    accent: '#d9a441',
    accentStrong: '#d9a441',
    trail: '#6fa57f',
    border: '#2e2e2e',
    danger: '#f05545',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
