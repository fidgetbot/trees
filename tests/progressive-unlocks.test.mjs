import assert from 'node:assert/strict';
import test from 'node:test';

import { LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS } from '../core/constants.js';
import { getActionUnlockReason, isActionUnlockedForState } from '../core/actions.js';

const sapling = LIFE_STAGES.find(stage => stage.name === 'Sapling');

function unlocked(key, turnsInStage) {
  return isActionUnlockedForState(key, { lifeStage: sapling, turnsInStage }, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS);
}

test('Sapling capabilities arrive across three seasons instead of all at once', () => {
  assert.equal(unlocked('growBranch', 0), true);
  assert.equal(unlocked('taproot', 0), false);
  assert.equal(unlocked('taproot', 1), true);
  assert.equal(unlocked('canopy', 2), false);
  assert.equal(unlocked('canopy', 3), true);
  assert.equal(unlocked('aidAlly', 5), false);
  assert.equal(unlocked('aidAlly', 6), true);
  assert.equal(unlocked('shadeRival', 8), false);
  assert.equal(unlocked('shadeRival', 9), true);
});

test('locked Sapling actions explain when they will awaken', () => {
  const state = { lifeStage: sapling, turnsInStage: 0 };
  assert.equal(
    getActionUnlockReason('canopy', state, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS),
    'Awakens after 1 season as a Sapling',
  );
});
