import test from 'node:test';
import assert from 'node:assert/strict';
import { getContextualActions, isActionRelevantToTarget, pickSceneTarget } from '../ui/context-actions.js';

const entry = (key, category = 'growth') => ({ action: { key, category, name: key } });
const relationship = value => ({ name: value >= 60 ? 'Ally' : value < 0 ? 'Rival' : 'Neutral' });

test('scene picking prefers the last drawn overlapping target', () => {
  const targets = [
    { id: 'player', bounds: { x: 0, y: 0, width: 100, height: 100 } },
    { id: 'woodpecker', bounds: { x: 40, y: 20, width: 30, height: 40 } },
  ];
  assert.equal(pickSceneTarget(targets, 50, 30)?.id, 'woodpecker');
  assert.equal(pickSceneTarget(targets, 10, 10)?.id, 'player');
  assert.equal(pickSceneTarget(targets, 200, 200), null);
});

test('a selected ally shows only actions concerning that exact tree', () => {
  const state = { neighbors: [{ relation: 75, health: 6, maxHealth: 10, slot: 1 }] };
  const target = { type: 'neighbor-tree', targetIndex: 0 };
  const usableActions = ['growBranch', 'connect', 'aidAlly', 'requestHelp', 'shadeRival'].map(key => entry(key));
  const chosen = getContextualActions({ target, usableActions, state, getRelationshipState: relationship });
  assert.deepEqual(chosen.map(item => item.action.key), ['aidAlly', 'requestHelp', 'connect']);
  assert.equal(isActionRelevantToTarget({ key: 'growBranch' }, target, state, relationship), false);
});

test('wildlife selection produces a stable relevant shortlist without padding', () => {
  const state = { neighbors: [] };
  const target = { type: 'wildlife', kind: 'woodpecker' };
  const usableActions = ['growBranch', 'growThorns', 'bark'].map(key => entry(key));
  assert.deepEqual(
    getContextualActions({ target, usableActions, state }).map(item => item.action.key),
    ['bark', 'growThorns'],
  );
});

test('new visitors surface only actions relevant to their ecological role', () => {
  const state = { neighbors: [] };
  const usableActions = ['growBranch', 'flower', 'massFlower', 'resinReserve', 'bark', 'toxicLeaves'].map(key => entry(key));
  assert.deepEqual(
    getContextualActions({ target: { type: 'wildlife', kind: 'pollinator-hoverfly' }, usableActions, state }).map(item => item.action.key),
    ['flower', 'massFlower'],
  );
  assert.deepEqual(
    getContextualActions({ target: { type: 'wildlife', kind: 'aphids' }, usableActions, state }).map(item => item.action.key),
    ['resinReserve', 'bark', 'toxicLeaves'],
  );
});

test('player tree priorities begin with unmet foundational growth', () => {
  const state = { firstRootActionTaken: false, rootZones: 0, leafClusters: 0, health: 10, maxHealth: 10 };
  const target = { type: 'player-tree' };
  const usableActions = ['bark', 'growBranch', 'growLeaves', 'extendRoot'].map(key => entry(key));
  assert.deepEqual(
    getContextualActions({ target, usableActions, state }).map(item => item.action.key),
    ['extendRoot', 'growLeaves', 'growBranch'],
  );
});

test('dock distinguishes spendable moves from leftover action points', async () => {
  const { getActionDockState } = await import('../ui/context-actions.js');
  assert.equal(getActionDockState(2, 0).status, 'No actions available');
  assert.equal(getActionDockState(2, 0).catalogLabel, 'Unavailable');
  assert.equal(getActionDockState(0, 3).canAct, false);
  assert.equal(getActionDockState(2, 3).status, '2 action points');
  assert.equal(getActionDockState(2, 3).canAct, true);
});
