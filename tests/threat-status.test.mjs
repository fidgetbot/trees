import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChemicalDefenseDecision, describeDecisionPrompt, expireUnpollinatedFlowersOutsideSpring, processSeasonalReproduction, resolveChemicalDefenseChoice, resolvePendingStartOfTurnEffects, resolveUnanswerableChemicalThreat } from '../core/events.js';
import { resolveHelpRequestFromAlly } from '../core/diplomacy.js';
import { getNeighborStage, getRelationshipState } from '../core/constants.js';
import { assertSerializableIncidentState, awaitIncidentResponse, findActiveIncident, incidentSceneArtKinds, keepIncidentOngoing, openEventIncident, openIncident, openMajorIncident, queuedResponseIncidents, resolveIncident } from '../core/incidents.js';
import { buildIncidentDecision, resolveIncidentDecision } from '../core/incident-responses.js';
import { renderEventPhaseBody, renderFungalRumorBody, renderIncidentOutcomeBody } from '../ui/events.js';

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

test('unpollinated flowers expire outside Spring and cannot become fruit later', () => {
  const s = state({ flowers: 4, pollinated: 0, developing: 0 });
  assert.equal(expireUnpollinatedFlowersOutsideSpring(s, 'Spring'), 0);
  assert.equal(s.flowers, 4);
  const events = [];
  processSeasonalReproduction(s, events, () => 'Summer');
  assert.equal(s.flowers, 0);
  assert.equal(s.pollinated, 0);
  assert.equal(s.developing, 0);
});

test('fungal plotline chapters have dedicated escaped narrative markup', () => {
  const body = renderFungalRumorBody({ body: 'A signal <fades> beyond the roots.', presentation: 'ominous' });
  assert.match(body, /fungal-rumor-ominous/);
  assert.match(body, /A signal &lt;fades&gt; beyond the roots\./);
  assert.doesNotMatch(body, /journal-incident/);
});

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
  const refreshed = buildIncidentDecision(s, incident, { computeCurrentLifeStage: () => ({ name: 'Seedling' }) });
  const outcome = resolveIncidentDecision(s, incident, refreshed, 'defend', { recordDamage() {} });
  assert.equal(outcome.threatStatus, 'solved');
  assert.equal(incident.state, 'resolved');
  assert.deepEqual(s.responseQueue, []);
  assert.deepEqual(incidentSceneArtKinds(s), []);
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

test('the night journal gives each immediate encounter one response pill and no redundant response notices', () => {
  const s = state();
  const aphids = openIncident(s, {
    kind: 'chemical-threat', title: 'Aphid Cluster', summary: 'Tiny aphids gather on your tender stem.',
    effects: ['A response is available.'], response: { kind: 'chemical-defense', threatKey: 'aphids' },
  });
  const dryRoots = openIncident(s, {
    kind: 'offspring-aid', title: 'Dry roots', summary: 'A young tree asks for water.',
    response: { kind: 'offspring-aid', childId: 1, crisisId: 'dry-1' },
  });
  const body = renderEventPhaseBody({ incidents: [aphids, dryRoots], pendingResponses: 2 });
  assert.equal((body.match(/A response is available\./g) || []).length, 2);
  assert.doesNotMatch(body, /Needs response|encounters? needs? your response/);
  assert.equal((body.match(/class="incident-effect"/g) || []).length, 2);
});

test('major outcomes render narrative as prose and only atomic results as pills', () => {
  const s = state();
  const incident = openMajorIncident(s, {
    key: 'Herbivores', name: 'Herbivore Surge', desc: 'Hungry mouths descend on your foliage.',
    sceneArt: 'browsers', severity: 'bad',
  }, {
    summary: 'The browsers graze your final leaf cluster; it survives, but tender tissue is damaged.',
    effects: ['No leaf clusters lost', 'Health −1'],
    factors: [{ kind: 'leaf-floor', amount: 1 }],
  });
  const body = renderEventPhaseBody({ incidents: [incident] });
  assert.match(body, /Hungry mouths descend on your foliage/);
  assert.match(body, /incident-outcome-summary[^>]*>The browsers graze your final leaf cluster/);
  assert.equal((body.match(/class="incident-effect"/g) || []).length, 2);
  assert.doesNotMatch(body, /incident-effect">The browsers graze/);
  assert.deepEqual(incident.outcome.factors, [{ kind: 'leaf-floor', amount: 1 }]);
  assert.equal(assertSerializableIncidentState(s), true);
});

test('minor-event parenthetical deltas appear once as effects instead of duplicated prose', () => {
  const s = state();
  const incident = openEventIncident(s, { text: 'A passing rain shower refreshed the soil. (+2 water)', effect: 'rain' });
  assert.equal(incident.summary, 'A passing rain shower refreshed the soil.');
  assert.deepEqual(incident.effects, ['+2 water']);
  const body = renderEventPhaseBody({ incidents: [incident] });
  assert.equal((body.match(/\+2 water/g) || []).length, 1);
});

test('an unaffordable chemical threat resolves in its only journal row', () => {
  const s = state({ sunlight: 0, water: 1, nutrients: 2 });
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => ({ name: 'Seedling' }), threat: 'damp-rot' });
  assert.deepEqual(decision.options.map(option => option.id), ['conserve']);
  const event = resolveUnanswerableChemicalThreat(s, decision);
  const incident = openEventIncident(s, event);
  assert.equal(s.health, 3);
  assert.deepEqual(event.effects, ['−2 health']);
  assert.match(event.text, /soil around you stays too wet/i);
  assert.match(event.text, /damp rot spreads/i);
  assert.equal(incident.state, 'resolved');
  assert.equal(incident.responseMode, 'none');
  assert.deepEqual(s.responseQueue, []);
  const body = renderEventPhaseBody({ incidents: [incident], pendingResponses: 0 });
  assert.equal((body.match(/Damp Rot/g) || []).length, 1);
  assert.match(body, /journal-incident/);
  assert.doesNotMatch(body, /Ongoing|Needs response|Earlier warning|What happened/);
  assert.match(body, /data-scene-art="damp-rot"/);
  assert.deepEqual(resolvePendingStartOfTurnEffects(s), []);
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

test('a deliberately conserved chemical incident reports its later damaging conclusion once', () => {
  const s = state({ lifeStage: { name: 'Seedling' } });
  const decision = buildChemicalDefenseDecision(s, { computeCurrentLifeStage: () => s.lifeStage, threat: 'surface-crawlers' });
  const incident = openChemicalIncident(s, decision, { awaiting: false });
  keepIncidentOngoing(s, incident.id);
  s.turnsElapsed = 1;
  const [conclusion] = resolvePendingStartOfTurnEffects(s);
  assert.match(conclusion.body, /danger has passed, though it left damage behind/i);
  assert.equal(incident.state, 'resolved');
  assert.equal(incident.meta.reportPending, true);
  const body = renderIncidentOutcomeBody(conclusion);
  assert.match(body, /data-incident-id="incident-1"/);
  assert.match(body, /Earlier warning/);
  assert.match(body, /Small insects swarm the soil surface/);
  assert.match(body, /What happened/);
  assert.match(body, /lose 1 root zone and 1 health/);
  assert.match(body, /data-incident-id="incident-1"[\s\S]*Earlier warning[\s\S]*What happened/);
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
  try {
    for (const [roll, artwork] of [[0, 'human-surveyor'], [0.4, 'fruit-robin']]) {
      Math.random = () => roll;
      const s = state({ developing: 2, selectedSpecies: 'Plum' });
      const warningEvents = [];
      processSeasonalReproduction(s, warningEvents, () => 'Summer');
      const incident = openEventIncident(s, warningEvents[0]);
      assert.equal(incident.kind, 'fruit-threat');
      assert.equal(incident.artwork, artwork);
      assert.equal(incident.state, 'ongoing');
      assert.equal(s.developing, 2);
      s.defense = 2;
      Math.random = () => 0.99;
      const resolutionEvents = [];
      processSeasonalReproduction(s, resolutionEvents, () => 'Autumn');
      assert.equal(incident.state, 'resolved');
      assert.equal(resolutionEvents[0].existingIncidentId, incident.id);
      assert.equal(resolutionEvents[0].sceneArt, incident.artwork);
      assert.match(resolutionEvents[0].text, /danger to this season's fruit has passed/i);
    }
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
    openEventIncident(s, { text: 'Rain gathers in your roots. (+2 water)', effect: 'rain' }),
    openEventIncident(s, { text: 'A woodpecker drums, then dislodges pests. (+1 nutrient)', effect: 'nutrients', sceneArt: 'woodpecker' }),
  ];
  assert.ok(incidents.every(incident => incident.artwork));
  const body = renderEventPhaseBody({ incidents, pendingResponses: 0 });
  for (const incident of incidents) assert.equal((body.match(new RegExp(`data-incident-id="${incident.id}"`, 'g')) || []).length, 1);
  assert.equal((body.match(/data-scene-art="woodpecker"/g) || []).length, 1);
});
