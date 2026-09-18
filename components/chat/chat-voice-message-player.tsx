import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useChatVoicePlayback } from '@/contexts/chat-voice-playback';
import { type AppThemeColors } from '@/constants/theme';

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type ChatVoiceMessagePlayerProps = {
  messageId: string;
  audioUrl: string;
  durationSec: number | null;
  isOwn: boolean;
  theme: AppThemeColors;
};

export function ChatVoiceMessagePlayer({
  messageId,
  audioUrl,
  durationSec,
  isOwn,
  theme,
}: ChatVoiceMessagePlayerProps) {
  const styles = useMemo(() => createStyles(theme, isOwn), [theme, isOwn]);
  const { toggleMessagePlayback, isMessagePlaying, activeMessageId, activeCurrentTime, activeDuration } =
    useChatVoicePlayback();

  const isActive = activeMessageId === messageId;
  const playing = isMessagePlaying(messageId);
  const totalSec =
    isActive && activeDuration > 0
      ? activeDuration
      : durationSec ?? 0;
  const currentSec = isActive ? activeCurrentTime : 0;
  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        void toggleMessagePlayback(messageId, audioUrl);
      }}
    >
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={22}
        color={isOwn ? theme.primaryForeground : theme.primary}
      />
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.duration}>
          {playing || (isActive && currentSec > 0)
            ? formatDuration(currentSec)
            : formatDuration(totalSec)}
        </Text>
      </View>
    </Pressable>
  );
}

function createStyles(theme: AppThemeColors, isOwn: boolean) {
  const accent = isOwn ? theme.primaryForeground : theme.primary;
  const muted = isOwn ? 'rgba(255,255,255,0.45)' : theme.border;
  const fill = isOwn ? 'rgba(255,255,255,0.85)' : theme.primary;

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 200,
      paddingVertical: 4,
    },
    trackWrap: {
      flex: 1,
      gap: 4,
    },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: muted,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: fill,
    },
    duration: {
      fontSize: 12,
      fontWeight: '600',
      color: accent,
      opacity: 0.9,
    },
  });
}
