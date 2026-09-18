# Chats tab and Home-first messaging

Date: 2026-09-18  
Status: draft for user review  
App: SkillLoop (Expo Router)

## Goal

Give chat a first-class home in the bottom tabs. Sessions stay about scheduling. The first conversation starts from Home. Existing threads open from a professional inbox, not a Message button on a session card.

## Out of scope

- Rewriting the conversation screen (`app/chat.tsx`): text, voice, media, receipts, and reactions stay as they are.
- Group chats, search, mute, or archive.
- Push notifications.
- Changing how session request / accept / complete works, except removing Message from that screen.

## Current state

- Tabs: Home, Sessions, Profile.
- Chat is a root stack screen (`app/chat.tsx`) opened only from Sessions via a **Message** button and `matchId` / `otherName` params.
- A `matches` row is created in `app/request-session.tsx` when a session is requested (lookup by the two user ids; insert if missing).
- Unread state already exists: `message_receipts.read_at` is set when the recipient has the thread open.

## Navigation

Tab order:

1. Home (unchanged discover)
2. **Chats** (new)
3. Sessions
4. Profile

Add `app/(tabs)/chats.tsx` and register it in `app/(tabs)/_layout.tsx`.

Tab icon: add an `IconSymbol` mapping, e.g. SF Symbol `bubble.left.and.bubble.right.fill` → Material `chat`. Label: **Chats**.

Keep `app/chat.tsx` on the root stack (no tab bar in the thread). Opening a row from Chats or Chat on Home uses:

```
router.push({ pathname: '/chat', params: { matchId, otherName } })
```

Back from a thread returns to whichever tab opened it.

## Chats inbox

WhatsApp-style list of **existing conversations only** (a match appears only if it has at least one message the current user can see).

Each row:

- Avatar (`ChatAvatar`, existing)
- Other person’s `full_name` (fallback: “Skill partner”)
- Last message preview via existing `getMessagePreview` (text, Photo, Voice message, deleted label, etc.)
- Relative time of that last message
- Unread count: inbound messages in that match where the current user’s `message_receipts.read_at` is null
- Unread name/preview in semibold; unread badge on the right

Sort: last message `created_at` descending.

Empty state (centered, muted copy):

> No chats yet. Open someone’s profile on Home and tap Chat to start a conversation.

Pull to refresh. Reload the list when the tab gains focus (`useFocusEffect`) so a just-sent first message appears after returning from `/chat`.

Tapping a row opens `/chat` with that `matchId` and `otherName`.

Realtime on the inbox is not required for v1 if focus refresh is reliable. Optional later: `postgres_changes` on `messages` to bump previews while the tab is visible.

### Data loading

1. Auth user id.
2. Load `matches` where `user_id_1` or `user_id_2` is the current user.
3. Load messages for those match ids (id, match_id, sender_id, content, message_type, media_name, created_at, deleted_for_everyone_at, receipts), ordered by `created_at`.
4. In memory: drop matches with zero messages; keep the newest message per match; compute unread; resolve the other user id; load those profiles (`full_name`, `avatar_url`).
5. Hide messages the user has in `message_hidden` from preview and unread (same idea as the thread).

If this is too heavy later, replace step 3 with an RPC. v1 stays in the client using existing tables and RLS. No new SQL unless profiling shows it is needed.

## Home: start the first chat

On each discover person card in `app/(tabs)/index.tsx`, add a **Chat** control (outline button or chat-bubble icon + “Chat”, using theme primary). Place it with the existing session-request actions so the card does not grow a second loud primary CTA. Session request stays the filled primary for overlapping wanted skills; Chat is secondary.

On press:

1. Require a logged-in user (already true on this screen).
2. Find a `matches` row for `(currentUserId, otherUserId)` in either column order (copy the `.or(...)` from `request-session.tsx`).
3. If none exists, insert one:
   - `user_id_1` = current user, `user_id_2` = card user
   - `status` = `'accepted'`
   - `compatibility_score` = card `compatibilityScore` (already computed)
   - `matched_skill_wanted` = first offered skill whose `skill_id` is in `myWantedSkillIds`, else the first offered skill on the card if any; omit the column if there is no skill id
4. `router.push` `/chat` with `matchId` and `otherName` (card `full_name`).

Do not send a message automatically. The thread can be empty until the user types or records. That empty thread does **not** appear on the Chats tab until the first message exists (inbox-only rule).

Errors: Alert with the Supabase error; do not navigate.

## Sessions

Remove the Message `Pressable` and unused `messageButton` / `messageButtonText` styles from `app/(tabs)/sessions.tsx`. Do not add a replacement chat entry on that screen.

## Unchanged conversation screen

`app/chat.tsx` already:

- Loads by `matchId`
- Shows `otherName` in the header
- Handles empty threads (user can send the first message)

No behavior change required beyond receiving traffic from Home and Chats.

## Visual bar

Inbox should feel like the existing WhatsApp-inspired thread (see `constants/whatsapp-chat.ts` and chat bubbles): light row dividers, 56–64px row height, avatar 48–52px, no extra card chrome, no pagination controls (unlike Home/Sessions). Full-width list, not paged tiles.

## Error and edge cases

- Logged-out: existing root layout already redirects to login.
- Chat opened with a match but no messages: show the existing empty thread UI; sending the first message then shows the row on Chats after focus refresh.
- Deleted-for-everyone last message: preview is `getMessagePreview` (“This message was deleted”).
- Hidden last message: skip to the previous visible message for preview; if all are hidden, treat as no conversation (omit from inbox).
- Two users tap Chat on Home before either has messaged: one match row (lookup prevents duplicates).

## Success criteria

- Bottom tabs include Chats between Home and Sessions.
- Sessions has no Message button.
- Home Chat opens (or creates) a match and the existing thread screen.
- After the first message, that person appears on the Chats tab with preview, time, and unread.
- Tapping an inbox row opens the same thread with history.
- Voice/text/media chat behavior is unchanged.
