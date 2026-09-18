import { View, Text, Image, StyleSheet } from 'react-native';

import type { AppThemeColors } from '@/constants/theme';

type ChatAvatarProps = {
  name: string | null;
  avatarUrl: string | null;
  size?: number;
  theme: AppThemeColors;
};

export function ChatAvatar({ name, avatarUrl, size = 40, theme }: ChatAvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.surfaceMuted,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4, color: theme.textSecondary }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#DFE5E7',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '600',
  },
});
