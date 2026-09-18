import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ChatAvatar } from '@/components/chat/chat-avatar';
import { ChatMessageRow } from '@/components/chat/chat-message-row';
import {
  MessageContextState,
  WhatsAppMessageContext,
} from '@/components/chat/whatsapp-message-context';
import { Layout, type AppThemeColors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { ChatAttachSheet } from '@/components/chat/chat-attach-sheet';
import { ChatVoiceRecordingBar } from '@/components/chat/chat-voice-recording-bar';
import { ChatVoicePlaybackProvider } from '@/contexts/chat-voice-playback';
import { useHoldVoiceRecorder } from '@/hooks/use-hold-voice-recorder';
import {
  ChatMessage,
  ChatMessageType,
  DELETED_EVERYONE_LABEL,
} from '@/lib/chat-types';
import { defaultContentForType, getMessagePreview, uploadChatFile } from '@/lib/chat-media';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

const MESSAGE_SELECT = `
  id, match_id, sender_id, content, message_type, media_url, media_name, media_mime, media_duration_sec,
  created_at, reply_to_id, edited_at, deleted_for_everyone_at,
  message_receipts (user_id, delivered_at, read_at),
  message_reactions (user_id, emoji)
`;

function normalizeMessage(row: Record<string, unknown>): ChatMessage {
  return {
    ...(row as ChatMessage),
    message_type: (row.message_type as ChatMessageType) ?? 'text',
    media_url: (row.media_url as string | null) ?? null,
    media_name: (row.media_name as string | null) ?? null,
    media_mime: (row.media_mime as string | null) ?? null,
    media_duration_sec: (row.media_duration_sec as number | null) ?? null,
    message_receipts: (row.message_receipts as ChatMessage['message_receipts']) ?? [],
    message_reactions: (row.message_reactions as ChatMessage['message_reactions']) ?? [],
  };
}

export default function ChatScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ matchId: string; otherName?: string }>();

  const matchId = params.matchId;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState<string | null>(params.otherName ?? null);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [messageContext, setMessageContext] = useState<MessageContextState>(null);
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const voiceRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voiceRecorderState = useAudioRecorderState(voiceRecorder, 200);

  const ensureRecorderPrepared = useCallback(async () => {
    const { canRecord, isRecording } = voiceRecorder.getStatus();
    if (isRecording || canRecord) return;
    await voiceRecorder.prepareToRecordAsync();
  }, [voiceRecorder]);

  const holdVoice = useHoldVoiceRecorder({
    recorder: voiceRecorder,
    recorderState: voiceRecorderState,
    ensurePrepared: ensureRecorderPrepared,
    disabled: uploadingMedia || sending,
  });

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenIds.has(m.id)),
    [messages, hiddenIds]
  );

  const messageById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === incoming.id);
      if (idx === -1) {
        return [...prev, incoming].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...incoming };
      return next;
    });
  }, []);

  const patchReceipt = useCallback(
    (messageId: string, userId: string, patch: { delivered_at?: string; read_at?: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const receipts = m.message_receipts.map((r) =>
            r.user_id === userId ? { ...r, ...patch } : r
          );
          return { ...m, message_receipts: receipts };
        })
      );
    },
    []
  );

  const markInboundReceipts = useCallback(
    async (opts: { delivered: boolean; read: boolean }) => {
      if (!currentUserId) return;
      const now = new Date().toISOString();
      const inbound = messagesRef.current.filter((m) => m.sender_id !== currentUserId);

      for (const msg of inbound) {
        const mine = msg.message_receipts.find((r) => r.user_id === currentUserId);
        if (!mine) continue;

        const updates: { delivered_at?: string; read_at?: string } = {};
        if (opts.delivered && !mine.delivered_at) updates.delivered_at = now;
        if (opts.read && !mine.read_at) updates.read_at = now;
        if (Object.keys(updates).length === 0) continue;

        const { error } = await supabase
          .from('message_receipts')
          .update(updates)
          .eq('message_id', msg.id)
          .eq('user_id', currentUserId);

        if (!error) {
          patchReceipt(msg.id, currentUserId, updates);
        }
      }
    },
    [currentUserId, patchReceipt]
  );

  useEffect(() => {
    if (!loading && currentUserId) {
      markInboundReceipts({ delivered: true, read: true });
    }
  }, [loading, currentUserId, visibleMessages.length, markInboundReceipts]);

  useEffect(() => {
    if (!loading && visibleMessages.length > 0) {
      scrollToLatest(false);
    }
  }, [loading, visibleMessages.length, scrollToLatest]);

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });
  }, []);

  useEffect(() => {
    if (visibleMessages.length > 0) {
      scrollToLatest(true);
    }
  }, [visibleMessages[visibleMessages.length - 1]?.id, scrollToLatest]);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    let msgChannel: ReturnType<typeof supabase.channel> | null = null;
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setCurrentUserId(userId);

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('user_id_1, user_id_2')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        Alert.alert('Error', 'Could not load conversation.');
        setLoading(false);
        return;
      }

      const peer =
        match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;
      setOtherUserId(peer);

      const { data: peerProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', peer)
        .single();

      if (peerProfile) {
        setOtherUserName(peerProfile.full_name ?? params.otherName ?? 'Contact');
        setOtherAvatarUrl(peerProfile.avatar_url ?? null);
      } else if (params.otherName) {
        setOtherUserName(params.otherName);
      }

      const { data: hiddenRows } = await supabase
        .from('message_hidden')
        .select('message_id')
        .eq('user_id', userId);

      if (hiddenRows) {
        setHiddenIds(new Set(hiddenRows.map((h) => h.message_id)));
      }

      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_SELECT)
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error) {
        const missingTable =
          error.code === 'PGRST205' ||
          /could not find the table.*messages/i.test(error.message ?? '');
        const missingExtras = /message_receipts|message_reactions|message_type|media_url|schema cache/i.test(
          error.message ?? ''
        );
        Alert.alert(
          missingTable || missingExtras ? 'Chat not set up yet' : 'Error loading messages',
          missingTable
            ? 'Run supabase/messages.sql in the Supabase SQL Editor, then try again.'
            : missingExtras
              ? 'Run messages_chat_features.sql and messages_media.sql in Supabase, then try again.'
              : error.message
        );
        setLoading(false);
        return;
      }

      setMessages((data ?? []).map((row) => normalizeMessage(row as Record<string, unknown>)));
      setLoading(false);

      msgChannel = supabase
        .channel(`messages:${matchId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          async (payload) => {
            const { data: full } = await supabase
              .from('messages')
              .select(MESSAGE_SELECT)
              .eq('id', payload.new.id)
              .single();
            if (full) {
              upsertMessage(normalizeMessage(full as Record<string, unknown>));
            }
            if (payload.new.sender_id !== userId) {
              markInboundReceipts({ delivered: true, read: true });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          async (payload) => {
            const { data: full } = await supabase
              .from('messages')
              .select(MESSAGE_SELECT)
              .eq('id', payload.new.id)
              .single();
            if (full) upsertMessage(normalizeMessage(full as Record<string, unknown>));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'message_receipts' },
          (payload) => {
            const row = payload.new as {
              message_id: string;
              user_id: string;
              delivered_at: string | null;
              read_at: string | null;
            };
            patchReceipt(row.message_id, row.user_id, {
              delivered_at: row.delivered_at ?? undefined,
              read_at: row.read_at ?? undefined,
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'message_reactions' },
          async (payload) => {
            const messageId =
              (payload.new as { message_id?: string })?.message_id ??
              (payload.old as { message_id?: string })?.message_id;
            if (!messageId) return;
            const { data: full } = await supabase
              .from('messages')
              .select(MESSAGE_SELECT)
              .eq('id', messageId)
              .single();
            if (full) upsertMessage(normalizeMessage(full as Record<string, unknown>));
          }
        )
        .subscribe();

      presenceChannel = supabase.channel(`match_presence:${matchId}`, {
        config: { presence: { key: userId } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel!.presenceState();
          const online = Object.values(state).some((entries) =>
            (entries as { user_id?: string }[]).some((e) => e.user_id === peer)
          );
          setOtherUserOnline(online);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel!.track({ user_id: userId, online: true });
          }
        });
    }

    init();

    return () => {
      cancelled = true;
      if (msgChannel) supabase.removeChannel(msgChannel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, [matchId, upsertMessage, patchReceipt, markInboundReceipts]);

  async function insertChatMessage(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select(MESSAGE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      upsertMessage(normalizeMessage(data as Record<string, unknown>));
      scrollToLatest(true);
    }
  }

  async function sendMediaMessage(params: {
    type: ChatMessageType;
    localUri: string;
    fileName: string;
    mimeType: string;
    durationSec?: number | null;
  }) {
    if (!matchId || !currentUserId || uploadingMedia) return;

    setUploadingMedia(true);
    try {
      const mediaUrl = await uploadChatFile({
        matchId,
        userId: currentUserId,
        localUri: params.localUri,
        fileName: params.fileName,
        mimeType: params.mimeType,
      });

      await insertChatMessage({
        match_id: matchId,
        sender_id: currentUserId,
        content: defaultContentForType(params.type, params.fileName),
        message_type: params.type,
        media_url: mediaUrl,
        media_name: params.fileName,
        media_mime: params.mimeType,
        media_duration_sec: params.durationSec ?? null,
        reply_to_id: replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send file';
      Alert.alert('Upload failed', message);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || !matchId || !currentUserId || sending) return;

    setSending(true);
    const replyId = replyTo?.id ?? null;
    setDraft('');
    setReplyTo(null);

    try {
      await insertChatMessage({
        match_id: matchId,
        sender_id: currentUserId,
        content,
        message_type: 'text',
        reply_to_id: replyId,
      });
    } catch (error) {
      setDraft(content);
      Alert.alert(
        'Could not send message',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSending(false);
    }
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to send media.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 120,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';

    await sendMediaMessage({
      type: isVideo ? 'video' : 'image',
      localUri: asset.uri,
      fileName: asset.fileName ?? (isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
      mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      durationSec: asset.duration != null ? Math.round(asset.duration / 1000) : null,
    });
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await sendMediaMessage({
      type: 'document',
      localUri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    });
  }

  async function handleMicPressOut(pageX?: number) {
    const result = await holdVoice.finishHold(pageX);
    if (!result) return;

    await sendMediaMessage({
      type: 'audio',
      localUri: result.uri,
      fileName: `voice_${Date.now()}.m4a`,
      mimeType: 'audio/mp4',
      durationSec: result.durationSec,
    });
  }

  async function handleReact(messageId: string, emoji: string) {
    if (!currentUserId) return;
    const existing = messages
      .find((m) => m.id === messageId)
      ?.message_reactions.find((r) => r.user_id === currentUserId);

    if (existing?.emoji === emoji) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId);
    } else {
      await supabase.from('message_reactions').upsert({
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      });
    }
  }

  async function handleDeleteForMe(messageId: string) {
    if (!currentUserId) return;
    const { error } = await supabase.from('message_hidden').insert({
      message_id: messageId,
      user_id: currentUserId,
    });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setHiddenIds((prev) => new Set(prev).add(messageId));
  }

  async function handleDeleteForEveryone(messageId: string) {
    const { error } = await supabase
      .from('messages')
      .update({
        deleted_for_everyone_at: new Date().toISOString(),
        content: DELETED_EVERYONE_LABEL,
      })
      .eq('id', messageId)
      .eq('sender_id', currentUserId!);

    if (error) Alert.alert('Error', error.message);
  }

  function startEdit(message: ChatMessage) {
    setEditTarget(message);
    setEditDraft(message.content);
  }

  async function saveEdit() {
    if (!editTarget || !currentUserId) return;
    const content = editDraft.trim();
    if (!content) {
      Alert.alert('Message cannot be empty');
      return;
    }

    const { error } = await supabase
      .from('messages')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', editTarget.id)
      .eq('sender_id', currentUserId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setEditTarget(null);
    setEditDraft('');
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isOwn = item.sender_id === currentUserId;
    const replySource = item.reply_to_id ? messageById.get(item.reply_to_id) : null;
    let replyPreview: string | null = null;
    if (replySource) {
      replyPreview = getMessagePreview(replySource);
    }

    return (
      <ChatMessageRow
        item={item}
        isOwn={isOwn}
        theme={theme}
        otherUserId={otherUserId}
        peerOnline={otherUserOnline}
        replyPreview={replyPreview}
        onReply={(msg) => {
          setReplyTo(msg);
          setMessageContext(null);
        }}
        onLongPress={(msg, own) => setMessageContext({ message: msg, isOwn: own })}
        onReactTap={handleReact}
      />
    );
  }

  const displayName = otherUserName?.trim() || 'Contact';

  if (!matchId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing chat. Go back and open a session again.</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ChatVoicePlaybackProvider>
    <GestureHandlerRootView style={styles.flex}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/sessions'))}
            style={styles.headerBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </Pressable>

          <ChatAvatar name={displayName} avatarUrl={otherAvatarUrl} size={40} theme={theme} />

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text
              style={[styles.headerStatus, otherUserOnline && { color: theme.success }]}
              numberOfLines={1}
            >
              {otherUserOnline ? 'online' : 'offline'}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          style={styles.list}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.listContent,
            visibleMessages.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (visibleMessages.length > 0) scrollToLatest(false);
          }}
          onScrollBeginDrag={() => setMessageContext(null)}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        {replyTo ? (
          <View style={styles.replyPreviewBar}>
            <View style={styles.replyAccentBar} />
            <View style={styles.replyPreviewTextWrap}>
              <Text style={styles.replyPreviewLabel}>{displayName}</Text>
              <Text numberOfLines={1} style={styles.replyPreviewBody}>
                {getMessagePreview(replyTo)}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}
          onTouchMove={(e) => {
            if (holdVoice.isHolding) {
              holdVoice.onMicTouchMove(e.nativeEvent.pageX);
            }
          }}
        >
          <Pressable
            style={styles.attachBtn}
            onPress={() => setAttachSheetVisible(true)}
            disabled={uploadingMedia || holdVoice.isRecording}
          >
            <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
          </Pressable>
          <View style={styles.inputPill}>
            {holdVoice.isRecording ? (
              <ChatVoiceRecordingBar
                theme={theme}
                durationMillis={holdVoice.durationMillis}
                slideCancel={holdVoice.slideCancel}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={2000}
              />
            )}
          </View>
          {!draft.trim() ? (
            <Pressable
              style={[
                styles.micFab,
                holdVoice.isRecording && styles.micFabActive,
                holdVoice.slideCancel && styles.micFabCancel,
                uploadingMedia && styles.sendFabMuted,
              ]}
              disabled={uploadingMedia || sending}
              hitSlop={{ top: 0, bottom: 6, left: 6, right: 6 }}
              pressRetentionOffset={{ left: 220, top: 0, bottom: 24, right: 16 }}
              onPressIn={(e) => {
                void holdVoice.onMicPressIn(e.nativeEvent.pageX);
              }}
              onTouchMove={(e) => {
                holdVoice.onMicTouchMove(e.nativeEvent.pageX);
              }}
              onPressOut={(e) => {
                holdVoice.onMicTouchMove(e.nativeEvent.pageX);
                void handleMicPressOut(e.nativeEvent.pageX);
              }}
            >
              <Ionicons
                name="mic"
                size={22}
                color={
                  holdVoice.slideCancel ? theme.error : theme.primaryForeground
                }
              />
            </Pressable>
          ) : null}
          {draft.trim() ? (
            <Pressable
              style={[styles.sendFab, uploadingMedia && styles.sendFabMuted]}
              onPress={handleSend}
              disabled={uploadingMedia || sending}
            >
              {sending || uploadingMedia ? (
                <ActivityIndicator color={theme.primaryForeground} size="small" />
              ) : (
                <Ionicons name="send" size={20} color={theme.primaryForeground} />
              )}
            </Pressable>
          ) : null}
        </View>

        <ChatAttachSheet
          visible={attachSheetVisible}
          onClose={() => setAttachSheetVisible(false)}
          onPickGallery={pickFromGallery}
          onPickDocument={pickDocument}
        />

        <WhatsAppMessageContext
          context={messageContext}
          onClose={() => setMessageContext(null)}
          onReact={(emoji) => {
            if (messageContext) handleReact(messageContext.message.id, emoji);
          }}
          onReply={() => {
            if (messageContext) setReplyTo(messageContext.message);
          }}
          onEdit={() => {
            if (messageContext) startEdit(messageContext.message);
          }}
          onDeleteForMe={() => {
            if (messageContext) handleDeleteForMe(messageContext.message.id);
          }}
          onDeleteForEveryone={() => {
            if (messageContext) handleDeleteForEveryone(messageContext.message.id);
          }}
        />

        <Modal visible={editTarget !== null} transparent animationType="fade">
          <View style={styles.editOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setEditTarget(null);
                setEditDraft('');
              }}
            />
            <View style={styles.editSheet}>
              <Text style={styles.editTitle}>Edit message</Text>
              <TextInput
                style={styles.editInput}
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <Pressable
                  style={styles.editCancel}
                  onPress={() => {
                    setEditTarget(null);
                    setEditDraft('');
                  }}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.editSave} onPress={saveEdit}>
                  <Text style={styles.editSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
    </ChatVoicePlaybackProvider>
  );
}

function createStyles(theme: AppThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Layout.screenPadding,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 12,
    },
    headerBack: {
      padding: 4,
      marginLeft: -4,
    },
    headerTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    headerName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    headerStatus: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    list: {
      flex: 1,
      backgroundColor: theme.background,
      zIndex: 1,
    },
    listContent: {
      paddingHorizontal: Layout.screenPadding,
      paddingVertical: 12,
      flexGrow: 1,
    },
    listContentEmpty: {
      justifyContent: 'center',
    },
    emptyWrap: {},
    emptyText: {
      textAlign: 'center',
      color: theme.textMuted,
      fontSize: 15,
    },
    replyPreviewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Layout.screenPadding,
      paddingVertical: 10,
      backgroundColor: theme.surfaceMuted,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    replyAccentBar: {
      width: 4,
      alignSelf: 'stretch',
      backgroundColor: theme.primary,
      borderRadius: 2,
    },
    replyPreviewTextWrap: { flex: 1 },
    replyPreviewLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
    },
    replyPreviewBody: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: Layout.screenPadding,
      paddingTop: 10,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      overflow: 'hidden',
      zIndex: 2,
    },
    attachBtn: {
      paddingBottom: 8,
    },
    inputPill: {
      flex: 1,
      backgroundColor: theme.inputBackground,
      borderRadius: Layout.radiusLg,
      paddingHorizontal: 14,
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    input: {
      maxHeight: 120,
      fontSize: 16,
      color: theme.text,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    sendFab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micFab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micFabActive: {
      backgroundColor: theme.error,
    },
    micFabCancel: {
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.error,
    },
    sendFabMuted: {
      opacity: 0.5,
    },
    errorText: {
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    backLink: { padding: 12 },
    backLinkText: { color: theme.primary, fontWeight: '600' },
    editOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    editSheet: {
      backgroundColor: theme.surface,
      borderRadius: Layout.radiusMd,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    editTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
    },
    editInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Layout.radiusSm,
      padding: 12,
      minHeight: 80,
      color: theme.text,
      backgroundColor: theme.inputBackground,
      textAlignVertical: 'top',
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 16,
    },
    editCancel: { padding: 12 },
    editCancelText: { color: theme.textSecondary, fontWeight: '600' },
    editSave: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: Layout.radiusSm,
    },
    editSaveText: { color: theme.primaryForeground, fontWeight: '700' },
  });
}
