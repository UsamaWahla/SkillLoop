import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickMatchedSkillWanted } from './chat-match.ts';

describe('pickMatchedSkillWanted', () => {
  it('prefers the first offered skill the current user wants', () => {
    const id = pickMatchedSkillWanted(
      [{ skill_id: 'a' }, { skill_id: 'b' }, { skill_id: 'c' }],
      ['x', 'b']
    );
    assert.equal(id, 'b');
  });

  it('falls back to the first offered skill when none overlap', () => {
    assert.equal(
      pickMatchedSkillWanted([{ skill_id: 'a' }, { skill_id: 'b' }], ['z']),
      'a'
    );
  });

  it('returns undefined when the card has no offered skills', () => {
    assert.equal(pickMatchedSkillWanted([], ['a']), undefined);
  });
});
