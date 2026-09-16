import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTION_UNLOCK_EXPLANATIONS, getActionUnlockExplanation } from '../core/actions.js';
import { LIFE_STAGES } from '../core/constants.js';

test('every real stage unlock has a complete player-facing explanation', () => {
  const actionKeys = LIFE_STAGES.flatMap(stage => stage.unlocks)
    .filter(key => key !== 'defense');

  actionKeys.forEach(key => {
    const explanation = ACTION_UNLOCK_EXPLANATIONS[key];
    assert.ok(explanation, `missing explanation for ${key}`);
    assert.match(explanation, /^This lets you /);
    assert.match(explanation, /\.$/);
  });
});

test('unlock explanation fallback remains a complete sentence', () => {
  assert.equal(
    getActionUnlockExplanation({ key: 'futureAction', help: 'Improves something useful.' }),
    'This gives you a new ability: improves something useful.',
  );
});
