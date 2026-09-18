import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { MessageTicks } from '@/components/chat/message-ticks';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { MessageMediaBody } from '@/components/chat/message-media-body';
import { ChatMessage, DELETED_EVERYONE_LABEL } from '@/lib/chat-types';

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type ChatMessageRowProps = {
  item: ChatMessage;
  isOwn: boolean;
  theme: AppThemeColors;
  otherUserId: string | null;
  peerOnline: boolean;
  replyPreview?: string | null;
  onReply: (message: ChatMessage) => void;
  onLongPress: (message: ChatMessage, isOwn: boolean) => void;
  onReactTap: (messageId: string, emoji: string) => void;
};

export function ChatMessageRow({
  item,
  isOwn,
  theme,
  otherUserId,
  peerOnline,
  replyPreview,
  onReply,
  onLongPress,
  onReactTap,
}: ChatMessageRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isDeletedEveryone = Boolean(item.deleted_for_everyone_at);
  const messageType = item.message_type ?? 'text';
  const isTextMessage = messageType === 'text';
  const bodyText = isDeletedEveryone ? DELETED_EVERYONE_LABEL : item.content;

  const receipt = otherUserId
    ? item.message_receipts.find((r) => r.user_id === otherUserId)
    : undefined;
  const delivered = Boolean(receipt?.delivered_at);
  const read = Boolean(receipt?.read_at);

  const reactions = item.message_reactions ?? [];
  const reactionSummary = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(item, isOwn);
  }

  const bubble = (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}
    >
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {replyPreview ? (
          <View style={[styles.quoteBox, !isOwn && styles.quoteBoxOther]}>
            <View style={[styles.quoteAccent, !isOwn && styles.quoteAccentOther]} />
            <Text
              style={[styles.quoteText, isOwn ? styles.quoteTextOwn : styles.quoteTextOther]}
              numberOfLines={2}
            >
              {replyPreview}
            </Text>
          </View>
        ) : null}

        {!isDeletedEveryone && messageType !== 'text' ? (
          <MessageMediaBody
            message={item}
            isOwn={isOwn}
            theme={theme}
            isDeleted={isDeletedEveryone}
          />
        ) : null}

        {(isTextMessage || isDeletedEveryone) && (
          <Text
            style={[styles.bubbleText, isOwn && styles.bubbleTextOwn, isDeletedEveryone && styles.deletedText]}
          >
            {bodyText}
          </Text>
        )}

        <View style={styles.metaRow}>
          {item.edited_at && !isDeletedEveryone ? (
            <Text style={[styles.editedLabel, isOwn && styles.editedLabelOwn]}>Edited </Text>
          ) : null}
          <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>{formatMessageTime(item.created_at)}</Text>
          {isOwn ? (
            <MessageTicks
              theme={theme}
              peerOnline={peerOnline}
              delivered={delivered}
              read={read}
              onLightBubble
            />
          ) : null}
        </View>
      </View>

      {Object.keys(reactionSummary).length > 0 ? (
        <View style={[styles.reactionBar, isOwn ? styles.reactionBarOwn : styles.reactionBarOther]}>
          {Object.entries(reactionSummary).map(([emoji, count]) => (
            <Pressable key={emoji} onPress={() => onReactTap(item.id, emoji)} style={styles.reactionChip}>
              <Text style={styles.reactionEmoji}>
                {emoji}
                {count > 1 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootLeft={false}
      renderLeftActions={() => (
        <Pressable
          style={styles.replyAction}
          onPress={() => {
            swipeRef.current?.close();
            onReply(item);
          }}
        >
          <Ionicons name="arrow-undo" size={22} color={theme.primaryForeground} />
        </Pressable>
      )}
    >
      {bubble}
    </Swipeable>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    messageRow: {
      marginBottom: 8,
      maxWidth: '82%',
    },
    messageRowOwn: {
      alignSelf: 'flex-end',
    },
    messageRowOther: {
      alignSelf: 'flex-start',
    },
    bubble: {
      borderRadius: Layout.radiusMd,
      paddingTop: 8,
      paddingBottom: 6,
      paddingHorizontal: 10,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    bubbleOwn: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: theme.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quoteBox: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 6,
      padding: 6,
      marginBottom: 6,
      overflow: 'hidden',
    },
    quoteBoxOther: {
      backgroundColor: theme.surfaceMuted,
    },
    quoteAccent: {
      width: 4,
      backgroundColor: theme.primaryForeground,
      borderRadius: 2,
      marginRight: 8,
    },
    quoteAccentOther: {
      backgroundColor: theme.primary,
    },
    quoteText: {
      flex: 1,
      fontSize: 13,
    },
    quoteTextOwn: {
      color: theme.primaryForeground,
      opacity: 0.95,
    },
    quoteTextOther: {
      color: theme.textSecondary,
    },
    bubbleText: {
      fontSize: 16,
      lineHeight: 22,
      color: theme.text,
    },
    bubbleTextOwn: {
      color: theme.primaryForeground,
    },
    deletedText: {
      fontStyle: 'italic',
      opacity: 0.9,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 4,
      gap: 2,
    },
    editedLabel: {
      fontSize: 11,
      color: theme.textMuted,
    },
    editedLabelOwn: {
      color: 'rgba(255,255,255,0.75)',
    },
    timeText: {
      fontSize: 11,
      color: theme.textMuted,
      marginLeft: 4,
    },
    timeTextOwn: {
      color: 'rgba(255,255,255,0.75)',
    },
    reactionBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: -4,
      marginBottom: 4,
    },
    reactionBarOwn: {
      alignSelf: 'flex-end',
      marginRight: 4,
    },
    reactionBarOther: {
      alignSelf: 'flex-start',
      marginLeft: 4,
    },
    reactionChip: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    reactionEmoji: {
      fontSize: 14,
    },
    replyAction: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 56,
      marginBottom: 8,
      backgroundColor: theme.primary,
      borderRadius: Layout.radiusSm,
      marginRight: 4,
    },
  });
}
