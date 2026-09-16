import assert from 'node:assert/strict';
import test from 'node:test';

import { LIFE_STAGES, SEASONS, getNeighborStage, getRelationshipState } from '../core/constants.js';
import {
  applyHeavySnow,
  buildChemicalDefenseDecision,
  buildHostileEncroachmentDecision,
  getAmbientFlavorPool,
  getLivingNeighborsByDisposition,
  WINTER_PRECIPITATION,
} from '../core/events.js';
import {
  buildAggressionDecision,
  buildConnectionDecision,
  buildHelpRequestDecision,
  markNeighborDead,
  updateAlliesCount,
} from '../core/diplomacy.js';

function threatState(overrides = {}) {
  return {
    sunlight: 0,
    water: 0,
    nutrients: 0,
    defense: 1,
    rootZones: 2,
    branches: 2,
    trunk: 1,
    leafClusters: 2,
    eventModifiers: { disease: 0 },
    ...overrides,
  };
}

test('deferred defense choices are rebuilt from current resources without changing the threat', () => {
  const state = threatState();
  const original = buildChemicalDefenseDecision(state, {
    computeCurrentLifeStage: () => LIFE_STAGES[2],
  });
  assert.equal(original.options.some(option => option.id === 'defend'), false);

  state.sunlight = 3;
  state.water = 1;
  state.nutrients = 2;
  const refreshed = buildChemicalDefenseDecision(state, {
    computeCurrentLifeStage: () => LIFE_STAGES[2],
    threat: original.meta.threat,
  });
  assert.equal(refreshed.meta.threat, original.meta.threat);
  assert.equal(refreshed.options.find(option => option.id === 'defend')?.affordable, true);
});

test('hostile defense affordability reflects resources at display time', () => {
  const neighbor = { species: 'Apricot', relation: -80, stageScore: 600, health: 5, dead: false };
  const state = threatState();
  const deps = {
    getRelationshipState,
    compareConflictPower: target => ({ yourPower: 5, theirPower: getNeighborStage(target.stageScore).rank * 2 }),
  };
  const before = buildHostileEncroachmentDecision(state, neighbor, deps);
  assert.equal(before.options.find(option => option.id === 'chemical-battle').affordable, false);
  state.sunlight = 3;
  state.water = 1;
  state.nutrients = 2;
  const after = buildHostileEncroachmentDecision(state, neighbor, deps);
  assert.equal(after.options.find(option => option.id === 'chemical-battle').affordable, true);
});

test('dead trees retain their relationship history and disappear from every target menu', () => {
  const neighbor = {
    species: 'Apricot', relation: -80, health: 0, maxHealth: 10, dead: false,
    helpGivenToThem: 0, helpRefusedToThem: 0, timesAskedThemForHelp: 0,
  };
  const state = { neighbors: [neighbor], offspringRecords: [], allies: 0 };
  const result = markNeighborDead(state, neighbor, 'mite bloom', { getRelationshipState });
  assert.equal(result.relationship, 'Hostile');
  assert.equal(neighbor.relation, -80);
  assert.equal(neighbor.dead, true);
  assert.equal(buildConnectionDecision(state, { getRelationshipState }).options.length, 0);
  assert.equal(buildAggressionDecision(state, 'shade', { getRelationshipState }).options.length, 0);
  assert.equal(buildHelpRequestDecision(state, { getRelationshipState, getNeighborStage }).options.length, 0);
  assert.equal(updateAlliesCount(state, getRelationshipState), 0);
  assert.deepEqual(getLivingNeighborsByDisposition(state, getRelationshipState), { allied: [], contested: [] });
});

test('ambient prose is separated by life stage', () => {
  assert.ok(getAmbientFlavorPool('Seed').some(line => /beetle.*seed/i.test(line)));
  assert.ok(getAmbientFlavorPool('Seedling').every(line => !/your seed\b/i.test(line)));
  assert.ok(getAmbientFlavorPool('Mature Tree').every(line => !/your seed\b|tender first stem/i.test(line)));
});

test('winter includes snow, icicles, rain, and rare branch-breaking accumulation', () => {
  assert.ok(WINTER_PRECIPITATION.some(weather => /snow/i.test(weather.text)));
  assert.ok(WINTER_PRECIPITATION.some(weather => /icicle/i.test(weather.text)));
  assert.ok(WINTER_PRECIPITATION.some(weather => /rain/i.test(weather.text)));
  const state = { branches: 3, lifeStage: LIFE_STAGES[3] };
  const events = [];
  assert.equal(applyHeavySnow(state, events, Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, stage])), () => 0), true);
  assert.equal(state.branches, 2);
  assert.match(events[0].text, /Heavy snow/);
});

test('seasonal gathering factors expose the real light and water difficulty', () => {
  assert.deepEqual(
    SEASONS.map(season => [season.name, season.factorSun, season.factorWater]),
    [
      ['Spring', 0.8, 1],
      ['Summer', 1.2, 0.6],
      ['Autumn', 0.6, 0.8],
      ['Winter', 0.2, 0.4],
    ],
  );
});
