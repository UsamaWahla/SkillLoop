export type MessageReceipt = {
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

export type MessageReaction = {
  user_id: string;
  emoji: string;
};

export type ChatMessageType = 'text' | 'image' | 'video' | 'document' | 'audio';

export type ChatMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  message_type: ChatMessageType;
  media_url: string | null;
  media_name: string | null;
  media_mime: string | null;
  media_duration_sec: number | null;
  created_at: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_for_everyone_at: string | null;
  message_receipts: MessageReceipt[];
  message_reactions: MessageReaction[];
};

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const DELETED_EVERYONE_LABEL = 'This message was deleted';
