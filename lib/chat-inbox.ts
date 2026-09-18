export type ChatInboxRow = {
  matchId: string;
  otherUserId: string;
  otherName: string;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  preview: string;
  unreadCount: number;
};

export type InboxMatch = {
  id: string;
  user_id_1: string;
  user_id_2: string;
};

export type InboxMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'document' | 'audio';
  media_name: string | null;
  created_at: string;
  deleted_for_everyone_at: string | null;
  message_receipts: { user_id: string; read_at: string | null }[];
};

export type InboxProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

function inboxPreview(message: InboxMessage): string {
  if (message.deleted_for_everyone_at) return 'This message was deleted';
  switch (message.message_type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Voice message';
    case 'document':
      return message.media_name ?? 'Document';
    default:
      return message.content;
  }
}

function isSameLocalCalendarDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatInboxTime(iso: string, nowMs: number): string {
  const at = new Date(iso).getTime();
  if (isSameLocalCalendarDay(at, nowMs)) {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return new Date(iso).toLocaleDateString();
}

function otherUserIdForMatch(match: InboxMatch, currentUserId: string): string {
  return match.user_id_1 === currentUserId ? match.user_id_2 : match.user_id_1;
}

function displayName(profiles: Record<string, InboxProfile>, userId: string): string {
  const name = profiles[userId]?.full_name?.trim();
  return name ? name : 'Skill partner';
}

function isUnreadForUser(message: InboxMessage, currentUserId: string): boolean {
  if (message.sender_id === currentUserId) return false;
  const receipt = message.message_receipts.find((r) => r.user_id === currentUserId);
  return receipt?.read_at == null;
}

export function buildChatInboxRows(input: {
  currentUserId: string;
  matches: InboxMatch[];
  messages: InboxMessage[];
  hiddenIds: Set<string>;
  profiles: Record<string, InboxProfile>;
}): ChatInboxRow[] {
  const { currentUserId, matches, messages, hiddenIds, profiles } = input;

  const visibleByMatch = new Map<string, InboxMessage[]>();
  for (const message of messages) {
    if (hiddenIds.has(message.id)) continue;
    const list = visibleByMatch.get(message.match_id) ?? [];
    list.push(message);
    visibleByMatch.set(message.match_id, list);
  }

  const rows: ChatInboxRow[] = [];

  for (const match of matches) {
    const visible = visibleByMatch.get(match.id);
    if (!visible?.length) continue;

    let lastMessage = visible[0];
    for (const message of visible) {
      if (message.created_at > lastMessage.created_at) {
        lastMessage = message;
      }
    }

    const otherUserId = otherUserIdForMatch(match, currentUserId);
    const profile = profiles[otherUserId];

    let unreadCount = 0;
    for (const message of visible) {
      if (isUnreadForUser(message, currentUserId)) unreadCount++;
    }

    rows.push({
      matchId: match.id,
      otherUserId,
      otherName: displayName(profiles, otherUserId),
      otherAvatarUrl: profile?.avatar_url ?? null,
      lastMessageAt: lastMessage.created_at,
      preview: inboxPreview(lastMessage),
      unreadCount,
    });
  }

  rows.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0));

  return rows;
}
