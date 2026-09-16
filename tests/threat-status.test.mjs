import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChemicalDefenseDecision,
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

test('chemical defense labels the threat growing and then solved', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state();
    const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }) });
    assert.match(decision.body, /Threat status:<\/strong> growing/);
    const outcome = resolveChemicalDefenseChoice(s, decision, 'defend');
    assert.equal(outcome.threatStatus, 'solved');
    assert.match(outcome.body, /Threat status:<\/strong> solved/);
    assert.equal(s.pendingChemicalThreat, null);
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
    assert.match(resolved.body, /Threat status: ended after causing damage/);
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
