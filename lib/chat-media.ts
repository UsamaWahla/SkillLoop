import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { ChatMessageType } from '@/lib/chat-types';
import { chatMediaObjectPath } from '@/lib/chat-media-path';
import { assertRecordedAudioBytes } from '@/lib/chat-audio-bytes';

export { chatMediaObjectPath };

async function readLocalFileBytes(localUri: string): Promise<ArrayBuffer> {
  if (localUri.startsWith('file:')) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists && !info.isDirectory && (info.size ?? 0) >= 256) {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return decode(base64);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Recording file is empty or incomplete.');
  }

  const response = await fetch(localUri);
  return response.arrayBuffer();
}

/** Same stored public URL, but a signed link so expo-audio can fetch it with access. */
export async function getPlayableChatMediaUrl(mediaUrl: string): Promise<string> {
  const path = chatMediaObjectPath(mediaUrl);
  if (!path) return mediaUrl;

  const { data, error } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) return mediaUrl;
  return data.signedUrl;
}

/** Voice and other chat files use `messages.media_url` (same role as a dedicated `audio_url`). */
export async function uploadChatFile(params: {
  matchId: string;
  userId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
}): Promise<string> {
  const { matchId, userId, localUri, fileName, mimeType } = params;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${matchId}/${userId}/${Date.now()}_${safeName}`;

  const arrayBuffer = await readLocalFileBytes(localUri);
  if (mimeType.startsWith('audio/')) {
    assertRecordedAudioBytes(new Uint8Array(arrayBuffer));
  }

  const { error } = await supabase.storage.from('chat-media').upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function defaultContentForType(
  type: ChatMessageType,
  fileName?: string | null
): string {
  switch (type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Voice message';
    case 'document':
      return fileName ?? 'Document';
    default:
      return fileName ?? 'Message';
  }
}

export function getMessagePreview(message: {
  message_type?: ChatMessageType;
  content: string;
  media_name?: string | null;
  deleted_for_everyone_at?: string | null;
}): string {
  if (message.deleted_for_everyone_at) {
    return 'This message was deleted';
  }
  if (message.message_type && message.message_type !== 'text') {
    return defaultContentForType(message.message_type, message.media_name);
  }
  return message.content;
}
