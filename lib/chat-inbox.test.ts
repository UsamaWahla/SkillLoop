import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildChatInboxRows, formatInboxTime } from './chat-inbox.ts';

const me = 'user-me';
const other = 'user-b';
const match = { id: 'm1', user_id_1: me, user_id_2: other };

function msg(partial: Partial<Parameters<typeof buildChatInboxRows>[0]['messages'][0]> & { id: string; created_at: string }) {
  return {
    match_id: 'm1',
    sender_id: other,
    content: 'hello',
    message_type: 'text' as const,
    media_name: null,
    deleted_for_everyone_at: null,
    message_receipts: [{ user_id: me, read_at: null }],
    ...partial,
  };
}

describe('buildChatInboxRows', () => {
  it('omits matches with no visible messages', () => {
    const rows = buildChatInboxRows({
      currentUserId: me,
      matches: [match],
      messages: [msg({ id: 'h1', created_at: '2026-09-18T10:00:00.000Z' })],
      hiddenIds: new Set(['h1']),
      profiles: { [other]: { full_name: 'Alex', avatar_url: null } },
    });
    assert.deepEqual(rows, []);
  });

  it('uses the newest visible message for preview and sorts newest first', () => {
    const m2 = { id: 'm2', user_id_1: other, user_id_2: me };
    const rows = buildChatInboxRows({
      currentUserId: me,
      matches: [match, m2],
      messages: [
        msg({ id: '1', created_at: '2026-09-18T10:00:00.000Z', content: 'older' }),
        msg({ id: '2', created_at: '2026-09-18T12:00:00.000Z', content: 'newer' }),
        msg({ id: '3', match_id: 'm2', created_at: '2026-09-18T11:00:00.000Z', content: 'mid' }),
      ],
      hiddenIds: new Set(),
      profiles: { [other]: { full_name: 'Alex', avatar_url: 'https://x/a.png' } },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].matchId, 'm1');
    assert.equal(rows[0].preview, 'newer');
    assert.equal(rows[0].otherName, 'Alex');
    assert.equal(rows[1].matchId, 'm2');
    assert.equal(rows[1].preview, 'mid');
  });

  it('counts unread inbound messages missing read_at', () => {
    const rows = buildChatInboxRows({
      currentUserId: me,
      matches: [match],
      messages: [
        msg({
          id: '1',
          created_at: '2026-09-18T10:00:00.000Z',
          sender_id: other,
          message_receipts: [{ user_id: me, read_at: null }],
        }),
        msg({
          id: '2',
          created_at: '2026-09-18T11:00:00.000Z',
          sender_id: me,
          content: 'mine',
          message_receipts: [{ user_id: other, read_at: null }],
        }),
      ],
      hiddenIds: new Set(),
      profiles: { [other]: { full_name: null, avatar_url: null } },
    });
    assert.equal(rows[0].unreadCount, 1);
    assert.equal(rows[0].otherName, 'Skill partner');
    assert.equal(rows[0].preview, 'mine');
  });

  it('previews voice as Voice message', () => {
    const rows = buildChatInboxRows({
      currentUserId: me,
      matches: [match],
      messages: [
        msg({
          id: '1',
          created_at: '2026-09-18T10:00:00.000Z',
          message_type: 'audio',
          content: 'Voice message',
        }),
      ],
      hiddenIds: new Set(),
      profiles: { [other]: { full_name: 'Alex', avatar_url: null } },
    });
    assert.equal(rows[0].preview, 'Voice message');
  });
});

describe('formatInboxTime', () => {
  it('returns HH:MM on the same local calendar day as now', () => {
    const now = new Date(2026, 8, 18, 14, 30, 0);
    const iso = new Date(2026, 8, 18, 9, 5, 0).toISOString();
    const expected = new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    assert.equal(formatInboxTime(iso, now.getTime()), expected);
  });

  it('returns locale date string on other calendar days', () => {
    const now = new Date(2026, 8, 18, 14, 30, 0);
    const iso = new Date(2026, 8, 17, 9, 0, 0).toISOString();
    const expected = new Date(iso).toLocaleDateString();
    assert.equal(formatInboxTime(iso, now.getTime()), expected);
  });
});
