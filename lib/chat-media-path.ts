const PUBLIC_CHAT_MEDIA_MARKER = '/object/public/chat-media/';

/** Path inside the chat-media bucket, from a stored public URL. */
export function chatMediaObjectPath(mediaUrl: string): string | null {
  const markerAt = mediaUrl.indexOf(PUBLIC_CHAT_MEDIA_MARKER);
  if (markerAt === -1) return null;

  const withQuery = mediaUrl.slice(markerAt + PUBLIC_CHAT_MEDIA_MARKER.length);
  const path = withQuery.split('?')[0];
  return path ? decodeURIComponent(path) : null;
}
