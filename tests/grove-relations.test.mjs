import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngine } from '../core/engine.js';
import { applyAggressionToNeighbor, buildAggressionDecision } from '../core/diplomacy.js';
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
    allies: 3,
    neighbors: [
      { slot: 1, dead: false, playerShading: true },
      { slot: 3, dead: false, shadingPlayer: true },
    ],
  });
  const gains = engine().collectResources(state);
  assert.equal(gains.relations.connectedAllies, 3);
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
