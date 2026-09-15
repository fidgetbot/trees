import test from 'node:test';
import assert from 'node:assert/strict';
import { LIFE_STAGES, getNeighborStage, getRelationshipState } from '../core/constants.js';
import {
  HUMAN_RUMORS,
  advanceHumanSystem,
  createOffspringRecords,
  getProtectedCompanions,
  nurtureOffspring,
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

test('fungal rumors arrive in order and are not repeated', () => {
  const s = state({ lifeStage: LIFE_STAGES[2], humanStoryTurns: 5 });
  const first = advanceHumanSystem(s, deps);
  assert.equal(first.rumor.title, HUMAN_RUMORS[0].title);
  const tooSoon = advanceHumanSystem(s, deps);
  assert.equal(tooSoon.rumor, undefined);
  s.humanStoryTurns += 5;
  const second = advanceHumanSystem(s, deps);
  assert.equal(second.rumor.title, HUMAN_RUMORS[1].title);
});

test('a branch drop repels cutters but sacrifices structure', () => {
  const s = state({ pendingHumanEncounter: { phase: 'cutting', count: 3 } });
  const decision = advanceHumanSystem(s, deps).decision;
  const outcome = resolveHumanDecision(s, decision, 'drop-branch', deps);
  assert.equal(outcome.repelled, true);
  assert.equal(s.branches, 4);
  assert.equal(s.leafClusters, 6);
  assert.equal(s.pendingHumanEncounter, null);
});

test('nurturing supports a specific persistent child', () => {
  const s = state();
  createOffspringRecords(s, 2);
  const child = nurtureOffspring(s);
  assert.equal(child.nurtureCount, 1);
  assert.equal(child.stageScore, 400);
  assert.equal(s.offspringRecords[1].nurtureCount, 0);
});

test('two genuinely supported mature allies qualify an Ancient grove', () => {
  const mature = LIFE_STAGES[5].threshold;
  const s = state({
    lifeStage: LIFE_STAGES[6],
    humanRumorIndex: HUMAN_RUMORS.length,
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
