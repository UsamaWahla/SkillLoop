import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import { getPlayableChatMediaUrl } from '@/lib/chat-media';

type ChatVoicePlaybackContextValue = {
  activeMessageId: string | null;
  toggleMessagePlayback: (messageId: string, audioUrl: string) => Promise<void>;
  isMessagePlaying: (messageId: string) => boolean;
  activeCurrentTime: number;
  activeDuration: number;
};

const ChatVoicePlaybackContext = createContext<ChatVoicePlaybackContextValue | null>(
  null
);

export function ChatVoicePlaybackProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { downloadFirst: false, updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);

  const toggleMessagePlayback = useCallback(
    async (messageId: string, audioUrl: string) => {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });

      const isSame = activeMessageIdRef.current === messageId;

      if (isSame && status.playing) {
        pendingPlayRef.current = false;
        player.pause();
        return;
      }

      if (isSame && (status.isLoaded || player.isLoaded)) {
        player.play();
        return;
      }

      const playUrl = await getPlayableChatMediaUrl(audioUrl);
      player.replace({ uri: playUrl });
      activeMessageIdRef.current = messageId;
      setActiveMessageId(messageId);
      pendingPlayRef.current = true;
      player.play();
    },
    [player, status.playing, status.isLoaded]
  );

  useEffect(() => {
    if (pendingPlayRef.current && (status.isLoaded || status.playing)) {
      pendingPlayRef.current = false;
      if (!status.playing) player.play();
    }
  }, [player, status.isLoaded, status.playing]);

  useEffect(() => {
    if (status.didJustFinish) {
      pendingPlayRef.current = false;
      activeMessageIdRef.current = null;
      setActiveMessageId(null);
    }
  }, [status.didJustFinish]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* player may already be released */
      }
    };
  }, [player]);

  const value = useMemo<ChatVoicePlaybackContextValue>(
    () => ({
      activeMessageId,
      toggleMessagePlayback,
      isMessagePlaying: (messageId: string) =>
        activeMessageId === messageId && status.playing,
      activeCurrentTime: status.currentTime,
      activeDuration: status.duration,
    }),
    [
      activeMessageId,
      toggleMessagePlayback,
      status.playing,
      status.currentTime,
      status.duration,
    ]
  );

  return (
    <ChatVoicePlaybackContext.Provider value={value}>
      {children}
    </ChatVoicePlaybackContext.Provider>
  );
}

export function useChatVoicePlayback() {
  const ctx = useContext(ChatVoicePlaybackContext);
  if (!ctx) {
    throw new Error('useChatVoicePlayback must be used within ChatVoicePlaybackProvider');
  }
  return ctx;
}
