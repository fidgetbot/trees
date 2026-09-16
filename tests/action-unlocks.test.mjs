import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTION_UNLOCK_EXPLANATIONS, createActions, getActionUnlockExplanation } from '../core/actions.js';
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
