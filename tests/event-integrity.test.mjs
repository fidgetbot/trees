import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngine } from '../core/engine.js';
import { LIFE_STAGES, SEASONS, STAGE_BY_NAME, getNeighborStage, getRelationshipState } from '../core/constants.js';
import {
  applyHeavySnow,
  buildChemicalDefenseDecision,
  buildHostileEncroachmentDecision,
  describeDecisionPrompt,
  getHerbivoreDefense,
  getLivingNeighborsByDisposition,
  getPollinatorSceneArt,
  maybeEscalateCanopyHostility,
  rollMinorEvents,
  resolveHostileEncroachmentChoice,
  WINTER_PRECIPITATION,
  createMajorEvents,
  normalizeStoredProtection,
  rollMajorEvent,
} from '../core/events.js';
import {
  buildAggressionDecision,
  buildConnectionDecision,
  buildHelpRequestDecision,
  checkAllyBetrayal,
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

test('minor events omit stat-free ambient flavor observations', () => {
  const originalRandom=Math.random;
  Math.random=()=>.11;
  try{
    const state={
      flowers:0,pollinated:0,developing:0,seeds:0,nutrients:0,water:0,branches:0,
      lifeStage:LIFE_STAGES[0],eventModifiers:{rainChain:0},neighbors:[],offspringTrees:0,
    };
    const events=rollMinorEvents(state,{
      currentSeasonName:'Spring',getPollinatorChance:value=>value,species:{},recordDamage(){},STAGE_BY_NAME,
      getRelationshipState,getNeighborStage,random:()=>.11,advanceAllyCrises(){},advanceOffspringCrises(){},
      checkAllyBetrayal(){},queueHostileTreeThreat(){},queueChemicalDefenseThreat(){},
      computeCurrentLifeStage:()=>LIFE_STAGES[0],
    });
    assert.ok(events.length>0);
    assert.equal(events.some(event=>event.effect==='flavor'),false);
  }finally{Math.random=originalRandom}
});

test('repeated rain and resulting root rot are reported as one incident', () => {
  const originalRandom = Math.random;
  const rolls = [0.99, 0, 0.99, 0.99, 0.99, 0.99];
  Math.random = () => rolls.shift() ?? 0.99;
  try {
    const state = {
      flowers: 0, pollinated: 0, developing: 0, seeds: 0, nutrients: 0, water: 0, health: 8, branches: 0,
      lifeStage: LIFE_STAGES[0], eventModifiers: { rainChain: 2 }, neighbors: [], offspringTrees: 0,
    };
    const events = rollMinorEvents(state, {
      currentSeasonName: 'Spring', getPollinatorChance: value => value, species: {}, recordDamage() {}, STAGE_BY_NAME,
      getRelationshipState, getNeighborStage, random: () => 0.99, advanceAllyCrises() {}, advanceOffspringCrises() {},
      checkAllyBetrayal() {}, queueHostileTreeThreat() {}, queueChemicalDefenseThreat() {},
      computeCurrentLifeStage: () => LIFE_STAGES[0],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].title, 'Rain and Root Rot');
    assert.deepEqual(events[0].effects, ['Water +2', 'Health −1']);
    assert.equal(state.water, 2);
    assert.equal(state.health, 7);
  } finally { Math.random = originalRandom; }
});

test('network blight reports cause and consequence in one event', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const state = {
      year: 8, health: 10, eventModifiers: { disease: 1 },
      neighbors: [{ species: 'Pear', relation: 70, dead: false, helpRefusedToThem: 0, helpGivenToThem: 0 }],
    };
    const events = [];
    checkAllyBetrayal(state, events, {
      computeCurrentLifeStage: () => LIFE_STAGES[3], STAGE_BY_NAME, getRelationshipState,
      recordDamage() {}, onRelationshipShift() {},
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].title, 'Network Blight');
    assert.deepEqual(events[0].effects, ['Health −2', 'Resource collection reduced']);
    assert.equal(state.health, 8);
    assert.equal(state.eventModifiers.disease, 0.7);
  } finally { Math.random = originalRandom; }
});

test('a squirrel seed reward is disclosed without changing its established probability or value', () => {
  const originalRandom = Math.random;
  const rolls = [0.99, 0.99, 0.99, 0.99, 0, 0, 0.99];
  Math.random = () => rolls.shift() ?? 0.99;
  try {
    const state = {
      flowers: 0, pollinated: 0, developing: 0, seeds: 2, nutrients: 0, water: 0, health: 8, branches: 1,
      lifeStage: LIFE_STAGES[3], eventModifiers: { rainChain: 0 }, neighbors: [], offspringTrees: 0,
    };
    const events = rollMinorEvents(state, {
      currentSeasonName: 'Spring', getPollinatorChance: value => value, species: {}, recordDamage() {}, STAGE_BY_NAME,
      getRelationshipState, getNeighborStage, random: () => 0.99, advanceAllyCrises() {}, advanceOffspringCrises() {},
      checkAllyBetrayal() {}, queueHostileTreeThreat() {}, queueChemicalDefenseThreat() {},
      computeCurrentLifeStage: () => LIFE_STAGES[3],
    });
    const squirrel = events.find(event => event.sceneArt === 'fruit-squirrel');
    assert.ok(squirrel);
    assert.deepEqual(squirrel.effects, ['Seed +1']);
    assert.equal(state.seeds, 3);
  } finally { Math.random = originalRandom; }
});

test('named wildlife and browser threats carry renderer scene metadata', () => {
  const majorEvents = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: () => {},
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState: () => {},
    updateAlliesCount: () => {},
  });
  assert.deepEqual(
    majorEvents.map(event => [event.key, event.sceneArt]),
    [
      ['Drought', 'event-drought'],
      ['Herbivores', 'browsers'],
      ['Storm', 'event-storm'],
      ['WinterStorm', 'event-winter-gale'],
      ['Fire', 'event-wildfire'],
      ['LateFrost', 'event-late-frost'],
      ['FungalBlight', 'event-fungal-blight'],
      ['Beaver', 'beaver'],
      ['MycorrhizalBloom', 'event-mycorrhizal-bloom'],
      ['BirdDispersal', 'fruit-robin'],
    ],
  );

  const browserThreat = {
    kind: 'browsers', title: 'Hungry Browsers', sceneArt: 'browsers', warning: 'Browsers approach.',
    defend: () => '', ignore: () => ({ body: '', damage: null }),
  };
  const decision = buildChemicalDefenseDecision(threatState({ sunlight: 3, water: 1, nutrients: 2 }), {
    computeCurrentLifeStage: () => LIFE_STAGES[4],
    threat: browserThreat,
  });
  assert.equal(describeDecisionPrompt(decision).sceneArt, 'browsers');
});

test('every named pollinator resolves to a production sprite family', () => {
  assert.equal(getPollinatorSceneArt('bumblebees'), 'pollinator-bumblebee');
  assert.equal(getPollinatorSceneArt('honeybees'), 'pollinator-honeybee');
  assert.equal(getPollinatorSceneArt('mason bees'), 'pollinator-mason-bee');
  assert.equal(getPollinatorSceneArt('solitary bees'), 'pollinator-mason-bee');
  assert.equal(getPollinatorSceneArt('small native bees'), 'pollinator-mason-bee');
  assert.equal(getPollinatorSceneArt('hoverflies'), 'pollinator-hoverfly');
  assert.equal(getPollinatorSceneArt('butterflies'), 'pollinator-butterfly');
  assert.equal(getPollinatorSceneArt('beetles'), 'pollinator-beetle');
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

test('a storm never reports that zero branches snapped', () => {
  const storm = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage() {},
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Storm');
  const outcome = storm.apply({
    lifeStage: LIFE_STAGES[3],
    trunk: 8,
    rootZones: 8,
    branches: 1,
    leafClusters: 2,
    health: 10,
    eventModifiers: { shelter: 0 },
  });
  assert.ok(outcome.effects.every(line => !/^0 branch/.test(line)));
  assert.match(outcome.summary, /only branch.*holds fast/i);
  assert.ok(outcome.effects.includes('No branches lost'));
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

test('stored protection persists until an eligible event prevents damage', () => {
  const engine = createEngine({
    SEASONS,
    updateUI() {},
    render() {},
  });
  const quietState = {
    health: 10,
    maxHealth: 10,
    majorEventsSurvivedInStage: 0,
    eventModifiers: { drought: 0.5, disease: 0.5, shelter: 0.25 },
  };
  engine.applyEventEffects(quietState, null, []);
  assert.equal(quietState.eventModifiers.shelter, 1, 'quiet turns preserve and normalize a legacy fractional charge');

  const unrelated = {
    health: 10,
    maxHealth: 10,
    majorEventsSurvivedInStage: 0,
    eventModifiers: { drought: 1, disease: 1, shelter: 1 },
  };
  engine.applyEventEffects(unrelated, { apply: () => ({ summary: 'Nothing tests the stored protection.', effects: [], factors: [] }) }, []);
  assert.equal(unrelated.eventModifiers.shelter, 1, 'unrelated events preserve the charge');
  assert.equal(normalizeStoredProtection(unrelated), 1);
});

test('stored protection prevents one damage from drought, storms, gales, and wildfire', () => {
  const recorded = [];
  const events = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: (amount, cause) => recorded.push({ amount, cause }),
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  });

  for (const key of ['Storm', 'WinterStorm']) {
    const state = {
      lifeStage: LIFE_STAGES[3], trunk: 0, rootZones: 0, branches: 0,
      leafClusters: 0, health: 10, eventModifiers: { shelter: 1 },
    };
    const outcome = events.find(event => event.key === key).apply(state);
    assert.equal(state.health, 7, `${key} should deal 3 instead of 4 damage`);
    assert.equal(state.eventModifiers.shelter, 0);
    assert.ok(outcome.effects.includes('Stored protection −1 damage'));
    assert.deepEqual(outcome.factors.find(factor => factor.kind === 'shelter'), { kind: 'shelter', amount: 1 });
  }

  const droughtState = {
    lifeStage: LIFE_STAGES[3], trunk: 0, taprootDepth: 0,
    health: 10, eventModifiers: { shelter: 1 },
  };
  const droughtOutcome = events.find(event => event.key === 'Drought').apply(droughtState);
  assert.equal(droughtState.health, 8);
  assert.equal(droughtState.eventModifiers.shelter, 0);
  assert.ok(droughtOutcome.effects.includes('Stored protection −1 damage'));

  const fireState = { trunk: 0, health: 10, eventModifiers: { shelter: 1 } };
  const fireOutcome = events.find(event => event.key === 'Fire').apply(fireState);
  assert.equal(fireState.health, 9);
  assert.equal(fireState.eventModifiers.shelter, 0);
  assert.ok(fireOutcome.effects.includes('Stored protection −1 damage'));

  const safeFireState = { trunk: 4, health: 10, eventModifiers: { shelter: 1 } };
  const safeFireOutcome = events.find(event => event.key === 'Fire').apply(safeFireState);
  assert.equal(safeFireState.health, 10);
  assert.equal(safeFireState.eventModifiers.shelter, 1, 'bark-only prevention should preserve the charge');
  assert.ok(!safeFireOutcome.effects.some(effect => /stored protection/i.test(effect)));
});

test('major events are restricted to ecologically appropriate seasons', () => {
  const majorEvents = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage() {},
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  });
  for (const season of SEASONS.map(entry => entry.name)) {
    for (let i = 0; i <= 20; i += 1) {
      const event = rollMajorEvent(majorEvents, season, () => i / 20);
      assert.ok(event, `${season} should have at least one major event`);
      assert.ok(event.seasons.includes(season), `${event.name} must be eligible in ${season}`);
    }
  }
  assert.deepEqual(majorEvents.find(event => event.name === 'Autumn Storm').seasons, ['Autumn']);
  assert.deepEqual(majorEvents.find(event => event.name === 'Summer Drought').seasons, ['Summer']);
  assert.deepEqual(majorEvents.find(event => event.name === 'Late Frost').seasons, ['Spring']);
});

test('thorns and toxic leaves explicitly blunt herbivore surges', () => {
  const recorded = [];
  const herbivores = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: (amount, cause) => recorded.push({ amount, cause }),
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Herbivores');
  const defended = threatState({ thornDefense: 1, toxicLeaves: 1, leafClusters: 4, health: 8 });
  const outcome = herbivores.apply(defended);
  assert.deepEqual(getHerbivoreDefense(defended), { thorns: 1, toxins: 1, total: 2 });
  assert.equal(defended.leafClusters, 4);
  assert.equal(defended.health, 8);
  assert.deepEqual(recorded, []);
  assert.match(outcome.summary, /thorns/i);
  assert.match(outcome.summary, /toxic foliage/i);
  assert.match(outcome.summary, /before they can feed/i);
  assert.deepEqual(outcome.effects, ['No leaf clusters lost', 'Defenses blocked 2 browsing pressure']);
  assert.deepEqual(outcome.factors.find(factor => factor.kind === 'leaf-floor'), { kind: 'leaf-floor', amount: 0 });
});

test('herbivore surge explains final-leaf grazing without crediting imaginary defenses', () => {
  const recorded = [];
  const herbivores = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: (amount, cause) => recorded.push({ amount, cause }),
    getDroughtResistance: () => 0,
    getRelationshipState,
    updateNeighborAliveState() {},
    updateAlliesCount() {},
  }).find(event => event.key === 'Herbivores');
  const exposed = threatState({ thornDefense: 0, toxicLeaves: 0, leafClusters: 1, health: 8 });
  const outcome = herbivores.apply(exposed);
  assert.equal(exposed.leafClusters, 1);
  assert.equal(exposed.health, 7);
  assert.deepEqual(recorded, [{ amount: 1, cause: 'herbivores' }]);
  assert.match(outcome.summary, /no thorns or toxic foliage/i);
  assert.match(outcome.summary, /final leaf cluster.*survives/i);
  assert.doesNotMatch(outcome.summary, /established defenses turn/i);
  assert.deepEqual(outcome.effects, ['No leaf clusters lost', 'Health −1']);
  assert.deepEqual(outcome.factors.find(factor => factor.kind === 'leaf-floor'), { kind: 'leaf-floor', amount: 1 });
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

test('rare neighbor hostility only establishes shade when the neighbor is taller', () => {
  const shorter = { slot: 1, species: 'Plum', relation: 0, stageScore: 300, heightGrowth: 0, dead: false };
  const taller = { slot: 3, species: 'Pear', relation: 0, stageScore: 600, heightGrowth: 0, dead: false };
  const state = { lifeStage: LIFE_STAGES[2], heightGrowth: 1, neighbors: [shorter, taller] };
  const rolls = [0, 0.99];
  const escalation = maybeEscalateCanopyHostility(state, {
    getRelationshipState,
    getNeighborStage,
    random: () => rolls.shift(),
    chance: 0.05,
  });
  assert.equal(escalation.neighbor, taller);
  assert.equal(escalation.newState, 'Hostile');
  assert.equal(escalation.canCrowd, true);
  assert.equal(taller.shadingPlayer, true);
  assert.match(escalation.event.text, /Grow Taller|diplomacy/);

  const lowState = { lifeStage: LIFE_STAGES[2], heightGrowth: 2, neighbors: [{ ...shorter }] };
  const failedShade = maybeEscalateCanopyHostility(lowState, {
    getRelationshipState,
    getNeighborStage,
    random: () => 0,
    chance: 0.05,
  });
  assert.equal(failedShade.canCrowd, false);
  assert.equal(failedShade.neighbor.shadingPlayer, false);
});

test('successful diplomacy ends hostile canopy pressure', () => {
  const neighbor = { slot: 1, species: 'Pear', relation: -60, stageScore: 600, heightGrowth: 1, dead: false, shadingPlayer: true };
  const state = { lifeStage: LIFE_STAGES[2], heightGrowth: 0, sunlight: 10, water: 10, nutrients: 10, rootZones: 3 };
  const outcome = resolveHostileEncroachmentChoice(state, neighbor, 'diplomacy', {
    getRelationshipState,
    getNeighborStage,
    applyRelationshipDelta: (target, delta) => { target.relation = Math.max(-100, Math.min(100, target.relation + delta)); },
    random: () => 0,
  });
  assert.equal(outcome.title, 'Diplomacy Succeeded');
  assert.equal(outcome.newState, 'Neutral');
  assert.equal(neighbor.shadingPlayer, false);
});

test('a shorter rival can still attack through its roots when it cannot shade the canopy', () => {
  const neighbor = { slot: 1, species: 'Apricot', relation: -35, stageScore: 300, heightGrowth: 0, dead: false };
  const state = { lifeStage: LIFE_STAGES[4], heightGrowth: 2, sunlight: 6, water: 6, nutrients: 6 };
  const decision = buildHostileEncroachmentDecision(state, neighbor, {
    getRelationshipState,
    getNeighborStage,
    compareConflictPower: () => ({ yourPower: 6, theirPower: 2 }),
  });
  assert.equal(decision.meta.canCrowdCanopy, false);
  assert.match(decision.body, /root zone/i);
  assert.match(describeDecisionPrompt(decision).text, /cannot overtop you.*roots/i);
  const outcome = resolveHostileEncroachmentChoice(state, neighbor, 'endure', { getRelationshipState, getNeighborStage });
  assert.equal(neighbor.shadingPlayer, false);
  assert.equal(state.sunlight, 6);
  assert.equal(state.nutrients, 4);
  assert.match(outcome.body, /cannot overtop you/i);
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
  const protectedOutcome = fire.apply(protectedState);
  assert.equal(protectedState.health, 10);
  assert.deepEqual(recorded, []);
  assert.match(protectedOutcome.summary, /thick bark.*holds back the flames/i);
  assert.deepEqual(protectedOutcome.effects, ['No health lost']);

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
  const childrenOutcome = bloom.apply(childrenOnly);
  assert.deepEqual(childrenOutcome.effects, ['Nutrients +3']);
  assert.doesNotMatch(childrenOutcome.summary, /allies/i);
  assert.equal(childrenOnly.nutrients, 3);

  const connectedAlly = {
    nutrients: 0,
    allies: 1,
    neighbors: [{ relation: 70, dead: false }],
  };
  const allyOutcome = bloom.apply(connectedAlly);
  assert.deepEqual(allyOutcome.effects, ['Nutrients +4']);
  assert.match(allyOutcome.summary, /connected allies strengthen/i);
  assert.equal(connectedAlly.nutrients, 4);
});
