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
  createMajorEvents,
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

test('a storm never reports that zero branches snapped', () => {
  const storm = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage() {},
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Storm');
  const effects = storm.apply({
    lifeStage: LIFE_STAGES[3],
    trunk: 8,
    rootZones: 8,
    branches: 1,
    leafClusters: 2,
    health: 10,
    eventModifiers: { shelter: 0 },
  });
  assert.ok(effects.every(line => !/^0 branch/.test(line)));
  assert.ok(effects.some(line => /only branch.*held fast/i.test(line)));
});

test('spindly height growth increases storm damage until trunk growth braces it', () => {
  const recorded = [];
  const storm = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: amount => recorded.push(amount),
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Storm');
  const base = {
    lifeStage: LIFE_STAGES[3], trunk: 4, rootZones: 4, branches: 2,
    leafClusters: 3, health: 20, eventModifiers: { shelter: 0 },
  };
  const stable = { ...base, spindlyGrowth: 0 };
  const spindly = { ...base, spindlyGrowth: 3 };
  storm.apply(stable);
  storm.apply(spindly);
  assert.ok(spindly.health < stable.health);
  assert.ok(recorded[1] > recorded[0]);
});

test('shade decisions mark taller adjacent rivals as unreachable', () => {
  const state = {
    lifeStage: LIFE_STAGES[3], heightGrowth: 0,
    neighbors: [{ slot: 1, species: 'Pear', relation: -30, stageScore: 3300, dead: false }],
  };
  const decision = buildAggressionDecision(state, 'shade', { getRelationshipState, getNeighborStage });
  assert.equal(decision.options[0].meta.blockedReason, 'too-short');
  state.heightGrowth = 9;
  const tallerDecision = buildAggressionDecision(state, 'shade', { getRelationshipState, getNeighborStage });
  assert.equal(tallerDecision.options[0].meta.blockedReason, null);
});

test('wildfire can be fully resisted and records one correct damage cause', () => {
  const recorded = [];
  const fire = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: (amount, cause) => recorded.push({ amount, cause }),
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Fire');
  const protectedState = {
    trunk: 4,
    health: 10,
    eventModifiers: { shelter: 0 },
  };
  const protectedEffects = fire.apply(protectedState);
  assert.equal(protectedState.health, 10);
  assert.deepEqual(recorded, []);
  assert.ok(protectedEffects.some(line => /completely protected/i.test(line)));

  const exposedState = {
    trunk: 0,
    health: 10,
    eventModifiers: { shelter: 0 },
  };
  fire.apply(exposedState);
  assert.equal(exposedState.health, 8);
  assert.deepEqual(recorded, [{ amount: 2, cause: 'fire' }]);
});

test('fungal bloom rewards connected allied neighbors, not offspring counts', () => {
  const bloom = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage() {},
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'MycorrhizalBloom');
  const childrenOnly = {
    nutrients: 0,
    allies: 2,
    neighbors: [{ relation: 0, dead: false }],
  };
  assert.deepEqual(bloom.apply(childrenOnly), ['+3 nutrients from fungal bloom']);
  assert.equal(childrenOnly.nutrients, 3);

  const connectedAlly = {
    nutrients: 0,
    allies: 1,
    neighbors: [{ relation: 70, dead: false }],
  };
  assert.deepEqual(bloom.apply(connectedAlly), ['+4 nutrients from fungal bloom', 'Connected allies strengthened the bloom!']);
  assert.equal(connectedAlly.nutrients, 4);
});
