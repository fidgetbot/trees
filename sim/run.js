import { readFileSync } from 'node:fs';
import { createEngine } from '../core/engine.js';

function loadVersion() {
  const raw = readFileSync(new URL('../version.json', import.meta.url), 'utf8');
  return JSON.parse(raw).version;
}

function createStubEngine() {
  return createEngine({
    SEASONS: [
      { name: 'Spring', factorSun: 0.8, factorWater: 1.0 },
      { name: 'Summer', factorSun: 1.2, factorWater: 0.6 },
      { name: 'Autumn', factorSun: 0.6, factorWater: 0.8 },
      { name: 'Winter', factorSun: 0.2, factorWater: 0.4 },
    ],
    computeCurrentLifeStage: () => ({ name: 'Seed', rank: 0 }),
    getStageProgressIncrement: () => 1,
    rollMajorEvent: () => null,
    rollMinorEvents: () => [],
    resolveSeedFate: seedCount => ({ sprouted: 0, results: Array.from({ length: seedCount }, () => 'Failed to sprout.') }),
    updateAlliesCount: () => {},
    growNeighbors: () => {},
    tryAdvanceLifeStage: () => false,
    maybeShowGrowthNudge: () => false,
    maybeShowAllyWarning: () => false,
    showResourcePhase: () => {},
    updateScore: () => {},
    updateUI: () => {},
    render: () => {},
    showModal: () => {},
    processPendingInteractions: done => done?.(),
    maybeShowHealthWarning: () => false,
    saveCurrentRunToLeaderboard: () => {},
    deathFlavor: () => 'decline',
    generateSuccessionChoices: () => [],
    continueAsSuccessor: () => {},
    showChoiceModal: () => {},
    renderSpringSeedFateBody: () => '',
    renderGameOverBody: () => '',
    renderSuccessionBody: () => '',
  });
}

function parseArgs(argv) {
  const options = { turns: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--turns') options.turns = Math.max(1, Number.parseInt(argv[i + 1] || '1', 10) || 1);
  }
  return options;
}

function createInitialState() {
  return {
    seasonIndex: 0,
    turnInSeason: 1,
    year: 1,
    turnsInStage: 0,
    growthNudgeCooldown: 0,
    trunk: 1,
    rootZones: 1,
    leafClusters: 1,
    branches: 0,
    flowers: 0,
    developing: 0,
    seeds: 0,
    canopySpread: 0,
    taprootDepth: 0,
    allies: 0,
    sunlight: 0,
    water: 0,
    nutrients: 0,
    actions: 0,
    health: 5,
    maxHealth: 5,
    eventModifiers: { drought: 1, disease: 1, shade: 0, shelter: 0, soilBonus: 0 },
    pendingInteractions: [],
    majorEvent: null,
    lifeStage: { name: 'Seed', rank: 0 },
    firstRootActionTaken: false,
    viableSeeds: 0,
    offspringPool: 0,
    offspringTrees: 0,
    gameOver: false,
    score: 0,
  };
}

const options = parseArgs(process.argv.slice(2));
const engine = createStubEngine();
const state = createInitialState();
const turns = [];

for (let i = 0; i < options.turns; i += 1) {
  const gains = engine.startTurn(state, { addLog: () => {}, presentResources: () => {} });
  turns.push({
    turn: i + 1,
    season: engine.currentSeason(state).name,
    gains: {
      sunlight: gains.sunlightGain,
      water: gains.waterGain,
      nutrients: gains.nutrientGain,
      actions: state.actions,
    },
    resources: {
      sunlight: state.sunlight,
      water: state.water,
      nutrients: state.nutrients,
    },
  });
}

console.log(JSON.stringify({
  version: loadVersion(),
  mode: 'sim-scaffold',
  turns,
}, null, 2));
