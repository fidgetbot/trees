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
    const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Young Tree' }) });
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
    activeSceneArt: ['aphids', 'woodpecker'],
    pendingChemicalThreat: {
      title: 'Aphid Cluster',
      warning: 'Aphids are feeding.',
      sceneArt: 'aphids',
      ignore: () => 'Damage',
    },
  });
  const outcome = resolveHelpRequestFromAlly(s, ally(), {
    getRelationshipState,
    getNeighborStage,
    random: () => 0,
  });
  assert.deepEqual(s.activeSceneArt, ['woodpecker']);
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

test('animal fruit threats retain event-driven scene art through warning and resolution', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.4;
  try {
    const s = state({ developing: 2, selectedSpecies: 'Plum' });
    const warnings = [];
    processSeasonalReproduction(s, warnings, () => 'Summer');
    assert.equal(s.pendingFruitThreat.type, 'bird');
    assert.equal(warnings[0].sceneArt, 'fruit-robin');

    Math.random = () => 0.99;
    const resolution = [];
    processSeasonalReproduction(s, resolution, () => 'Autumn');
    assert.equal(resolution[0].sceneArt, 'fruit-robin');
  } finally {
    Math.random = originalRandom;
  }
});

test('delayed chemical consequences preserve the original creature identity', () => {
  for (const choice of ['conserve', 'defend']) {
    const s = state({ sunlight: 0, water: 0, nutrients: 0 });
    const threat = {
      title: 'Surface Crawlers', sceneArt: 'surface-crawlers', warning: 'Crawlers approach.',
      ignore: () => ({ body: 'Roots were damaged.', damage: { amount: 1, cause: 'insects' } }),
    };
    const decision = buildChemicalDefenseDecision(s, {
      computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat,
    });
    resolveChemicalDefenseChoice(s, decision, choice);
    assert.equal(s.pendingChemicalThreat.sceneArt, 'surface-crawlers');
    const [consequence] = resolvePendingStartOfTurnEffects(s);
    assert.equal(consequence.sceneArt, 'surface-crawlers');
    assert.equal(consequence.title, 'Surface Crawlers');
    assert.equal(s.pendingChemicalThreat, null);
  }
});

test('solved pests leave the scene while conserved pests and unrelated wildlife remain', () => {
  for (const choice of ['defend', 'conserve']) {
    const s = state({ activeSceneArt: ['aphids', 'woodpecker'] });
    const threat = { title: 'Aphid Cluster', sceneArt: 'aphids', warning: 'Sap feeding.', defend: () => 'They retreat.', ignore: () => ({body:'Damage.'}) };
    const decision = buildChemicalDefenseDecision(s, {computeCurrentLifeStage: () => ({name:'Seedling'}), threat});
    resolveChemicalDefenseChoice(s, decision, choice);
    assert.deepEqual(s.activeSceneArt, choice === 'defend' ? ['woodpecker'] : ['aphids', 'woodpecker']);
    if (choice === 'conserve') {
      resolvePendingStartOfTurnEffects(s);
      assert.deepEqual(s.activeSceneArt, ['woodpecker']);
    }
  }
});
