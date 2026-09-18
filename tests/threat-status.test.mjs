import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChemicalDefenseDecision,
  processSeasonalReproduction,
  resolveChemicalDefenseChoice,
  resolvePendingStartOfTurnEffects,
} from '../core/events.js';
import { resolveHelpRequestFromAlly } from '../core/diplomacy.js';
import { getNeighborStage, getRelationshipState } from '../core/constants.js';

function state(overrides = {}) {
  return {
    sunlight: 8,
    water: 8,
    nutrients: 8,
    health: 5,
    maxHealth: 10,
    defense: 0,
    fruitDefense: 0,
    leafClusters: 3,
    rootZones: 3,
    developing: 0,
    eventModifiers: { disease: 0 },
    pendingChemicalThreat: null,
    ...overrides,
  };
}

function ally() {
  return {
    species: 'Citrus',
    relation: 70,
    stageScore: 3500,
    helpGivenToThem: 2,
    helpRefusedToThem: 0,
    timesAskedThemForHelp: 0,
    helpReceivedFromThem: 0,
  };
}

test('chemical defense describes the danger naturally as gathering and then passed', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state();
    const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }) });
    assert.match(decision.body, /danger is still gathering/i);
    const outcome = resolveChemicalDefenseChoice(s, decision, 'defend');
    assert.equal(outcome.threatStatus, 'solved');
    assert.match(outcome.body, /danger has passed/i);
    assert.equal(s.pendingChemicalThreat, null);
  } finally {
    Math.random = originalRandom;
  }
});

test('hungry browsers recognize permanent thorns and toxic leaves without another resource cost', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.4;
  try {
    const s = state({ thornDefense: 1, toxicLeaves: 1, developing: 2 });
    const before = { sunlight: s.sunlight, water: s.water, nutrients: s.nutrients, leafClusters: s.leafClusters, developing: s.developing };
    const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Small Tree' }) });
    assert.equal(decision.title, 'Hungry Browsers');
    assert.match(decision.body, /established thorns and toxic leaves/i);
    assert.deepEqual(decision.options.map(option => option.id), ['use-permanent-defenses']);
    const outcome = resolveChemicalDefenseChoice(s, decision, 'use-permanent-defenses');
    assert.equal(outcome.threatStatus, 'solved');
    assert.match(outcome.body, /no foliage or fruit is lost/i);
    assert.deepEqual(
      { sunlight: s.sunlight, water: s.water, nutrients: s.nutrients, leafClusters: s.leafClusters, developing: s.developing },
      before,
    );
  } finally {
    Math.random = originalRandom;
  }
});

test('an unanswered chemical threat reports its final damaging conclusion', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state();
    const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }) });
    const deferred = resolveChemicalDefenseChoice(s, decision, 'conserve');
    assert.equal(deferred.threatStatus, 'growing');
    assert.match(deferred.body, /have not contained the threat/i);
    assert.doesNotMatch(deferred.body, /next turn/i);
    const [resolved] = resolvePendingStartOfTurnEffects(s);
    assert.match(resolved.body, /danger has passed, though it left damage behind/i);
    assert.equal(s.pendingChemicalThreat, null);
  } finally {
    Math.random = originalRandom;
  }
});

test('ally help clears a pending aphid threat as well as restoring health', () => {
  const s = state({
    pendingChemicalThreat: {
      title: 'Aphid Cluster',
      warning: 'Aphids are feeding.',
      ignore: () => 'Damage',
    },
  });
  const outcome = resolveHelpRequestFromAlly(s, ally(), {
    getRelationshipState,
    getNeighborStage,
    random: () => 0,
  });
  assert.equal(outcome.clearedThreat.title, 'Aphid Cluster');
  assert.equal(outcome.threatStatus, 'solved');
  assert.equal(s.pendingChemicalThreat, null);
  assert.ok(outcome.actualHeal > 0);
});

test('a new fruit threat remains pending until a later event phase', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state({ developing: 2, selectedSpecies: 'Plum' });
    const warningEvents = [];
    processSeasonalReproduction(s, warningEvents, () => 'Summer');
    assert.equal(warningEvents.length, 1);
    assert.match(warningEvents[0].text, /until the next event phase/i);
    assert.ok(s.pendingFruitThreat);
    assert.equal(s.developing, 2);

    s.defense = 2;
    Math.random = () => 0.99;
    const resolutionEvents = [];
    processSeasonalReproduction(s, resolutionEvents, () => 'Autumn');
    assert.equal(resolutionEvents.length, 2);
    assert.match(resolutionEvents[0].text, /danger to this season's fruit has passed/i);
    assert.match(resolutionEvents[1].text, /hardened into/i);
    assert.equal(s.pendingFruitThreat, null);
  } finally {
    Math.random = originalRandom;
  }
});

test('resolving a fruit threat does not immediately replace it in the same summer event phase', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state({
      developing: 2,
      selectedSpecies: 'Plum',
      pendingFruitThreat: {
        type: 'bird',
        warning: 'Birds gather.',
        baseLoss: 0,
        outcome: () => 'Fruit was lost.',
        safeText: 'The birds moved on.',
      },
    });
    const events = [];
    processSeasonalReproduction(s, events, () => 'Summer');
    assert.equal(events.length, 1);
    assert.equal(s.pendingFruitThreat, null);
  } finally {
    Math.random = originalRandom;
  }
});
