import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertRecordedAudioBytes } from './chat-audio-bytes.ts';

describe('assertRecordedAudioBytes', () => {
  it('rejects the fetch error body that was being uploaded as audio', () => {
    const bytes = new TextEncoder().encode('File not found');
    assert.throws(() => assertRecordedAudioBytes(bytes), /could not be read/i);
  });

  it('rejects a tiny buffer that cannot be an m4a recording', () => {
    assert.throws(() => assertRecordedAudioBytes(new Uint8Array([0, 1, 2])), /empty or incomplete/i);
  });

  it('accepts a buffer that looks like an m4a ftyp box', () => {
    const bytes = new Uint8Array(512);
    bytes.set([0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70], 0); // ....ftyp
    assert.doesNotThrow(() => assertRecordedAudioBytes(bytes));
  });
});
