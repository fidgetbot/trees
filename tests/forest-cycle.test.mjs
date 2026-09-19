import assert from 'node:assert/strict';
import test from 'node:test';

import { LIFE_STAGES, getRelationshipState } from '../core/constants.js';
import { createActions } from '../core/actions.js';
import { buildAidDecision, buildConnectionDecision, resolveAidToAlly, resolveHelpRequestFromAlly, updateAlliesCount } from '../core/diplomacy.js';
import { shouldSkipGathering, updateResourceShortageNudges } from '../core/engine.js';
import { advanceNeighborDeathCycle } from '../core/neighbors.js';
import { getSpeciesAdjustedCost } from '../core/species.js';
import { renderFullGameOverBody } from '../ui/outcomes.js';

test('a seed with no root gathers nothing and is directed toward growth', () => {
  assert.equal(shouldSkipGathering({ rootZones: 0 }), true);
  assert.equal(shouldSkipGathering({ rootZones: 1 }), false);
});

test('resource shortage guidance escalates after three and six weak turns', () => {
  const state = {};
  const gains = { sunlightGain: 1, waterGain: 4, nutrientGain: 4 };
  assert.equal(updateResourceShortageNudges(state, gains), null);
  assert.equal(updateResourceShortageNudges(state, gains), null);
  assert.match(updateResourceShortageNudges(state, gains).remedy, /Grow Leaf/);
  updateResourceShortageNudges(state, gains);
  updateResourceShortageNudges(state, gains);
  assert.match(updateResourceShortageNudges(state, gains).title, /Persistent Sunlight/);
});

test('connection choices show stage and biological tradeoffs', () => {
  const state = { neighbors: [{ species: 'Pear', relation: 0, stageScore: 3300, dead: false }] };
  const decision = buildConnectionDecision(state, { getRelationshipState, getNeighborStage: score => LIFE_STAGES.findLast(stage => score >= stage.threshold) });
  assert.match(decision.options[0].label, /Mature Tree/);
  assert.match(decision.options[0].description, /share more water and nutrients/);
  assert.match(decision.options[0].description, /rejection/);
});

test('offer aid only targets injured allies', () => {
  const state = { neighbors: [
    { species: 'Pear', relation: 70, health: 10, maxHealth: 10, dead: false },
    { species: 'Plum', relation: 70, health: 7, maxHealth: 10, dead: false },
  ] };
  const decision = buildAidDecision(state, { getRelationshipState });
  assert.deepEqual(decision.options.map(option => option.meta.species), ['Plum']);
  assert.equal(resolveAidToAlly(state, state.neighbors[0], { getRelationshipState }).reason, 'full-health');
});

test('first alliance permanently awakens ally actions', () => {
  const state = { neighbors: [{ relation: 70, dead: false }], offspringRecords: [] };
  updateAlliesCount(state, getRelationshipState);
  assert.equal(state.hasMadeFirstAlly, true);
});

test('help requests can supply water and remember withheld aid', () => {
  const state = { health: 5, maxHealth: 10, water: 0, nutrients: 0, pendingChemicalThreat: null };
  const neighbor = { species: 'Pear', relation: 70, stageScore: 3300, health: 10, maxHealth: 10, activeCrises: [], helpGivenToThem: 0, helpRefusedToThem: 1, helpReceivedFromThem: 0, timesAskedThemForHelp: 0, lastAidMemory: 'you-refused' };
  const result = resolveHelpRequestFromAlly(state, neighbor, { getRelationshipState, getNeighborStage: () => ({ rank: 5 }), requestKind: 'water', random: () => 0.99 });
  assert.ok(state.water >= 1);
  assert.match(result.tone, /remembers when you conserved/);
  assert.ok(neighbor.relation < 70);
});

test('requesting help always costs exactly one nutrient', () => {
  const stage = LIFE_STAGES.find(candidate => candidate.name === 'Mature Tree');
  assert.deepEqual(getSpeciesAdjustedCost({ selectedSpecies: 'Plum' }, 'requestHelp', { nutrients: 1 }, stage), { sunlight: 0, water: 0, nutrients: 1 });
});

test('dead trees become stumps after four turns and new seedlings three turns later', () => {
  const neighbor = { species: 'Pear', dead: true, deathAge: 0, maxHealth: 10 };
  for (let turn = 1; turn <= 3; turn += 1) assert.equal(advanceNeighborDeathCycle(neighbor, { speciesNames: ['Plum'], seedlingThreshold: 300, random: () => 0 }).phase, 'dead-tree');
  assert.equal(advanceNeighborDeathCycle(neighbor, { speciesNames: ['Plum'], seedlingThreshold: 300, random: () => 0 }).phase, 'stump');
  advanceNeighborDeathCycle(neighbor, { speciesNames: ['Plum'], seedlingThreshold: 300, random: () => 0 });
  advanceNeighborDeathCycle(neighbor, { speciesNames: ['Plum'], seedlingThreshold: 300, random: () => 0 });
  assert.equal(advanceNeighborDeathCycle(neighbor, { speciesNames: ['Plum'], seedlingThreshold: 300, random: () => 0 }).phase, 'seedling');
  assert.equal(neighbor.dead, false);
  assert.equal(neighbor.stageScore, 300);
});

test('game over replaces play with lifetime, cause, quote, and retry control', () => {
  const html = renderFullGameOverBody({ flavor: 'You fall.', score: 42, lifetimeTurns: 19, years: 1, cause: 'storm', species: 'Plum' });
  assert.match(html, /Your Plum has died/);
  assert.match(html, /19 turns/);
  assert.match(html, /Cause of death/);
  assert.match(html, /blockquote/);
  assert.match(html, /Try Again/);
});
