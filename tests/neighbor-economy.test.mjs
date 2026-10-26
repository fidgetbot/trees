import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceNeighborEcology, applyNeighborAid, collectNeighborDonations, enrichNeighborRhizosphere, neighborGrowthFactor, neighborHelpAvailable, rhizosphereNutrientSupport } from '../core/neighbor-economy.js';
import { buildHelpRequestDecision, resolveHelpRequestFromAlly } from '../core/diplomacy.js';
import { buildIncidentDecision, resolveIncidentDecision } from '../core/incident-responses.js';
import { openEventIncident, assertSerializableIncidentState } from '../core/incidents.js';
import { advanceNeighborDeathCycle } from '../core/neighbors.js';
import { getNeighborStage, getRelationshipState } from '../core/constants.js';

const deps = { getNeighborStage, getRelationshipState, random: () => 1 };
function tree(relation = 70, overrides = {}) {
  return { slot: 1, species: 'Pear', stageScore: 3300, relation, health: 10, maxHealth: 10, dead: false, reserves: { water: 12, nutrients: 12 }, activeCrises: [], ...overrides };
}
function grove(neighbors) { return { neighbors, turnsElapsed: 0, water: 10, nutrients: 10, health: 5, maxHealth: 10 }; }
function tick(s, options = {}) { s.turnsElapsed++; return advanceNeighborEcology(s, { ...deps, ...options }); }

test('all dispositions share stress, warned decline, recovery and death rules', () => {
  const s = grove([tree(70), tree(0, { slot: 3 }), tree(-70, { slot: 4 })]);
  let firstWarning = null, firstDamage = null;
  for (let turn = 1; turn <= 22; turn++) {
    const events = tick(s, { majorKey: 'Drought' });
    if (events.some(e => e.effect === 'warning') && !firstWarning) firstWarning = turn;
    if (s.neighbors[0].health < 10 && !firstDamage) firstDamage = turn;
    assert.deepEqual(s.neighbors.map(n => n.health), Array(3).fill(s.neighbors[0].health));
    assert.deepEqual(s.neighbors.map(n => n.reserves.water), Array(3).fill(s.neighbors[0].reserves.water));
  }
  assert.ok(firstWarning < firstDamage);
  assert.ok(s.neighbors.every(n => n.dead && n.deathCause === 'prolonged resource shortage'));
});

test('healthy established allies sustain themselves and isolated stress recovers without player rescue', () => {
  const s = grove([tree()]);
  for (let turn = 0; turn < 80; turn++) {
    collectNeighborDonations(s, getRelationshipState, getNeighborStage);
    tick(s, { majorKey: turn === 20 ? 'Drought' : undefined });
    assert.equal(s.neighbors[0].health, 10);
    assert.equal(s.neighbors[0].dead, false);
  }
  assert.equal(s.neighbors[0].activeCrises.length, 0);
  assert.equal(neighborGrowthFactor(s.neighbors[0]), 1);
});

test('enriched allied soil adds nutrients and prevents Lean soil while other trees can suffer it', () => {
  const ally = tree(70, { species: 'Pear', reserves: { sunlight: 12, water: 12, nutrients: 2 } });
  const neutral = tree(0, { slot: 3, species: 'Cherry', reserves: { sunlight: 12, water: 12, nutrients: 4 } });
  enrichNeighborRhizosphere(ally);
  assert.equal(ally.reserves.nutrients, 4);
  assert.equal(rhizosphereNutrientSupport(ally), 1);
  const s = grove([ally, neutral]);
  const events = tick(s, { majorKey: 'FungalBlight' });
  assert.equal(ally.reserves.nutrients, 4);
  assert.equal(ally.activeCrises.some(crisis => crisis.title === 'Lean soil'), false);
  const leanSoil = events.find(event => event.title === 'Cherry: Lean soil');
  assert.ok(leanSoil);
  assert.match(leanSoil.text, /enriched rhizosphere keeps the Pear supplied despite the lean soil/i);
});

test('passive and requested aid debit the same reserve and cannot invade its survival buffer', () => {
  const n = tree(), s = grove([n]);
  const passive = collectNeighborDonations(s, getRelationshipState, getNeighborStage);
  const decision = buildHelpRequestDecision(s, { ...deps, requestKind: 'nutrients' });
  const advertised = neighborHelpAvailable(s, n, 'nutrients', getNeighborStage);
  assert.ok(decision.options[0].label.includes(String(advertised)));
  const received = resolveHelpRequestFromAlly(s, n, { ...deps, requestKind: 'nutrients' });
  assert.equal(received.actualAmount, advertised);
  assert.equal(n.reserves.nutrients, 12 - passive.nutrients - received.actualAmount);
  assert.equal(n.reserves.nutrients, 6);
  const before = structuredClone(s);
  assert.equal(resolveHelpRequestFromAlly(s, n, { ...deps, requestKind: 'nutrients' }).actualAmount, 0);
  assert.deepEqual(s, before);
  assert.equal(buildHelpRequestDecision(s, { ...deps, requestKind: 'nutrients' }).options[0].disabled, true);
});

test('a nutrient-starved donor can offer spare water, but not nutrients or recovery aid', () => {
  const n = tree(70, { reserves: { water: 16, nutrients: 0 }, health: 3 });
  const s = grove([n]);
  tick(s, { majorKey: 'FungalBlight' });
  assert.equal(neighborHelpAvailable(s, n, 'nutrients', getNeighborStage), 0);
  assert.equal(neighborHelpAvailable(s, n, 'health', getNeighborStage), 0);
  assert.ok(neighborHelpAvailable(s, n, 'water', getNeighborStage) > 0);
  assert.equal(neighborGrowthFactor(n), 0);
  const healthy = tree();
  const result = resolveHelpRequestFromAlly(s, healthy, { ...deps, requestKind: 'health' });
  assert.equal(healthy.reserves.water, 12 - result.actualHeal);
  assert.equal(healthy.reserves.nutrients, 12 - result.actualHeal);
});

test('partial aid buys actual time, while inability or refusal does not invent damage or resentment', () => {
  for (const choice of ['partial', 'give', 'withhold']) {
    const n = tree(70, { reserves: { water: 0, nutrients: 12 }, strains: { water: 6, nutrients: 0 } });
    const s = grove([n]);
    const event = tick(s).find(e => e.response);
    const incident = openEventIncident(s, event);
    n.shortageTurns = 5;
    s.water = choice === 'give' ? 0 : 5;
    const decision = buildIncidentDecision(s, incident, deps);
    const relationBefore = n.relation, amountBefore = n.activeCrises[0].amount, healthBefore = n.health;
    resolveIncidentDecision(s, incident, decision, choice, { ...deps, applyRelationshipDelta: (target, delta) => { target.relation += delta; } });
    if (choice === 'partial') {
      assert.equal(n.reserves.water, 3);
      assert.equal(s.water, 2);
      assert.ok(n.activeCrises[0].amount < amountBefore);
      tick(s); tick(s);
      assert.equal(n.health, healthBefore);
    } else {
      assert.equal(n.relation, relationBefore);
      assert.equal(n.activeCrises[0].amount, amountBefore);
      assert.equal(n.health, healthBefore);
    }
  }
});

test('ecology ticks once per turn, reasks no more than every three turns, and survives serialization', () => {
  let s = grove([tree(70, { reserves: { water: 0, nutrients: 12 }, strains: { water: 6, nutrients: 0 } })]);
  const first = tick(s).find(e => e.response);
  const incident = openEventIncident(s, first);
  const before = structuredClone(s);
  assert.deepEqual(advanceNeighborEcology(s, deps), []);
  assert.deepEqual(s, before);
  s = JSON.parse(JSON.stringify(s));
  assert.equal(assertSerializableIncidentState(s), true);
  assert.equal(tick(s).filter(e => e.response).length, 0);
  assert.equal(tick(s).filter(e => e.response).length, 0);
  const repeat = tick(s).find(e => e.response);
  assert.equal(repeat.existingIncidentId, incident.id);
  applyNeighborAid(s.neighbors[0], 'water', 12);
  tick(s);
  // An aid action may clear the shortage before its next ecological tick.
  assert.equal(s.neighbors[0].activeCrises.length, 0);
  assert.equal(s.incidents.find(i => i.id === incident.id).state, 'resolved');
});

test('succession removes the former tree’s shortages, aid history and depleted reserves', () => {
  const n = tree(-70, { dead: true, deathAge: 6, reserves: { water: 0, nutrients: 0 }, strains: { water: 4, nutrients: 4 }, shortageTurns: 12, aidGrace: 2, growthAidReceived: 8 });
  advanceNeighborDeathCycle(n, { speciesNames: ['Cherry'], seedlingThreshold: 200, random: () => 0 });
  assert.equal(n.dead, false);
  assert.equal(n.species, 'Cherry');
  assert.equal(n.relation, 0);
  assert.deepEqual(n.reserves, { sunlight: 12, water: 12, nutrients: 12 });
  assert.equal(n.shortageTurns, 0);
  assert.equal(n.growthAidReceived, 0);
});

test('resolving and relapsing a shortage cannot bypass the request cooldown', () => {
  const n = tree(70, { reserves: { water: 0, nutrients: 12 }, strains: { water: 6, nutrients: 0 } }), s = grove([n]);
  const event = tick(s).find(e => e.response);
  openEventIncident(s, event);
  applyNeighborAid(n, 'water', 4);
  assert.equal(n.activeCrises.length, 0);
  assert.equal(tick(s).filter(e => e.response).length, 0);
  assert.equal(tick(s).filter(e => e.response).length, 0);
  assert.equal(tick(s).filter(e => e.response).length, 1);
});

test('passive support does not drain a donor when the recipient has no room', () => {
  const n = tree(), s = grove([n]);
  const gains = collectNeighborDonations(s, getRelationshipState, getNeighborStage, {water:0,nutrients:0});
  assert.deepEqual(gains, {water:0,nutrients:0});
  assert.deepEqual(n.reserves, {sunlight:12,water:12,nutrients:12});
});

test('passive support preserves useful explicit offers and sunlight can be requested', () => {
  const n = tree(70, { reserves: { sunlight: 16, water: 16, nutrients: 16 } });
  const s = grove([n]);
  s.sunlight = 0;
  collectNeighborDonations(s, getRelationshipState, getNeighborStage);
  assert.ok(neighborHelpAvailable(s, n, 'water', getNeighborStage) >= 4);
  assert.ok(neighborHelpAvailable(s, n, 'nutrients', getNeighborStage) >= 4);
  const decision = buildHelpRequestDecision(s, deps);
  assert.equal(decision.options.length, 4);
  assert.equal(decision.body, '');
  assert.ok(decision.options.every(option => option.group === 'Pear Ally'));
  assert.match(decision.options[0].groupDescription, /^Health 10\/10 · reserves /);
  const sunlight = decision.options.find(option => option.meta.requestKind === 'sunlight');
  assert.ok(sunlight.affordable);
  assert.match(sunlight.label, /^☀️ Sunlight — \d+ sunlight available to share$/);
  assert.equal(sunlight.description, null);
  const blockedDecision = buildHelpRequestDecision(grove([tree(70, { reserves: { sunlight: 0, water: 0, nutrients: 0 } })]), deps);
  const health = blockedDecision.options.find(option => option.meta.requestKind === 'health');
  assert.match(health.label, /^❤️ Health — cannot spare health$/);
  assert.match(health.description, /Its own health needs come first/);
  const before = s.sunlight;
  const received = resolveHelpRequestFromAlly(s, n, { ...deps, requestKind: 'sunlight' });
  assert.equal(s.sunlight, before + received.actualAmount);
});

test('sunlight shortages can produce ally aid requests', () => {
  const n = tree(70, { reserves: { sunlight: 0, water: 12, nutrients: 12 }, strains: { sunlight: 4, water: 0, nutrients: 0 } });
  const s = grove([n]);
  const request = tick(s).find(event => event.response?.kind === 'ally-aid');
  assert.equal(n.activeCrises[0].kind, 'sunlight');
  assert.match(request.title, /Dimmed crown/);
});
