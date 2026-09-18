import { StyleSheet } from 'react-native';

import { Layout, type AppThemeColors } from '@/constants/theme';

export function createAuthStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.background,
    },
    brandMark: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: Layout.radiusMd,
      backgroundColor: theme.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    brandLetter: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.primary,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
      color: theme.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      textAlign: 'center',
      color: theme.textSecondary,
      marginBottom: 28,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Layout.radiusSm,
      padding: 14,
      marginBottom: 16,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Layout.radiusSm,
      marginBottom: 16,
      backgroundColor: theme.inputBackground,
    },
    passwordInput: {
      flex: 1,
      padding: 14,
      fontSize: 16,
      color: theme.text,
    },
    eyeIcon: {
      padding: 12,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: Layout.radiusSm,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    buttonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: '700',
    },
    link: {
      marginTop: 20,
      textAlign: 'center',
      color: theme.primary,
      fontWeight: '600',
    },
  });
}
