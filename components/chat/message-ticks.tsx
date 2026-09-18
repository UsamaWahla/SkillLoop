import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AppThemeColors } from '@/constants/theme';

type MessageTicksProps = {
  theme: AppThemeColors;
  peerOnline: boolean;
  delivered: boolean;
  read: boolean;
  onLightBubble?: boolean;
};

export function MessageTicks({
  theme,
  peerOnline,
  delivered,
  read,
  onLightBubble,
}: MessageTicksProps) {
  const showDouble = read || delivered || peerOnline;
  const defaultColor = onLightBubble ? 'rgba(255,255,255,0.85)' : theme.textMuted;
  const color = read ? theme.secondary : defaultColor;

  if (!showDouble) {
    return (
      <View style={styles.wrap}>
        <Ionicons name="checkmark" size={16} color={color} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Ionicons name="checkmark-done" size={16} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: 3,
    marginBottom: 1,
  },
});
