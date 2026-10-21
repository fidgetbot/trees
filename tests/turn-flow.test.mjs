import assert from 'node:assert/strict';
import test from 'node:test';
import { SEASONS, LIFE_STAGES, TURNS_PER_SEASON } from '../core/constants.js';
import { createEngine, shouldSkipGathering } from '../core/engine.js';
import { createInitialBrowserState } from '../ui/browser-app.js';
import { buildChemicalDefenseDecision, resolveUnanswerableChemicalThreat } from '../core/events.js';

function turnState(overrides = {}) {
  return {
    ...createInitialBrowserState({ initialLifeStage: LIFE_STAGES[4] }),
    selectedSpecies: 'Citrus', health: 10, maxHealth: 10, year: 2,
    firstRootActionTaken: true, rootZones: 2, leafClusters: 2, trunk: 1,
    ...overrides,
  };
}

function turnEngine(overrides = {}) {
  return createEngine({
    SEASONS, getStageProgressIncrement: () => 1,
    growNeighbors() {}, updateAlliesCount() {}, updateUI() {}, render() {},
    tryAdvanceLifeStage: () => false,
    maybeShowGrowthNudge: () => false, maybeShowAllyWarning: () => false,
    showResourcePhase() {}, ...overrides,
  });
}

test('spring settlement reports once and resumes gathering only after acknowledgement', () => {
  const state = turnState({ seasonIndex: 3, turnInSeason: TURNS_PER_SEASON, seeds: 2 });
  let acknowledge, reports = 0, gatherings = 0;
  const engine = turnEngine({
    resolveSeedFate: () => ({ sprouted: 1, results: [] }),
    renderSpringSeedFateBody: () => '',
    showModal(_title, _body, onContinue) { acknowledge = onContinue; },
    showResourcePhase() { gatherings++; },
  });
  engine.advanceTurn(state, { onAfterSpringViability(fate, seeds) {
    assert.equal(fate.sprouted, 1);
    assert.equal(seeds, 2);
    reports++;
  } });
  assert.equal(gatherings, 0);
  acknowledge();
  assert.equal(reports, 1);
  assert.equal(gatherings, 1);
  assert.equal(state.seeds, 0);
  assert.equal(state.offspringRecords.length, 1);
  assert.equal(state.seasonIndex, 0);
});

test('season change pauses the advanced turn until its card is acknowledged', () => {
  const state = turnState({ seasonIndex: 1, turnInSeason: TURNS_PER_SEASON });
  let acknowledge, gatherings = 0, notice = null;
  const engine = turnEngine({
    presentSeasonChange(context, onContinue) { notice = context; acknowledge = onContinue; },
    showResourcePhase() { gatherings++; },
  });
  engine.advanceTurn(state);
  assert.equal(state.seasonIndex, 2);
  assert.equal(state.turnInSeason, 1);
  assert.equal(gatherings, 0);
  assert.equal(notice.season.name, 'Autumn');
  assert.equal(notice.year, 2);
  acknowledge();
  assert.equal(gatherings, 1);
});

test('the third turn advances to turn four without changing season', () => {
  const state = turnState({ seasonIndex: 1, turnInSeason: TURNS_PER_SEASON - 1 });
  let seasonCards = 0;
  const engine = turnEngine({
    presentSeasonChange() { seasonCards++; },
  });
  engine.advanceTurn(state);
  assert.equal(state.seasonIndex, 1);
  assert.equal(state.turnInSeason, TURNS_PER_SEASON);
  assert.equal(seasonCards, 0);
});

test('major events occur on the fourth and final turn of a season', () => {
  let majorRolls = 0;
  const engine = turnEngine({
    rollMajorEvent() {
      majorRolls++;
      return { apply: () => [] };
    },
    rollMinorEvents: () => [],
  });
  engine.showEventPhase(turnState({ turnInSeason: TURNS_PER_SEASON - 1 }));
  assert.equal(majorRolls, 0);
  engine.showEventPhase(turnState({ turnInSeason: TURNS_PER_SEASON }));
  assert.equal(majorRolls, 1);
});

for (const warning of ['maybeShowGrowthNudge', 'maybeShowAllyWarning']) {
  test(`${warning} resumes the advanced turn through gathering`, () => {
    for (const actions of [0, 2]) {
      const state = turnState({ actions });
      let acknowledge, gatherings = 0;
      const engine = turnEngine({
        [warning](onContinue) { acknowledge = onContinue; return true; },
        showResourcePhase() { gatherings++; },
      });
      engine.advanceTurn(state);
      assert.equal(gatherings, 0);
      assert.equal(state.turnsElapsed, 1);
      acknowledge();
      assert.equal(gatherings, 1);
      assert.equal(state.turnsElapsed, 1, 'warning must not advance another turn');
    }
  });
}

test('an established seedling can gather sunlight and regrow its last lost root', () => {
  const state = turnState({ lifeStage: LIFE_STAGES[2], rootZones: 1, sunlight: 0, water: 0, nutrients: 0 });
  const decision = buildChemicalDefenseDecision(state, {
    computeCurrentLifeStage: () => state.lifeStage, threat: 'surface-crawlers',
  });
  resolveUnanswerableChemicalThreat(state, decision);
  assert.equal(state.rootZones, 0);
  assert.equal(shouldSkipGathering(state), false);
  const engine = turnEngine();
  engine.collectResources(state);
  assert.ok(state.sunlight > 0, 'surviving leaves still gather without roots');
  engine.collectResources(state);
  assert.ok(state.sunlight >= 2, 'surviving foliage funds the Seedling root cost');
  assert.ok(state.actions >= 3);
});
