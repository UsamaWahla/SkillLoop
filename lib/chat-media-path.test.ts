import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chatMediaObjectPath } from './chat-media-path.ts';

describe('chatMediaObjectPath', () => {
  it('extracts the storage object path from a public chat-media URL', () => {
    const url =
      'https://abc.supabase.co/storage/v1/object/public/chat-media/match-1/user-2/voice_1.m4a?t=99';
    assert.equal(chatMediaObjectPath(url), 'match-1/user-2/voice_1.m4a');
  });

  it('returns null for a non-storage URL', () => {
    assert.equal(chatMediaObjectPath('file:///tmp/voice.m4a'), null);
  });
});
