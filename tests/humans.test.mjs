import test from 'node:test';
import assert from 'node:assert/strict';
import { LIFE_STAGES, getNeighborStage, getRelationshipState } from '../core/constants.js';
import {
  HUMAN_RUMORS,
  HUMAN_ADAPTATION_CARDS,
  advanceHumanAdaptation,
  advanceHumanSystem,
  advanceOffspringCrises,
  buildHumanEncounterDecision,
  createOffspringRecords,
  createOffspringCrisis,
  describeOffspring,
  growOffspringRecords,
  getProtectedCompanions,
  nurtureOffspring,
  resolveOffspringCrisisAid,
  resolveHumanDecision,
  updateProtectionProgress,
} from '../core/humans.js';

function state(overrides = {}) {
  return {
    year: 6,
    seasonIndex: 0,
    selectedSpecies: 'Pear',
    lifeStage: LIFE_STAGES[5],
    branches: 5,
    leafClusters: 8,
    trunk: 5,
    canopySpread: 2,
    health: 15,
    maxHealth: 15,
    nutrients: 8,
    defense: 1,
    allies: 1,
    neighbors: [],
    offspringRecords: [],
    ...overrides,
  };
}

const deps = { getRelationshipState, getNeighborStage, random: () => 0 };

test('the approved human adaptation cards preserve the reviewed language', () => {
  assert.equal(HUMAN_ADAPTATION_CARDS.length, 21);
  assert.match(HUMAN_ADAPTATION_CARDS[1].paragraphs[0], /ominously empty baskets/);
  assert.match(HUMAN_ADAPTATION_CARDS[2].paragraphs[0], /taste will be foul/);
  assert.match(HUMAN_ADAPTATION_CARDS[3].paragraphs[1], /Only the new, slick oils on your leaves/);
  assert.equal(HUMAN_ADAPTATION_CARDS[8].paragraphs[1], 'The devices reach farther than any hand.');
  assert.equal(HUMAN_ADAPTATION_CARDS[20].paragraphs.at(-1).endsWith('and the roots cannot understand why.'), true);
});

test('the prepared route advances through all twenty chapters in seasonal order', () => {
  const s = state({ lifeStage: LIFE_STAGES[4], flowers: 1, pollinated: 1, humanAdaptationChapter: 0 });
  assert.equal(advanceHumanAdaptation(s).chapter, 1);
  assert.equal(advanceHumanAdaptation(s).chapter, 2);
  assert.ok(s.announcedActionUnlocks.includes('toxicLeaves'));

  s.seasonIndex = 1;
  s.developing = 4;
  s.toxicLeaves = 1;
  assert.equal(advanceHumanAdaptation(s).chapter, 3);
  assert.equal(advanceHumanAdaptation(s).chapter, 4);

  s.year += 1;
  s.seasonIndex = 0;
  assert.equal(advanceHumanAdaptation(s).chapter, 5);
  assert.equal(advanceHumanAdaptation(s).chapter, 6);
  s.seasonIndex = 1;
  s.thornDefense = 1;
  assert.equal(advanceHumanAdaptation(s).chapter, 7);

  s.seasonIndex = 0;
  assert.equal(advanceHumanAdaptation(s).chapter, 8);
  assert.equal(advanceHumanAdaptation(s).chapter, 9);
  s.seasonIndex = 1;
  s.interlacedCrown = true;
  assert.equal(advanceHumanAdaptation(s).chapter, 10);
  s.seasonIndex = 2;
  assert.equal(advanceHumanAdaptation(s).chapter, 11);
  assert.equal(advanceHumanAdaptation(s).chapter, 12);

  s.year += 1;
  s.humanResinPrimed = true;
  assert.equal(advanceHumanAdaptation(s).chapter, 13);
  assert.equal(s.humanResinPrimed, false);
  assert.equal(advanceHumanAdaptation(s).chapter, 14);

  s.lifeStage = LIFE_STAGES[5];
  s.offspringRecords = [{ id: 'child', species: 'Pear', dead: false, stageScore: 600, health: 8, maxHealth: 8 }];
  assert.equal(advanceHumanAdaptation(s).chapter, 15);
  s.humanGroveRoles = { watchPath: 'child', staggerHarvest: 'child', closeApproach: 'child' };
  s.seasonIndex = 1;
  assert.equal(advanceHumanAdaptation(s).chapter, 16);
  s.seasonIndex = 2;
  assert.equal(advanceHumanAdaptation(s).chapter, 17);
  assert.equal(advanceHumanAdaptation(s).chapter, 18);
  s.groveRoused = true;
  assert.equal(advanceHumanAdaptation(s).chapter, 19);
  assert.equal(advanceHumanAdaptation(s).chapter, 20);
});

test('an unprepared fruit raid causes loss without teaching humans a new tactic', () => {
  const s = state({ lifeStage: LIFE_STAGES[4], seasonIndex: 1, developing: 5, humanAdaptationChapter: 2, toxicLeaves: 0 });
  assert.equal(advanceHumanAdaptation(s).chapter, 3);
  const failure = advanceHumanAdaptation(s);
  assert.equal(failure.failure, true);
  assert.equal(s.humanAdaptationChapter, 2);
  assert.equal(s.developing, 2);
  assert.equal(advanceHumanAdaptation(s), null);
});

test('fungal rumors arrive in order and are not repeated', () => {
  const s = state({ lifeStage: LIFE_STAGES[2], humanStoryTurns: 5 });
  const first = advanceHumanSystem(s, deps);
  assert.equal(first.rumor.title, HUMAN_RUMORS[0].title);
  assert.equal(first.rumor.presentation, 'ominous');
  const tooSoon = advanceHumanSystem(s, deps);
  assert.equal(tooSoon.rumor, undefined);
  s.humanStoryTurns += 5;
  const second = advanceHumanSystem(s, deps);
  assert.equal(second.rumor.title, HUMAN_RUMORS[1].title);
  assert.equal(second.rumor.presentation, 'ominous');
});

test('the felling storyline is visually marked as ominous until the hopeful coda', () => {
  assert.ok(HUMAN_RUMORS.slice(0, -1).every(rumor => rumor.presentation === 'ominous'));
  assert.equal(HUMAN_RUMORS.at(-1).presentation, undefined);
});

test('a branch drop repels cutters but sacrifices structure', () => {
  const s = state({ pendingHumanEncounter: { phase: 'cutting', count: 3 } });
  const decision = advanceHumanSystem(s, deps).decision;
  const outcome = resolveHumanDecision(s, decision, 'drop-branch', deps);
  assert.equal(outcome.repelled, true);
  assert.equal(s.branches, 4);
  assert.equal(s.leafClusters, 6);
  assert.equal('pendingHumanEncounter' in s, false);
  assert.equal(s.incidents.find(incident => incident.kind === 'human-encounter').state, 'resolved');
});

test('human encounters offer distinct botanical defenses instead of duplicate passive choices', () => {
  const s = state({ pendingHumanEncounter: { phase: 'survey', count: 2 }, branches: 0, allies: 0, sunlight: 5, water: 4, nutrients: 6, thornDefense: 0, toxicLeaves: 0 });
  const decision = buildHumanEncounterDecision(s);
  assert.ok(decision.options.some(option => option.id === 'emergency-thorns' && option.affordable));
  assert.ok(decision.options.some(option => option.id === 'irritating-oils' && option.affordable));
  assert.equal(decision.options.some(option => /stand firm|conserve your strength/i.test(option.label)), false);

  const outcome = resolveHumanDecision(s, decision, 'emergency-thorns', deps);
  assert.equal(outcome.repelled, true);
  assert.equal(s.thornDefense, 1);
  assert.equal(s.water, 2);
  assert.equal(s.nutrients, 3);
});

test('fungal-network support uses realistic resource sharing and defensive chemistry', () => {
  const s = state({ pendingHumanEncounter: { phase: 'survey', count: 2 }, branches: 0, allies: 2, sunlight: 0, water: 0, nutrients: 2, thornDefense: 0, toxicLeaves: 0 });
  const decision = buildHumanEncounterDecision(s);
  const network = decision.options.find(option => option.id === 'call-network');
  assert.match(network.label, /draw support through the fungal network/i);
  assert.match(network.preview, /water and minerals|resin/i);
  assert.doesNotMatch(network.preview, /move|threat/i);
  const outcome = resolveHumanDecision(s, decision, 'call-network', deps);
  assert.equal(outcome.repelled, true);
  assert.match(outcome.body, /resin|defensive compounds/i);
  assert.doesNotMatch(outcome.body, /roots shift|branches move|surrounded/i);
});

test('an undefended chance retreat does not credit defenses that were not used', () => {
  const s = state({ pendingHumanEncounter: { phase: 'survey', count: 2 }, branches: 0, allies: 0, sunlight: 0, water: 0, nutrients: 0, thornDefense: 3, toxicLeaves: 3 });
  const decision = buildHumanEncounterDecision(s);
  const fallback = decision.options.find(option => option.id === 'endure-cutting');
  const outcome = resolveHumanDecision(s, decision, fallback.id, deps);
  assert.equal(outcome.repelled, true);
  assert.match(outcome.body, /reconsider the difficult ground/i);
  assert.doesNotMatch(outcome.body, /bark|resin|defensive growth|thorns|toxic/i);
  assert.doesNotMatch(outcome.body, /movement|move|threaten/i);
});

test('an explicit undefended fallback appears only when no active response is available', () => {
  const s = state({ pendingHumanEncounter: { phase: 'survey', count: 2 }, branches: 0, allies: 0, sunlight: 0, water: 0, nutrients: 0, thornDefense: 0, toxicLeaves: 0 });
  const decision = buildHumanEncounterDecision(s);
  assert.deepEqual(decision.options.filter(option => option.affordable !== false).map(option => option.id), ['endure-cutting']);
  assert.match(decision.options.at(-1).label, /without defending yourself/i);
});

test('nurturing supports a specific persistent child', () => {
  const s = state();
  createOffspringRecords(s, 2);
  const secondId = s.offspringRecords[1].id;
  const child = nurtureOffspring(s, secondId);
  assert.equal(child.nurtureCount, 1);
  assert.equal(child.stageScore, 400);
  assert.equal(s.offspringRecords[0].nurtureCount, 0);
  assert.equal(s.offspringRecords[1].nurtureCount, 1);
  const stats = describeOffspring(s, LIFE_STAGES);
  assert.deepEqual(stats[1], {
    id: secondId,
    species: 'Pear',
    groveSide: 'right',
    stageName: 'Seedling',
    stageScore: 400,
    nextStageName: 'Sapling',
    nextStageThreshold: 600,
    health: 9,
    maxHealth: 9,
    nurtureCount: 1,
    supportReceived: 0,
    rhizosphereBonus: 0,
    humanRoles: [],
  });
});

test('offspring crises ask for aid and partial support produces measurable recovery', () => {
  const s = state({ nutrients: 3 });
  const [child] = createOffspringRecords(s, 1);
  const crisis = createOffspringCrisis(s, child, () => 0);
  const [request] = advanceOffspringCrises(s, () => 1);
  assert.equal(request.died, false);
  assert.match(request.flavor, /distress signal|aphids/i);
  assert.equal(child.health, 6);

  const partial = resolveOffspringCrisisAid(s, child.id, crisis.id);
  assert.equal(partial.given, 3);
  assert.equal(partial.resolved, false);
  assert.equal(child.health, 7);
  assert.equal(crisis.amount, 4);
  assert.equal(child.supportReceived, 1);

  s.nutrients = 4;
  const full = resolveOffspringCrisisAid(s, child.id, crisis.id);
  assert.equal(full.resolved, true);
  assert.equal(child.health, 8);
  assert.equal(child.activeCrises.length, 0);
});

test('offspring beneath the parent shade grow more slowly until the lean changes sides', () => {
  const leftNeighbor = { slot: 1, playerShading: true, dead: false };
  const s = state({ neighbors: [leftNeighbor] });
  createOffspringRecords(s, 2);
  growOffspringRecords(s, () => 0);
  assert.equal(s.offspringRecords[0].groveSide, 'left');
  assert.equal(s.offspringRecords[1].groveSide, 'right');
  assert.equal(s.offspringRecords[0].stageScore, 121);
  assert.equal(s.offspringRecords[1].stageScore, 135);
  leftNeighbor.playerShading = false;
  growOffspringRecords(s, () => 0);
  assert.equal(s.offspringRecords[0].stageScore, 156);
});

test('two genuinely supported mature allies qualify an Ancient grove', () => {
  const mature = LIFE_STAGES[5].threshold;
  const s = state({
    lifeStage: LIFE_STAGES[6],
    humanRumorIndex: HUMAN_RUMORS.length,
    humanAdaptationChapter: 20,
    neighbors: [
      { species: 'Cherry', relation: 60, stageScore: mature, firstAidStageScore: 900, growthAidReceived: 2, helpGivenToThem: 2, health: 8, maxHealth: 10, dead: false },
      { species: 'Citrus', relation: 75, stageScore: mature + 100, firstAidStageScore: 800, growthAidReceived: 3, helpGivenToThem: 3, health: 9, maxHealth: 10, dead: false },
    ],
  });
  const companions = getProtectedCompanions(s, deps);
  assert.equal(companions.length, 2);
  assert.equal(updateProtectionProgress(s, deps).eligible, true);
  const decision = advanceHumanSystem(s, deps).decision;
  assert.equal(decision.kind, 'conservation-inspection');
  const outcome = resolveHumanDecision(s, decision, 'receive-inspection', deps);
  assert.equal(outcome.victory, true);
  assert.equal(s.victoryAchieved, true);
});

test('an ally first aided after maturity needs deeper support', () => {
  const mature = LIFE_STAGES[5].threshold;
  const s = state({
    lifeStage: LIFE_STAGES[6],
    humanRumorIndex: HUMAN_RUMORS.length,
    neighbors: [
      { species: 'Cherry', relation: 60, stageScore: mature + 200, firstAidStageScore: mature, growthAidReceived: 2, helpGivenToThem: 2, health: 9, maxHealth: 10, dead: false },
    ],
  });
  assert.equal(getProtectedCompanions(s, deps).length, 0);
  s.neighbors[0].growthAidReceived = 4;
  s.neighbors[0].helpGivenToThem = 4;
  assert.equal(getProtectedCompanions(s, deps).length, 1);
});

test('a nurtured mature child qualifies as a protected companion', () => {
  const s = state({
    lifeStage: LIFE_STAGES[6],
    humanRumorIndex: HUMAN_RUMORS.length,
    offspringRecords: [{ id: 'child', species: 'Pear', stageScore: LIFE_STAGES[5].threshold, nurtureCount: 2, health: 8, maxHealth: 9, dead: false }],
  });
  const companions = getProtectedCompanions(s, deps);
  assert.equal(companions.length, 1);
  assert.equal(companions[0].kind, 'offspring');
});
