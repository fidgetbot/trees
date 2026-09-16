import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionsForGathering,
  BASE_ACTIONS_PER_TURN,
  createEngine,
  MAX_BONUS_ACTIONS_PER_TURN,
} from '../core/engine.js';
import { createActions } from '../core/actions.js';

function actionState() {
  return {
    actions: 3,
    sunlight: 12,
    water: 9,
    nutrients: 15,
    year: 1,
    branches: 0,
    rootZones: 0,
    trunk: 0,
    viableSeeds: 0,
    allies: 0,
    offspringPool: 0,
    lifeStage: { name: 'Sapling' },
  };
}

function actionEngine() {
  return createEngine({
    SEASONS: [{ name: 'Spring', factorSun: 1, factorWater: 1 }],
    updateUI() {},
    render() {},
    tryAdvanceLifeStage: () => false,
  });
}

function spendFrom(state) {
  return (cost) => {
    state.sunlight -= cost.sunlight || 0;
    state.water -= cost.water || 0;
    state.nutrients -= cost.nutrients || 0;
    state.actions -= 1;
  };
}

test('cancelling a deferred action spends no resources or action', () => {
  const state = actionState();
  const before = { ...state };
  let transaction;
  const feedback = [];

  actionEngine().executeAction(state, {
    key: 'test-choice',
    name: 'Test Choice',
    effect(_state, context) {
      transaction = context.transaction;
      return { deferred: true };
    },
  }, { sunlight: 2, water: 1, nutrients: 4 }, {
    spend: spendFrom(state),
    showFeedback: (message, type) => feedback.push({ message, type }),
  });

  assert.deepEqual(
    { actions: state.actions, sunlight: state.sunlight, water: state.water, nutrients: state.nutrients },
    { actions: before.actions, sunlight: before.sunlight, water: before.water, nutrients: before.nutrients },
  );
  assert.equal(transaction.cancel(), true);
  assert.equal(transaction.complete(), false);
  assert.deepEqual(
    { actions: state.actions, sunlight: state.sunlight, water: state.water, nutrients: state.nutrients },
    { actions: before.actions, sunlight: before.sunlight, water: before.water, nutrients: before.nutrients },
  );
  assert.match(feedback.at(-1).message, /nothing spent/i);
});

test('confirming a deferred action commits its cost exactly once', () => {
  const state = actionState();
  let transaction;
  let eventPhases = 0;
  const logs = [];

  actionEngine().executeAction(state, {
    key: 'test-choice',
    name: 'Test Choice',
    effect(_state, context) {
      transaction = context.transaction;
      return { deferred: true };
    },
  }, { sunlight: 2, water: 1, nutrients: 4 }, {
    spend: spendFrom(state),
    addLog: message => logs.push(message),
    showEventPhase: () => { eventPhases += 1; },
  });

  assert.equal(transaction.commit(), true);
  assert.equal(transaction.commit(), true);
  assert.deepEqual(
    { actions: state.actions, sunlight: state.sunlight, water: state.water, nutrients: state.nutrients },
    { actions: 2, sunlight: 10, water: 8, nutrients: 11 },
  );
  assert.equal(transaction.complete(), true);
  assert.equal(transaction.complete(), false);
  assert.deepEqual(logs, ['Action: Test Choice.']);
  assert.equal(eventPhases, 0);
});

test('high gathering preserves early bonuses but caps each turn at six actions', () => {
  assert.equal(actionsForGathering(0), BASE_ACTIONS_PER_TURN);
  assert.equal(actionsForGathering(4), BASE_ACTIONS_PER_TURN);
  assert.equal(actionsForGathering(5), BASE_ACTIONS_PER_TURN + 1);
  assert.equal(actionsForGathering(10), BASE_ACTIONS_PER_TURN + 2);
  assert.equal(actionsForGathering(15), BASE_ACTIONS_PER_TURN + MAX_BONUS_ACTIONS_PER_TURN);
  assert.equal(actionsForGathering(10_000), BASE_ACTIONS_PER_TURN + MAX_BONUS_ACTIONS_PER_TURN);
  assert.equal(BASE_ACTIONS_PER_TURN + MAX_BONUS_ACTIONS_PER_TURN, 6);
});

test('every browser multi-step action receives the authoritative transaction context', () => {
  const calls = new Map();
  const capture = key => (_state, context) => {
    calls.set(key, context);
    return { deferred: true };
  };
  const actions = createActions({
    resinReserveAction: capture('resinReserve'),
    woodSurgeAction: capture('woodSurge'),
    attemptConnection: capture('connect'),
    offerAidToAlly: capture('aidAlly'),
    requestHelpFromAllies: capture('requestHelp'),
    shadeRivalAction: capture('shadeRival'),
    rootDominionAction: capture('rootDominion'),
    getRelationshipState: () => ({ name: 'Ally' }),
  });
  const transaction = { commit() {}, cancel() {}, complete() {} };
  const scaledCost = { sunlight: 2, water: 3, nutrients: 4 };

  for (const key of ['resinReserve', 'woodSurge', 'connect', 'aidAlly', 'requestHelp', 'shadeRival', 'rootDominion']) {
    const action = actions.find(entry => entry.key === key);
    action.effect({}, { scaledCost, transaction });
    assert.equal(calls.get(key).transaction, transaction, `${key} lost its transaction`);
    assert.equal(calls.get(key).scaledCost, scaledCost, `${key} lost its scaled cost`);
  }
});
