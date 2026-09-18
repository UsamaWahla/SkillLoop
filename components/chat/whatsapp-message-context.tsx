import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { ChatMessage, QUICK_REACTIONS } from '@/lib/chat-types';

export type MessageContextState = {
  message: ChatMessage;
  isOwn: boolean;
} | null;

type WhatsAppMessageContextProps = {
  context: MessageContextState;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

export function WhatsAppMessageContext({
  context,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}: WhatsAppMessageContextProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (!context) return null;

  const { message, isOwn } = context;
  const isDeleted = Boolean(message.deleted_for_everyone_at);

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />

        <View style={styles.panel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reactionsRow}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => run(() => onReact(emoji))}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.actionsCard}>
            <ActionRow styles={styles} icon="arrow-undo-outline" label="Reply" onPress={() => run(onReply)} />
            {isOwn && !isDeleted && context.message.message_type === 'text' ? (
              <ActionRow styles={styles} icon="create-outline" label="Edit" onPress={() => run(onEdit)} />
            ) : null}
            <ActionRow
              styles={styles}
              icon="trash-outline"
              label="Delete for me"
              onPress={() => run(onDeleteForMe)}
            />
            {isOwn && !isDeleted ? (
              <ActionRow
                styles={styles}
                icon="trash-bin-outline"
                label="Delete for everyone"
                destructive
                isLast
                onPress={() => run(onDeleteForEveryone)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ActionRow({
  styles,
  icon,
  label,
  onPress,
  destructive,
  isLast,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable style={[styles.actionRow, isLast && styles.actionRowLast]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={destructive ? theme.error : theme.text} />
      <Text style={[styles.actionLabel, destructive && styles.actionDestructive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    panel: {
      paddingHorizontal: 16,
      paddingBottom: 28,
      gap: 12,
    },
    reactionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.surface,
      borderRadius: 28,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    reactionBtn: {
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    reactionEmoji: {
      fontSize: 28,
    },
    actionsCard: {
      backgroundColor: theme.surface,
      borderRadius: Layout.radiusMd,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    actionRowLast: {
      borderBottomWidth: 0,
    },
    actionLabel: {
      fontSize: 16,
      color: theme.text,
    },
    actionDestructive: {
      color: theme.error,
    },
  });
}
