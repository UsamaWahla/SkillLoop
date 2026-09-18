import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { ChatVoiceMessagePlayer } from '@/components/chat/chat-voice-message-player';
import type { ChatMessage } from '@/lib/chat-types';

type MessageMediaBodyProps = {
  message: ChatMessage;
  isOwn: boolean;
  theme: AppThemeColors;
  isDeleted: boolean;
};

type MediaStyles = ReturnType<typeof createStyles>;

function VideoBubble({ url, videoStyle }: { url: string; videoStyle: MediaStyles['video'] }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={videoStyle}
      contentFit="cover"
      nativeControls
    />
  );
}

export function MessageMediaBody({ message, isOwn, theme, isDeleted }: MessageMediaBodyProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imageLoading, setImageLoading] = useState(true);

  if (isDeleted || !message.media_url) {
    return null;
  }

  const type = message.message_type ?? 'text';

  if (type === 'image') {
    return (
      <View style={styles.mediaWrap}>
        {imageLoading ? (
          <ActivityIndicator style={styles.mediaLoader} color={theme.primary} />
        ) : null}
        <Image
          source={{ uri: message.media_url }}
          style={styles.image}
          resizeMode="cover"
          onLoadEnd={() => setImageLoading(false)}
        />
      </View>
    );
  }

  if (type === 'video') {
    return (
      <View style={styles.mediaWrap}>
        <VideoBubble url={message.media_url} videoStyle={styles.video} />
      </View>
    );
  }

  if (type === 'audio') {
    return (
      <ChatVoiceMessagePlayer
        messageId={message.id}
        audioUrl={message.media_url}
        durationSec={message.media_duration_sec}
        isOwn={isOwn}
        theme={theme}
      />
    );
  }

  if (type === 'document') {
    return (
      <Pressable
        style={styles.docRow}
        onPress={() => Linking.openURL(message.media_url!)}
      >
        <Ionicons
          name="document-text-outline"
          size={28}
          color={isOwn ? theme.primaryForeground : theme.primary}
        />
        <Text
          style={[styles.docName, isOwn && styles.docNameOwn]}
          numberOfLines={2}
        >
          {message.media_name ?? message.content}
        </Text>
      </Pressable>
    );
  }

  return null;
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    mediaWrap: {
      marginBottom: 4,
      borderRadius: Layout.radiusSm,
      overflow: 'hidden',
      minWidth: 200,
    },
    mediaLoader: {
      position: 'absolute',
      alignSelf: 'center',
      top: '40%',
      zIndex: 1,
    },
    image: {
      width: 240,
      height: 180,
      backgroundColor: theme.surfaceMuted,
    },
    video: {
      width: 240,
      height: 180,
      backgroundColor: theme.surfaceMuted,
    },
    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: 240,
      paddingVertical: 4,
    },
    docName: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      fontWeight: '500',
    },
    docNameOwn: {
      color: theme.primaryForeground,
    },
  });
}
