import assert from 'node:assert/strict';
import test from 'node:test';

import { LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS } from '../core/constants.js';
import { getActionUnlockReason, isActionUnlockedForState } from '../core/actions.js';

const sapling = LIFE_STAGES.find(stage => stage.name === 'Sapling');
const smallTree = LIFE_STAGES.find(stage => stage.name === 'Small Tree');
const matureTree = LIFE_STAGES.find(stage => stage.name === 'Mature Tree');

function unlocked(key, turnsInStage, lifeStage = sapling) {
  return isActionUnlockedForState(key, { lifeStage, turnsInStage }, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS);
}

test('Sapling capabilities arrive across five seasons instead of all at once', () => {
  assert.equal(unlocked('growBranch', 0), true);
  assert.equal(unlocked('taproot', 0), false);
  assert.equal(unlocked('taproot', 1), true);
  assert.equal(unlocked('canopy', 2), false);
  assert.equal(unlocked('canopy', 3), true);
  assert.equal(unlocked('aidAlly', 5), false);
  assert.equal(unlocked('aidAlly', 6), true);
  assert.equal(unlocked('rhizosphere', 14), false);
  assert.equal(unlocked('rhizosphere', 15), true);
});

test('Small Tree and Mature Tree action bundles are dispersed across seasons', () => {
  assert.equal(unlocked('flower', 0, smallTree), true);
  assert.equal(unlocked('growThorns', 0, smallTree), false);
  assert.equal(unlocked('growThorns', 3, smallTree), true);
  assert.equal(unlocked('toxicLeaves', 6, smallTree), true);

  assert.equal(unlocked('massFlower', 0, matureTree), true);
  assert.equal(unlocked('nurtureOffspring', 0, matureTree), false);
  assert.equal(unlocked('nurtureOffspring', 3, matureTree), true);
  assert.equal(unlocked('shelterGrove', 6, matureTree), true);
  assert.equal(unlocked('rootDominion', 9, matureTree), true);
});

test('locked Sapling actions explain when they will awaken', () => {
  const state = { lifeStage: sapling, turnsInStage: 0 };
  assert.equal(
    getActionUnlockReason('canopy', state, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS),
    'Awakens after 1 season as a Sapling',
  );
});

test('Grow Taller, Shade Neighbor, and Fortify Bark arrive gradually during Seedling growth', () => {
  const seedling = LIFE_STAGES.find(stage => stage.name === 'Seedling');
  assert.equal(unlocked('growTaller', 5, seedling), false);
  assert.equal(unlocked('growTaller', 6, seedling), true);
  assert.equal(unlocked('shadeRival', 5, seedling), false);
  assert.equal(unlocked('shadeRival', 6, seedling), true);
  assert.equal(unlocked('bark', 8, seedling), false);
  assert.equal(unlocked('bark', 9, seedling), true);
});
