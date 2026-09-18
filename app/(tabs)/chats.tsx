import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatInboxRowView } from '@/components/chat/chat-inbox-row';
import { AnimatedPageView } from '@/components/ui/animated-page-view';
import type { AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  buildChatInboxRows,
  type ChatInboxRow,
  type InboxMatch,
  type InboxMessage,
  type InboxProfile,
} from '@/lib/chat-inbox';
import { supabase } from '@/lib/supabase';

export default function ChatsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [rows, setRows] = useState<ChatInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        Alert.alert('Error loading chats', sessionError.message);
        return;
      }

      const userId = session?.user?.id;
      if (!userId) return;

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('id, user_id_1, user_id_2')
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

      if (matchesError) {
        Alert.alert('Error loading chats', matchesError.message);
        return;
      }

      const matches = (matchesData ?? []) as InboxMatch[];
      if (matches.length === 0) {
        setRows([]);
        return;
      }

      const matchIds = matches.map((match) => match.id);
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(
          'id, match_id, sender_id, content, message_type, media_name, created_at, deleted_for_everyone_at, message_receipts(user_id, read_at)'
        )
        .in('match_id', matchIds)
        .order('created_at', { ascending: true });

      if (messagesError) {
        Alert.alert('Error loading chats', messagesError.message);
        return;
      }

      const { data: hiddenData, error: hiddenError } = await supabase
        .from('message_hidden')
        .select('message_id')
        .eq('user_id', userId);

      if (hiddenError) {
        Alert.alert('Error loading chats', hiddenError.message);
        return;
      }

      const otherUserIds = [
        ...new Set(
          matches.map((match) =>
            match.user_id_1 === userId ? match.user_id_2 : match.user_id_1
          )
        ),
      ];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherUserIds);

      if (profilesError) {
        Alert.alert('Error loading chats', profilesError.message);
        return;
      }

      const profiles = (profilesData ?? []).reduce<Record<string, InboxProfile>>(
        (byId, profile) => {
          byId[profile.id] = {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          };
          return byId;
        },
        {}
      );

      setRows(
        buildChatInboxRows({
          currentUserId: userId,
          matches,
          messages: (messagesData ?? []) as InboxMessage[],
          hiddenIds: new Set((hiddenData ?? []).map((item) => item.message_id)),
          profiles,
        })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadChats();
    }, [loadChats])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadChats();
  }, [loadChats]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const nowMs = Date.now();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { paddingTop: insets.top + 12 }]}>Chats</Text>
      <AnimatedPageView pageKey={0} direction="next">
        <FlatList
          data={rows}
          keyExtractor={(row) => row.matchId}
          renderItem={({ item }) => (
            <ChatInboxRowView
              row={item}
              theme={theme}
              nowMs={nowMs}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: { matchId: item.matchId, otherName: item.otherName },
                })
              }
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            rows.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No chats yet. Open someone’s profile on Home and tap Chat to start a conversation.
                </Text>
              </View>
            ) : null
          }
        />
      </AnimatedPageView>
    </View>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    title: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    listContent: {
      paddingBottom: 24,
    },
    emptyListContent: {
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 15,
      textAlign: 'center',
    },
  });
}
