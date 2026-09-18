import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatAvatar } from '@/components/chat/chat-avatar';
import type { AppThemeColors } from '@/constants/theme';
import { formatInboxTime, type ChatInboxRow } from '@/lib/chat-inbox';

type ChatInboxRowViewProps = {
  row: ChatInboxRow;
  theme: AppThemeColors;
  nowMs: number;
  onPress: () => void;
};

export function ChatInboxRowView({ row, theme, nowMs, onPress }: ChatInboxRowViewProps) {
  const isUnread = row.unreadCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          borderBottomColor: theme.border,
          backgroundColor: pressed ? theme.surfaceMuted : theme.background,
        },
      ]}
    >
      <ChatAvatar
        name={row.otherName}
        avatarUrl={row.otherAvatarUrl}
        size={50}
        theme={theme}
      />

      <View style={styles.content}>
        <Text
          numberOfLines={1}
          style={[styles.name, { color: theme.text }, isUnread && styles.unreadText]}
        >
          {row.otherName}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.preview,
            { color: theme.textSecondary },
            isUnread && styles.unreadText,
          ]}
        >
          {row.preview}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={[styles.time, { color: theme.textMuted }]}>
          {formatInboxTime(row.lastMessageAt, nowMs)}
        </Text>
        {isUnread ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>{row.unreadCount > 99 ? '99+' : row.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 3,
  },
  preview: {
    fontSize: 14,
    fontWeight: '400',
  },
  unreadText: {
    fontWeight: '600',
  },
  meta: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  time: {
    fontSize: 12,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
