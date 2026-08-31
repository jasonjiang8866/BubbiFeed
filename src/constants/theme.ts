/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2D3142',
    background: '#FFF9F6', // Soft warm cream/blush background
    backgroundElement: '#F4EAE6', // Milky sand
    backgroundSelected: '#E8D5CD', // Soft clay
    textSecondary: '#7C809B', // Muted slate-purple
    // Pastel Nursery Accent Colors
    primary: '#FF9B85', // Warm Coral/Peach
    breast: '#F7A8B8', // Cozy Rose Pink
    bottle: '#8CD1CA', // Milky Mint/Cyan
    solid: '#FFD97D', // Sunny Apricot/Yellow
    lavender: '#C5A3FF', // Lavender
    card: '#FFFFFF', // Milk-white solid cards
    cardBorder: '#F2DFD7', // Cozy card divider
    success: '#8BC34A',
  },
  dark: {
    text: '#FFF4EE', // Warm light text
    background: '#1F1916', // Dark warm espresso background
    backgroundElement: '#2E2420', // Rich coffee ground
    backgroundSelected: '#3E302A', // Creamy chocolate
    textSecondary: '#AC9F98', // Soft warm grey
    // Dark Pastel Nursery Accent Colors
    primary: '#FFA591',
    breast: '#FA7B93',
    bottle: '#5EBDB2',
    solid: '#FFCC4D',
    lavender: '#A87EFF',
    card: '#29201C', // Dark warm cards
    cardBorder: '#392C27',
    success: '#9CCC65',
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
