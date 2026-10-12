import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChemicalDefenseDecision, describeDecisionPrompt, processSeasonalReproduction, resolveChemicalDefenseChoice, resolvePendingStartOfTurnEffects } from '../core/events.js';
import { resolveHelpRequestFromAlly } from '../core/diplomacy.js';
import { getNeighborStage, getRelationshipState } from '../core/constants.js';
import { assertSerializableIncidentState, awaitIncidentResponse, findActiveIncident, incidentSceneArtKinds, keepIncidentOngoing, openEventIncident, openIncident, queuedResponseIncidents, resolveIncident } from '../core/incidents.js';
import { buildIncidentDecision, resolveIncidentDecision } from '../core/incident-responses.js';
import { renderEventPhaseBody } from '../ui/events.js';

function state(overrides = {}) {
  return {
    sunlight: 8, water: 8, nutrients: 8, health: 5, maxHealth: 10, defense: 0, fruitDefense: 0,
    leafClusters: 3, rootZones: 3, developing: 0, eventModifiers: { disease: 0 },
    incidents: [], responseQueue: [], nextIncidentId: 1, turnsElapsed: 0, ...overrides,
  };
}

function ally() {
  return { species: 'Citrus', relation: 70, stageScore: 3500, helpGivenToThem: 2, helpRefusedToThem: 0, timesAskedThemForHelp: 0, helpReceivedFromThem: 0 };
}

function openChemicalIncident(s, decision, { awaiting = true } = {}) {
  const prompt = describeDecisionPrompt(decision);
  return openEventIncident(s, {
    ...prompt, kind: 'chemical-threat', state: awaiting ? 'awaiting-response' : 'ongoing',
    responseMode: awaiting ? 'immediate' : 'action-window',
    response: awaiting ? { kind: 'chemical-defense', threatKey: decision.meta.threatKey } : null,
    deadlineTurn: s.turnsElapsed + 1, scenePersistent: true, meta: { threatKey: decision.meta.threatKey },
  });
}

test('chemical defense is one serializable incident from warning through resolution', () => {
  const s = state();
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat: 'aphids' });
  const incident = openChemicalIncident(s, decision);
  assert.equal(incident.title, 'Aphid Cluster');
  assert.equal(s.responseQueue.length, 1);
  assert.equal(assertSerializableIncidentState(s), true);
  const outcome = resolveChemicalDefenseChoice(s, decision, 'defend');
  resolveIncident(s, incident.id, { title: outcome.title, summary: outcome.body });
  assert.equal(outcome.threatStatus, 'solved');
  assert.equal(incident.state, 'resolved');
  assert.deepEqual(s.responseQueue, []);
  assert.deepEqual(incidentSceneArtKinds(s), []);
});

test('the shared response resolver is used by serial incident decisions', () => {
  const s = state();
  const original = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat: 'aphids' });
  const incident = openChemicalIncident(s, original);
  const decision = buildIncidentDecision(s, incident, { computeCurrentLifeStage: () => ({ name: 'Seedling' }) });
  const outcome = resolveIncidentDecision(s, incident, decision, 'defend', { recordDamage: () => {} });
  assert.equal(outcome.threatStatus, 'solved');
  assert.equal(incident.state, 'resolved');
});

test('incident serialization rejects callback state', () => {
  const s = state();
  s.incidents.push({ id: 'malformed', kind: 'bad-test-record', state: 'ongoing', meta: { callback: () => {} } });
  assert.equal(assertSerializableIncidentState(s), false);
});

test('an ongoing crisis reuses its incident identity when it asks again', () => {
  const s = state();
  const incident = openIncident(s, { kind: 'offspring-aid', title: 'Cherry offspring: Dry roots', summary: 'Leaves droop.', artwork: 'event-drought', response: { kind: 'offspring-aid', childId: 7, crisisId: 'dry-1' } });
  keepIncidentOngoing(s, incident.id, { summary: 'The crisis continues.' });
  awaitIncidentResponse(s, incident.id, { summary: 'The crisis is deepening.', response: incident.response });
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].id, incident.id);
  assert.equal(s.incidents[0].state, 'awaiting-response');
  assert.deepEqual(s.responseQueue, [incident.id]);
});

test('multiple immediate incidents share one ordered response queue', () => {
  const s = state();
  const first = openIncident(s, { kind: 'offspring-aid', title: 'Dry roots', response: { kind: 'offspring-aid', childId: 1, crisisId: 'a' } });
  const second = openIncident(s, { kind: 'human-encounter', title: 'Humans at Your Trunk', response: { kind: 'human-encounter' }, meta: { encounter: { phase: 'survey', count: 2 } } });
  assert.deepEqual(queuedResponseIncidents(s).map(incident => incident.id), [first.id, second.id]);
  resolveIncident(s, first.id, { summary: 'Aid sent.' });
  assert.deepEqual(queuedResponseIncidents(s).map(incident => incident.id), [second.id]);
});

test('an unaffordable chemical threat renders as one ongoing journal row', () => {
  const s = state({ sunlight: 0, water: 1, nutrients: 2 });
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat: 'aphids' });
  const prompt = describeDecisionPrompt(decision);
  const incident = openChemicalIncident(s, decision, { awaiting: false });
  assert.deepEqual(decision.options.map(option => option.id), ['conserve']);
  assert.equal(prompt.status, 'Defense requires ☀️3 more.');
  const body = renderEventPhaseBody({ incidents: [incident], pendingResponses: 0 });
  assert.equal((body.match(/Aphid Cluster/g) || []).length, 1);
  assert.match(body, /journal-incident/);
  assert.match(body, /Ongoing/);
  assert.match(body, /data-scene-art="aphids"/);
});

test('fungal chemical threats retain distinct artwork through the incident flow', () => {
  const seedling = buildChemicalDefenseDecision(state(), { computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat: 'damp-rot' });
  assert.equal(openChemicalIncident(state(), seedling).artwork, 'damp-rot');
  const mature = buildChemicalDefenseDecision(state(), { computeCurrentLifeStage: () => ({ name: 'Mature Tree' }), threat: 'airborne-spores' });
  assert.equal(openChemicalIncident(state(), mature).artwork, 'airborne-spores');
});

test('hungry browsers recognize permanent thorns and toxic leaves without another resource cost', () => {
  const s = state({ thornDefense: 1, toxicLeaves: 1, developing: 2 });
  const before = { sunlight: s.sunlight, water: s.water, nutrients: s.nutrients, leafClusters: s.leafClusters, developing: s.developing };
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Young Tree' }), threat: 'browsers' });
  const outcome = resolveChemicalDefenseChoice(s, decision, 'use-permanent-defenses');
  assert.equal(outcome.threatStatus, 'solved');
  assert.match(outcome.body, /no foliage or fruit is lost/i);
  assert.deepEqual({ sunlight: s.sunlight, water: s.water, nutrients: s.nutrients, leafClusters: s.leafClusters, developing: s.developing }, before);
});

test('an unanswered chemical incident reports its final damaging conclusion once', () => {
  const s = state({ lifeStage: { name: 'Seedling' } });
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => s.lifeStage, threat: 'aphids' });
  const incident = openChemicalIncident(s, decision, { awaiting: false });
  keepIncidentOngoing(s, incident.id);
  s.turnsElapsed = 1;
  const [conclusion] = resolvePendingStartOfTurnEffects(s);
  assert.match(conclusion.body, /danger has passed, though it left damage behind/i);
  assert.equal(incident.state, 'resolved');
  assert.equal(incident.meta.reportPending, true);
});

test('ally help clears an active aphid incident as well as restoring health', () => {
  const s = state();
  const aphids = openIncident(s, { kind: 'chemical-threat', title: 'Aphid Cluster', summary: 'Aphids are feeding.', artwork: 'aphids', state: 'ongoing', responseMode: 'action-window', scenePersistent: true, meta: { threatKey: 'aphids' } });
  const bird = openIncident(s, { kind: 'wildlife', title: 'Woodpecker', summary: 'A bird remains nearby.', artwork: 'woodpecker', state: 'ongoing', scenePersistent: true });
  const outcome = resolveHelpRequestFromAlly(s, ally(), { getRelationshipState, getNeighborStage, random: () => 0 });
  assert.equal(outcome.clearedThreat.title, 'Aphid Cluster');
  assert.equal(aphids.state, 'resolved');
  assert.deepEqual(incidentSceneArtKinds(s), [bird.artwork]);
  assert.ok(outcome.actualHeal > 0);
});

test('a fruit threat persists as one incident until a later event phase', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state({ developing: 2, selectedSpecies: 'Plum' });
    const warningEvents = [];
    processSeasonalReproduction(s, warningEvents, () => 'Summer');
    const incident = openEventIncident(s, warningEvents[0]);
    assert.equal(incident.kind, 'fruit-threat');
    assert.equal(incident.state, 'ongoing');
    assert.equal(s.developing, 2);
    s.defense = 2;
    Math.random = () => 0.99;
    const resolutionEvents = [];
    processSeasonalReproduction(s, resolutionEvents, () => 'Autumn');
    assert.equal(incident.state, 'resolved');
    assert.equal(resolutionEvents[0].existingIncidentId, incident.id);
    assert.match(resolutionEvents[0].text, /danger to this season's fruit has passed/i);
  } finally { Math.random = originalRandom; }
});

test('resolving a fruit incident does not replace it in the same summer phase', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const s = state({ developing: 2, selectedSpecies: 'Plum' });
    openIncident(s, { kind: 'fruit-threat', title: 'Fruit-Watching Birds', summary: 'Birds gather.', artwork: 'fruit-robin', state: 'ongoing', responseMode: 'action-window', scenePersistent: true, meta: { threatType: 'bird' } });
    const events = [];
    processSeasonalReproduction(s, events, () => 'Summer');
    assert.equal(events.length, 1);
    assert.equal(findActiveIncident(s, 'fruit-threat'), null);
  } finally { Math.random = originalRandom; }
});

test('fruit warning and resolution retain artwork and incident identity', () => {
  const originalRandom = Math.random;
  Math.random = () => 0.4;
  try {
    const s = state({ developing: 2, selectedSpecies: 'Plum' });
    const warnings = [];
    processSeasonalReproduction(s, warnings, () => 'Summer');
    const incident = openEventIncident(s, warnings[0]);
    assert.equal(incident.artwork, 'fruit-robin');
    Math.random = () => 0.99;
    const resolution = [];
    processSeasonalReproduction(s, resolution, () => 'Autumn');
    assert.equal(resolution[0].sceneArt, incident.artwork);
    assert.equal(resolution[0].existingIncidentId, incident.id);
  } finally { Math.random = originalRandom; }
});

test('tree crises compose the target portrait with a shared condition specimen', () => {
  const s = state();
  const incident = openEventIncident(s, {
    title: 'Cherry offspring: Dry roots',
    text: 'Its leaves are drooping from thirst.',
    effect: 'warning',
    subject: { type: 'offspring', id: 4, species: 'Cherry', stageName: 'Seedling' },
  });
  assert.deepEqual(incident.artwork, ['tree:Cherry:Seedling', 'event-drought']);
  assert.equal(assertSerializableIncidentState(s), true);
});

test('every normalized incident receives artwork and renders exactly once', () => {
  const s = state();
  const incidents = [
    openEventIncident(s, { text: 'A quiet scent passes through the grove.', effect: 'flavor' }),
    openEventIncident(s, { text: 'Rain gathers in your roots. (+2 water)', effect: 'rain' }),
    openEventIncident(s, { text: 'A woodpecker drums, then dislodges pests. (+1 nutrient)', effect: 'nutrients', sceneArt: 'woodpecker' }),
  ];
  assert.ok(incidents.every(incident => incident.artwork));
  const body = renderEventPhaseBody({ incidents, pendingResponses: 0 });
  for (const incident of incidents) assert.equal((body.match(new RegExp(`data-incident-id="${incident.id}"`, 'g')) || []).length, 1);
  assert.equal((body.match(/data-scene-art="woodpecker"/g) || []).length, 1);
});
