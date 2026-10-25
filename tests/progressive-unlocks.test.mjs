import assert from 'node:assert/strict';
import test from 'node:test';

import { HUMAN_STORY_ACTION_UNLOCKS, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS, SEASONAL_ACTIONS, TURNS_PER_SEASON } from '../core/constants.js';
import { ACTION_UNLOCK_EXPLANATIONS, getActionUnlockReason, isActionAnnounceableInSeason, isActionUnlockedForState } from '../core/actions.js';
import { claimGrowthNudge, currentStageRequirements, formatTurnProgress } from '../core/stages.js';

const sapling = LIFE_STAGES.find(stage => stage.name === 'Sapling');
const youngTree = LIFE_STAGES.find(stage => stage.name === 'Young Tree');
const matureTree = LIFE_STAGES.find(stage => stage.name === 'Mature Tree');

function unlocked(key, turnsInStage, lifeStage = sapling, humanAdaptationChapter = 20) {
  return isActionUnlockedForState(key, { lifeStage, turnsInStage, hasMadeFirstAlly: true, humanAdaptationChapter }, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS, HUMAN_STORY_ACTION_UNLOCKS);
}

test('Sapling capabilities arrive across five seasons instead of all at once', () => {
  assert.equal(unlocked('growBranch', 0), true);
  assert.equal(unlocked('taproot', 0), false);
  assert.equal(unlocked('taproot', 1), true);
  assert.equal(unlocked('canopy', TURNS_PER_SEASON - 1), false);
  assert.equal(unlocked('canopy', TURNS_PER_SEASON), true);
  assert.equal(unlocked('aidAlly', 0), true);
  assert.equal(unlocked('rhizosphere', (TURNS_PER_SEASON * 5) - 1), false);
  assert.equal(unlocked('rhizosphere', TURNS_PER_SEASON * 5), true);
});

test('ally actions awaken only after the first alliance', () => {
  const seedling = LIFE_STAGES.find(stage => stage.name === 'Seedling');
  const withoutAlly = { lifeStage: seedling, turnsInStage: 0, hasMadeFirstAlly: false };
  const withAlly = { ...withoutAlly, hasMadeFirstAlly: true };
  assert.equal(isActionUnlockedForState('requestHelp', withoutAlly, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS), false);
  assert.equal(isActionUnlockedForState('aidAlly', withoutAlly, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS), false);
  assert.equal(isActionUnlockedForState('requestHelp', withAlly, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS), true);
  assert.equal(isActionUnlockedForState('aidAlly', withAlly, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS), true);
});

test('Young Tree and Mature Tree action bundles are dispersed across stages and human-story discoveries', () => {
  assert.equal(unlocked('flower', 0, youngTree), true);
  assert.equal(unlocked('toxicLeaves', TURNS_PER_SEASON * 20, youngTree, 1), false);
  assert.equal(unlocked('toxicLeaves', 0, youngTree, 2), true);
  assert.equal(unlocked('growThorns', TURNS_PER_SEASON * 20, youngTree, 5), false);
  assert.equal(unlocked('growThorns', 0, youngTree, 6), true);
  assert.equal(unlocked('interlaceCrown', 0, youngTree, 9), true);
  assert.equal(unlocked('primeResin', 0, youngTree, 12), true);

  assert.equal(unlocked('massFlower', 0, matureTree), true);
  assert.equal(unlocked('nurtureOffspring', 0, matureTree), false);
  assert.equal(unlocked('nurtureOffspring', TURNS_PER_SEASON, matureTree), true);
  assert.equal(unlocked('shelterGrove', TURNS_PER_SEASON * 2, matureTree), true);
  assert.equal(unlocked('rootDominion', TURNS_PER_SEASON * 3, matureTree), true);
  assert.equal(unlocked('stopRootDominion', TURNS_PER_SEASON * 3, matureTree), true);
  assert.equal(unlocked('watchPath', 0, matureTree, 15), true);
  assert.equal(unlocked('rouseGrove', 0, matureTree, 17), false);
  assert.equal(unlocked('rouseGrove', 0, matureTree, 18), true);
});

test('human-story action announcements describe biological possibilities without naming humans', () => {
  const keys = ['toxicLeaves', 'growThorns', 'interlaceCrown', 'primeResin', 'watchPath', 'staggerHarvest', 'closeApproach', 'rouseGrove'];
  for (const key of keys) {
    assert.doesNotMatch(ACTION_UNLOCK_EXPLANATIONS[key], /humans?/i, key);
    assert.doesNotMatch(HUMAN_STORY_ACTION_UNLOCKS[key].label, /humans?/i, key);
  }
});

test('a Mature time-only growth nudge is claimed once while exact progress remains available', () => {
  const state = { lifeStage: matureTree, turnsInStage: 4, majorEventsSurvivedInStage: 2, allies: 1, growthNudgeCooldown: 0 };
  const first = claimGrowthNudge(state);
  assert.equal(first.missing.key, 'time');
  assert.equal(claimGrowthNudge(state), null);
  assert.match(currentStageRequirements(state)[0].label, /4\/48 turns/);
});

test('Produce Flower cannot unlock while the player is still a Sapling', () => {
  assert.equal(unlocked('flower', TURNS_PER_SEASON * 20, sapling), false);
  assert.equal(isActionAnnounceableInSeason('flower', 'Spring', SEASONAL_ACTIONS), true);
  assert.equal(isActionUnlockedForState('flower', { lifeStage: sapling, turnsInStage: 999 }, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS), false);
});

test('locked Sapling actions explain when they will awaken', () => {
  const state = { lifeStage: sapling, turnsInStage: 0 };
  assert.equal(
    getActionUnlockReason('canopy', state, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS),
    'Awakens after 1 season as a Sapling',
  );
});

test('Grow Taller and Shade Neighbor arrive with Seedling, then Fortify Trunk follows one season later', () => {
  const seedling = LIFE_STAGES.find(stage => stage.name === 'Seedling');
  assert.equal(unlocked('growTaller', 0, seedling), true);
  assert.equal(unlocked('shadeRival', 0, seedling), true);
  assert.equal(unlocked('bark', TURNS_PER_SEASON - 1, seedling), false);
  assert.equal(unlocked('bark', TURNS_PER_SEASON, seedling), true);
});

test('fractional stage progress is rounded for display without changing completion', () => {
  assert.equal(formatTurnProgress(10.799999999999999), '10.8');
  assert.equal(formatTurnProgress(12), '12');
  const requirements = currentStageRequirements({ lifeStage: sapling, turnsInStage: 10.799999999999999, branches: 0 });
  assert.match(requirements[0].label, /10\.8\/32 turns/);
  assert.equal(requirements[0].met, false);
});

// Missing catalog entries are a data-integrity failure; punctuation and phrasing are not.
test('every stage unlock has an explanation', () => {
  for (const key of LIFE_STAGES.flatMap(stage => stage.unlocks).filter(key => key !== 'defense')) {
    assert.ok(ACTION_UNLOCK_EXPLANATIONS[key]?.trim(), `missing explanation for ${key}`);
  }
});

test('seasonal unlocks are announced only when usable', () => {
  assert.equal(isActionAnnounceableInSeason('massFlower', 'Winter', SEASONAL_ACTIONS), false);
  assert.equal(isActionAnnounceableInSeason('massFlower', 'Spring', SEASONAL_ACTIONS), true);
});
