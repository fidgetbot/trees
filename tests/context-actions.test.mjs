import test from 'node:test';
import assert from 'node:assert/strict';
import { describeNeighborEffects, getContextualActions, isActionRelevantToTarget, pickSceneTarget, stabilizeContextualActionOrder } from '../ui/context-actions.js';
import { carouselScrollbarMetrics } from '../ui/actions.js';

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

test('scene picking ignores offscreen trees retained for minimap navigation',()=>{
  const targets=[
    {id:'visible-seedling',sceneVisible:true,bounds:{x:0,y:0,width:80,height:100}},
    {id:'offscreen-mature',sceneVisible:false,bounds:{x:-200,y:-100,width:320,height:300}},
  ];
  assert.equal(pickSceneTarget(targets,40,40)?.id,'visible-seedling');
});

test('a selected ally shows only actions concerning that exact tree', () => {
  const state = { neighbors: [{ relation: 75, health: 6, maxHealth: 10, slot: 1 }] };
  const target = { type: 'neighbor-tree', targetIndex: 0 };
  const usableActions = ['growBranch', 'connect', 'aidAlly', 'requestHelp', 'shadeRival'].map(key => entry(key));
  const chosen = getContextualActions({ target, usableActions, state, getRelationshipState: relationship });
  assert.deepEqual(chosen.map(item => item.action.key), ['aidAlly', 'requestHelp', 'connect']);
  assert.equal(isActionRelevantToTarget({ key: 'growBranch' }, target, state, relationship), false);
});

test('neighbor overview describes relationship effects from authoritative state', () => {
  assert.deepEqual(describeNeighborEffects({ health: 8, maxHealth: 10, playerShading: true, rhizosphereBonus: .5 }, 'Ally'), [
    'Shares water and nutrients through the fungal network',
    'Growing under your shade; its growth is slowed',
    'Benefits from your enriched rhizosphere',
    'Injured · 8/10 health',
  ]);
  assert.deepEqual(describeNeighborEffects({ health: 10, maxHealth: 10, shadingPlayer: true }, 'Hostile'), [
    'Crowding your canopy and reducing your available light',
    'Its roots compete for nutrients and reduce your water',
  ]);
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

test('the player carousel can include every usable action without truncation', () => {
  const state = { firstRootActionTaken: true, rootZones: 2, leafClusters: 2, health: 10, maxHealth: 10 };
  const target = { type: 'player-tree' };
  const usableActions = ['extendRoot', 'growLeaves', 'growBranch', 'bark', 'taproot'].map(key => entry(key));
  assert.deepEqual(
    getContextualActions({ target, usableActions, state, limit: Number.POSITIVE_INFINITY }).map(item => item.action.key),
    ['extendRoot', 'growLeaves', 'growBranch', 'bark', 'taproot'],
  );
});

test('carousel scrollbar geometry tracks overflow and clamps restored positions', () => {
  assert.deepEqual(carouselScrollbarMetrics({ clientWidth: 600, scrollWidth: 1200, scrollLeft: 300 }), {
    overflow: true, maxScroll: 600, thumbWidth: 300, thumbLeft: 150,
  });
  assert.deepEqual(carouselScrollbarMetrics({ clientWidth: 600, scrollWidth: 500, scrollLeft: 999 }), {
    overflow: false, maxScroll: 0, thumbWidth: 600, thumbLeft: 0,
  });
  assert.equal(carouselScrollbarMetrics({ clientWidth: 200, scrollWidth: 2000, scrollLeft: 9999 }).thumbLeft, 152);
});

test('repeated contextual choices retain their established button order when priorities change', () => {
  const target = { type: 'player-tree' };
  const usableActions = ['growLeaves', 'extendRoot'].map(key => entry(key));
  const first = getContextualActions({
    target,
    usableActions,
    state: { firstRootActionTaken: false, rootZones: 1, leafClusters: 0, health: 10, maxHealth: 10 },
  });
  assert.deepEqual(first.map(item => item.action.key), ['extendRoot', 'growLeaves']);

  const next = getContextualActions({
    target,
    usableActions,
    state: { firstRootActionTaken: true, rootZones: 2, leafClusters: 0, health: 10, maxHealth: 10 },
    stableKeys: first.map(item => item.action.key),
  });
  assert.deepEqual(next.map(item => item.action.key), ['extendRoot', 'growLeaves']);
});

test('newly relevant actions keep their ranked slot without reversing familiar choices', () => {
  const actions = ['bark', 'growLeaves', 'extendRoot'].map(key => entry(key));
  const stabilized = stabilizeContextualActionOrder(actions, ['extendRoot', 'growLeaves']);
  assert.deepEqual(stabilized.map(item => item.action.key), ['bark', 'extendRoot', 'growLeaves']);
});

test('dock distinguishes spendable moves from leftover action points', async () => {
  const { getActionDockState } = await import('../ui/context-actions.js');
  assert.equal(getActionDockState(2, 0).status, '');
  assert.equal(getActionDockState(0, 3).canAct, false);
  assert.equal(getActionDockState(2, 3).status, '2 actions remaining');
  assert.equal(getActionDockState(2, 3).canAct, true);
  assert.equal(getActionDockState(2, 3).catalogLabel, 'Future Actions');
  assert.equal(getActionDockState(2, 3).catalogTitle, 'Future Actions');
});
