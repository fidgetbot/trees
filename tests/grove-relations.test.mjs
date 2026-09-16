import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngine } from '../core/engine.js';
import { createActions } from '../core/actions.js';
import { applyAggressionToNeighbor, applyRelationshipDelta, buildAggressionDecision, buildAidDecision, resolveDiplomacyDecision } from '../core/diplomacy.js';
import { getCanopyArrangement } from '../ui/canvas.js';
import { renderResourcePhaseBody } from '../ui/resources.js';
import { getRelationshipState } from '../core/constants.js';

function gatheringState(overrides = {}) {
  return {
    seasonIndex: 0,
    sunlight: 0,
    water: 0,
    nutrients: 0,
    actions: 0,
    leafClusters: 10,
    canopySpread: 0,
    taprootDepth: 0,
    trunk: 4,
    rootZones: 4,
    branches: 0,
    flowers: 0,
    developing: 0,
    seeds: 0,
    allies: 0,
    neighbors: [],
    eventModifiers: { drought: 1, disease: 1, soilBonus: 0, shelter: 0 },
    ...overrides,
  };
}

function engine() {
  return createEngine({
    SEASONS: [{ name: 'Summer', factorSun: 1.2, factorWater: 1 }],
    updateUI() {},
    render() {},
    getRelationshipState,
  });
}

test('shade targets only immediate neighbors and establishes a persistent arrangement', () => {
  const far = { slot: 0, species: 'Pear', relation: 0, stageScore: 1000, dead: false };
  const left = { slot: 1, species: 'Peach', relation: 0, stageScore: 1000, dead: false };
  const right = { slot: 3, species: 'Plum', relation: -40, stageScore: 1000, dead: false };
  const state = { sunlight: 0, nutrients: 0, neighbors: [far, left, right] };
  const decision = buildAggressionDecision(state, 'shade', { getRelationshipState });
  assert.deepEqual(decision.options.map(option => option.meta.species), ['Peach', 'Plum']);
  const result = applyAggressionToNeighbor(state, left, 'shade', { getRelationshipState });
  assert.equal(left.playerShading, true);
  assert.equal(left.shadingPlayer, false);
  assert.equal(result.persistentCanopyAdvantage, true);
  assert.deepEqual(result.gains, { sunlight: 0, water: 0, nutrients: 0 });
});

test('allies and persistent canopy positions change gathering relative to neutral baseline', () => {
  const state = gatheringState({
    neighbors: [
      { slot: 0, relation: 70, dead: false },
      { slot: 1, relation: 0, dead: false, playerShading: true },
      { slot: 3, relation: -60, dead: false, shadingPlayer: true },
    ],
  });
  const gains = engine().collectResources(state);
  assert.equal(gains.relations.connectedAllies, 1);
  assert.equal(gains.relations.shadedNeighbors, 1);
  assert.equal(gains.relations.crowdingNeighbors, 1);
  assert.ok(gains.allyNutrients > 0);
  assert.ok(gains.allyWater > 0);
  assert.notDeepEqual(gains.relationDeltas, { sunlight: 0, water: 0, nutrients: 0 });
  const summary = renderResourcePhaseBody({ state, gains });
  assert.match(summary, /neutral-grove baseline/i);
  assert.match(summary, /connected allies|ally shares|allies share/i);
  assert.match(summary, /crowd you|crowded by/i);
});

test('offspring do not masquerade as connected allied neighbors during gathering', () => {
  const state = gatheringState({
    neighbors: [{ slot: 1, relation: 0, dead: false }],
    offspringRecords: [{ id: 'child-1', dead: false }, { id: 'child-2', dead: false }],
    offspringTrees: 2,
    allies: 2,
  });
  const gains = engine().collectResources(state);
  assert.equal(gains.relations.connectedAllies, 0);
  assert.equal(gains.allyWater, 0);
  assert.equal(gains.allyNutrients, 0);
});

test('offspring do not unlock requests for help from allied neighbors', () => {
  const actions = createActions({
    resinReserveAction() {},
    woodSurgeAction() {},
    attemptConnection() {},
    offerAidToAlly() {},
    requestHelpFromAllies() {},
    shadeRivalAction() {},
    rootDominionAction() {},
    getRelationshipState,
  });
  const requestHelp = actions.find(action => action.key === 'requestHelp');
  const childrenOnly = {
    allies: 2,
    alliedNeighbors: 0,
    health: 5,
    maxHealth: 10,
    neighbors: [{ relation: 0, dead: false }],
  };
  assert.equal(requestHelp.prereq(childrenOnly), false);
  childrenOnly.neighbors.push({ relation: 70, dead: false });
  assert.equal(requestHelp.prereq(childrenOnly), true);
});

test('offer aid reports the exact scaled action cost that was already paid', () => {
  const paidCost = { sunlight: 0, water: 5, nutrients: 20 };
  const ally = {
    species: 'Pear', relation: 70, dead: false, health: 6, maxHealth: 10,
    stageScore: 1200, helpGivenToThem: 0, growthAidReceived: 0,
    firstAidStageScore: null, activeCrises: [],
  };
  const state = { neighbors: [ally] };
  const decision = buildAidDecision(state, { getRelationshipState, paidCost });
  const resolved = resolveDiplomacyDecision(state, decision, decision.options[0].id, { getRelationshipState });
  assert.deepEqual(decision.options[0].meta.paidCost, paidCost);
  assert.deepEqual(resolved.outcome.paidCost, paidCost);
});

test('relationship repair clears persistent canopy pressure through the shared helper', () => {
  const neighbor = { relation: -15, playerShading: true, shadingPlayer: true };
  applyRelationshipDelta({}, neighbor, 20, (_state, amount) => amount);
  assert.equal(getRelationshipState(neighbor.relation).name, 'Neutral');
  assert.equal(neighbor.playerShading, false);
  assert.equal(neighbor.shadingPlayer, false);
});

test('deepening a taproot adds nutrient access beyond its ordinary root zone', () => {
  const ordinary = engine().collectResources(gatheringState({ rootZones: 5, taprootDepth: 0 }));
  const deep = engine().collectResources(gatheringState({ rootZones: 5, taprootDepth: 1 }));
  assert.ok(deep.rootNutrients > ordinary.rootNutrients);
  assert.ok(deep.taprootNutrients > 0);
});

test('canopy arrangements visibly move and lean the participating trees', () => {
  const shaded = { slot: 1, dead: false, playerShading: true };
  const crowding = { slot: 3, dead: false, shadingPlayer: true };
  const state = { neighbors: [shaded, crowding] };
  assert.ok(getCanopyArrangement(state, 2, true).canopyLean < 0);
  assert.ok(getCanopyArrangement(state, 1, false, shaded).worldOffset < 0);
  assert.ok(getCanopyArrangement(state, 3, false, crowding).worldOffset < 0);
  assert.ok(getCanopyArrangement(state, 3, false, crowding).canopyLean < 0);
});

test('gathering summary reports the actual number of bonus actions', () => {
  const state = gatheringState({ actions: 5 });
  const gains = {
    season: { name: 'Summer', factorSun: 1.2, factorWater: 1 },
    exposure: 1,
    sunlightGain: 5,
    waterGain: 4,
    nutrientGain: 3,
    neutralGains: { sunlight: 5, water: 4, nutrients: 3 },
    relationDeltas: { sunlight: 0, water: 0, nutrients: 0 },
    relations: { shadedNeighbors: 0, crowdingNeighbors: 0, connectedAllies: 0 },
    canopyBonus: 0,
    taprootBonus: 0,
    rootNutrients: 2.8,
    taprootNutrients: 0,
    allyNutrients: 0,
    allyWater: 0,
    shadeNutrients: 0,
    crowdingNutrients: 0,
    soilBonus: 0,
    maintenanceCost: 0,
  };
  const summary = renderResourcePhaseBody({ state, gains });
  assert.match(summary, /\+2 bonus actions from high resource yield/);
});
