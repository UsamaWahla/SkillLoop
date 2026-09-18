import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MIN_HOLD_MS,
  SLIDE_CANCEL_PX,
  isSlideCancel,
  shouldDiscardVoiceHold,
} from './chat-voice-hold.ts';

describe('isSlideCancel', () => {
  it('does not cancel when the finger stays on the mic', () => {
    assert.equal(isSlideCancel(300, 300), false);
  });

  it('does not cancel a small left slide under the threshold', () => {
    assert.equal(isSlideCancel(300, 300 - (SLIDE_CANCEL_PX - 1)), false);
  });

  it('cancels once the finger slides left past the threshold', () => {
    assert.equal(isSlideCancel(300, 300 - SLIDE_CANCEL_PX), true);
    assert.equal(isSlideCancel(300, 200), true);
  });

  it('does not cancel a slide to the right', () => {
    assert.equal(isSlideCancel(300, 400), false);
  });
});

describe('shouldDiscardVoiceHold', () => {
  it('discards when slide-to-cancel is armed even after a long hold', () => {
    assert.equal(
      shouldDiscardVoiceHold({
        cancelled: true,
        heldMs: MIN_HOLD_MS + 800,
        wasRecording: true,
      }),
      true
    );
  });

  it('sends after a long hold that was not cancelled', () => {
    assert.equal(
      shouldDiscardVoiceHold({
        cancelled: false,
        heldMs: MIN_HOLD_MS + 800,
        wasRecording: true,
      }),
      false
    );
  });

  it('discards a tap shorter than the minimum hold', () => {
    assert.equal(
      shouldDiscardVoiceHold({
        cancelled: false,
        heldMs: MIN_HOLD_MS - 1,
        wasRecording: true,
      }),
      true
    );
  });
});
