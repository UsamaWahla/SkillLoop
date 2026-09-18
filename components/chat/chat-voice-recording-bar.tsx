import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import { type AppThemeColors } from '@/constants/theme';

function formatMmSs(totalMs: number) {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type ChatVoiceRecordingBarProps = {
  theme: AppThemeColors;
  durationMillis: number;
  slideCancel: boolean;
};

export function ChatVoiceRecordingBar({
  theme,
  durationMillis,
  slideCancel,
}: ChatVoiceRecordingBarProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, slideCancel && styles.hintCancel]}>
        {slideCancel ? 'Release to cancel' : '← Slide to cancel'}
      </Text>
      <View style={styles.timerRow}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.timer}>{formatMmSs(durationMillis)}</Text>
      </View>
    </View>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 4,
    },
    hint: {
      flex: 1,
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    hintCancel: {
      color: theme.error,
      fontWeight: '600',
    },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.error,
    },
    timer: {
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      fontWeight: '600',
      color: theme.text,
      minWidth: 44,
      textAlign: 'right',
    },
  });
}
