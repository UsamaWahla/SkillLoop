/**
 * SkillLoop design tokens — light and dark palettes.
 */

import { Platform } from 'react-native';

const tintColorLight = '#4F46E5';
const tintColorDark = '#818CF8';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
  },
};

export type AppThemeColors = {
  primary: string;
  primaryMuted: string;
  primaryForeground: string;
  secondary: string;
  secondaryMuted: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  star: string;
  tabBar: string;
  tabBarBorder: string;
  inputBackground: string;
  shadow: string;
};

export const AppThemes: Record<'light' | 'dark', AppThemeColors> = {
  light: {
    primary: '#4F46E5',
    primaryMuted: '#EEF2FF',
    primaryForeground: '#FFFFFF',
    secondary: '#0D9488',
    secondaryMuted: '#CCFBF1',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    star: '#F59E0B',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    inputBackground: '#FFFFFF',
    shadow: '#0F172A',
  },
  dark: {
    primary: '#818CF8',
    primaryMuted: '#312E81',
    primaryForeground: '#0F172A',
    secondary: '#2DD4BF',
    secondaryMuted: '#134E4A',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceMuted: '#334155',
    border: '#334155',
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    star: '#FBBF24',
    tabBar: '#1E293B',
    tabBarBorder: '#334155',
    inputBackground: '#1E293B',
    shadow: '#000000',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Layout = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusFull: 999,
  screenPadding: 20,
};
