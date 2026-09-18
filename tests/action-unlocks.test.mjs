import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ACTION_UNLOCK_EXPLANATIONS, createActions, getActionUnlockAnnouncement, getActionUnlockExplanation, isActionAnnounceableInSeason } from '../core/actions.js';
import { LIFE_STAGES, SEASONAL_ACTIONS } from '../core/constants.js';

test('developmental naming separates life stage from competitive height', () => {
  assert.ok(LIFE_STAGES.some(stage => stage.name === 'Young Tree'));
  assert.equal(LIFE_STAGES.some(stage => stage.name === 'Small Tree'), false);
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /<span>Life stage<\/span>/);
  assert.doesNotMatch(index, /<span>Stage<\/span>/);
});

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

test('noun-phrase actions use natural unlock announcements in their first usable season', () => {
  assert.equal(getActionUnlockAnnouncement({ name: 'Mass Flowering' }), 'Mass Flowering is now available!');
  assert.equal(isActionAnnounceableInSeason('massFlower', 'Winter', SEASONAL_ACTIONS), false);
  assert.equal(isActionAnnounceableInSeason('massFlower', 'Spring', SEASONAL_ACTIONS), true);
});

test('growth descriptions use player-facing language and name the height remedy', () => {
  const actions = createActions({
    resinReserveAction() {}, woodSurgeAction() {}, attemptConnection() {}, offerAidToAlly() {},
    requestHelpFromAllies() {}, shadeRivalAction() {}, rootDominionAction() {},
    getRelationshipState: () => ({ name: 'Neutral' }),
  });
  const branch = actions.find(action => action.key === 'growBranch');
  const height = actions.find(action => action.key === 'growTaller');
  assert.doesNotMatch(branch.help, /visible/i);
  assert.doesNotMatch(ACTION_UNLOCK_EXPLANATIONS.growBranch, /visible/i);
  assert.match(height.help, /Fortify Bark/);
  assert.match(ACTION_UNLOCK_EXPLANATIONS.growTaller, /Fortify Bark/);
  assert.equal(actions.some(action => action.key === 'thicken'), false);
  const bark = actions.find(action => action.key === 'bark');
  assert.match(bark.help, /Braces one level/);
  assert.ok(bark.baseCost.sunlight > height.baseCost.sunlight);
  assert.ok(bark.baseCost.nutrients > height.baseCost.nutrients);
});
