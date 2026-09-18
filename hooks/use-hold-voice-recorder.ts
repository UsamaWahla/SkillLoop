import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { AudioRecorder } from 'expo-audio/build/AudioModule.types'; // expo-audio recorder instance
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { isSlideCancel, shouldDiscardVoiceHold } from '@/lib/chat-voice-hold';

function safeGetRecorderStatus(recorder: AudioRecorder) {
  try {
    return recorder.getStatus();
  } catch {
    return null;
  }
}

async function safeStopRecorder(recorder: AudioRecorder) {
  try {
    await recorder.stop();
    return true;
  } catch {
    return false;
  }
}

type RecorderState = {
  isRecording: boolean;
  durationMillis: number;
};

type UseHoldVoiceRecorderOptions = {
  recorder: AudioRecorder;
  recorderState: RecorderState;
  ensurePrepared: () => Promise<void>;
  disabled?: boolean;
};

export function useHoldVoiceRecorder({
  recorder,
  recorderState,
  ensurePrepared,
  disabled,
}: UseHoldVoiceRecorderOptions) {
  const [isHolding, setIsHolding] = useState(false);
  const [slideCancel, setSlideCancel] = useState(false);
  const pressStartMs = useRef(0);
  const touchStartX = useRef(0);
  const holdingRef = useRef(false);
  const cancelRef = useRef(false);
  const permissionChecked = useRef(false);
  const startGeneration = useRef(0);
  /** True while native `record()` session is active (avoids getStatus after release). */
  const nativeRecordingRef = useRef(false);

  const resetGestureState = useCallback(() => {
    holdingRef.current = false;
    cancelRef.current = false;
    setIsHolding(false);
    setSlideCancel(false);
  }, []);

  const discardRecording = useCallback(async () => {
    if (nativeRecordingRef.current) {
      await safeStopRecorder(recorder);
      nativeRecordingRef.current = false;
    }
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });
    resetGestureState();
  }, [recorder, resetGestureState]);

  const beginRecording = useCallback(async () => {
    if (disabled) return false;

    if (!permissionChecked.current) {
      const { granted } = await requestRecordingPermissionsAsync();
      permissionChecked.current = true;
      if (!granted) {
        Alert.alert(
          'Microphone',
          'Allow microphone access to send voice messages. You can enable it in Settings.'
        );
        return false;
      }
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
      await ensurePrepared();
      recorder.record();
      nativeRecordingRef.current = true;
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not start recording.';
      Alert.alert('Recording', message);
      return false;
    }
  }, [disabled, ensurePrepared, recorder]);

  const onMicPressIn = useCallback(
    async (pageX: number) => {
      if (holdingRef.current || disabled) return;

      const generation = ++startGeneration.current;
      pressStartMs.current = Date.now();
      touchStartX.current = pageX;
      cancelRef.current = false;
      setSlideCancel(false);
      holdingRef.current = true;
      setIsHolding(true);

      const started = await beginRecording();
      if (generation !== startGeneration.current || !holdingRef.current) {
        if (started && nativeRecordingRef.current) {
          await discardRecording();
        }
        return;
      }

      if (!started) {
        resetGestureState();
      }
    },
    [beginRecording, disabled, discardRecording, recorder, resetGestureState]
  );

  const onMicTouchMove = useCallback((pageX: number) => {
    if (!holdingRef.current) return;
    const cancel = isSlideCancel(touchStartX.current, pageX);
    cancelRef.current = cancel;
    setSlideCancel(cancel);
  }, []);

  const finishHold = useCallback(async (pageX?: number): Promise<{
    uri: string;
    durationSec: number;
  } | null> => {
    if (!holdingRef.current) return null;

    if (typeof pageX === 'number') {
      const cancel = isSlideCancel(touchStartX.current, pageX);
      cancelRef.current = cancel;
      setSlideCancel(cancel);
    }

    startGeneration.current += 1;
    const heldMs = Date.now() - pressStartMs.current;
    const wasRecording = nativeRecordingRef.current;
    const shouldDiscard = shouldDiscardVoiceHold({
      cancelled: cancelRef.current,
      heldMs,
      wasRecording,
    });

    holdingRef.current = false;
    setIsHolding(false);
    setSlideCancel(false);

    if (wasRecording) {
      const stopped = await safeStopRecorder(recorder);
      nativeRecordingRef.current = false;
      if (!stopped) {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });
        return null;
      }
    }

    if (shouldDiscard) {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
      return null;
    }

    const uriDeadline = Date.now() + 3000;
    let uri = '';
    while (Date.now() < uriDeadline && !uri) {
      const status = safeGetRecorderStatus(recorder);
      try {
        uri = recorder.uri || status?.url || '';
      } catch {
        uri = status?.url || '';
      }
      if (!uri) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }
    const status = safeGetRecorderStatus(recorder);
    const durationSec = Math.max(
      1,
      Math.round(
        status && status.durationMillis > 0
          ? status.durationMillis / 1000
          : recorderState.durationMillis / 1000
      )
    );

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });

    if (!uri) {
      Alert.alert('Recording failed', 'No audio file was created.');
      return null;
    }

    return { uri, durationSec };
  }, [recorder, recorderState.durationMillis]);

  return {
    isHolding,
    slideCancel,
    durationMillis: recorderState.durationMillis,
    isRecording: isHolding && recorderState.isRecording,
    onMicPressIn,
    onMicTouchMove,
    finishHold,
    discardRecording,
  };
}
