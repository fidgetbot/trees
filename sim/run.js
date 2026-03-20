import { readFileSync } from 'node:fs';
import { createEngine } from '../core/engine.js';
import { createSeededRng } from '../core/random.js';
import { SEASONS, LIFE_STAGES, STAGE_BY_NAME, SEASONAL_ACTIONS, getRelationshipState } from '../core/constants.js';
import { SPECIES, getCurrentSpeciesSpec, getStageProgressIncrement, getSpeciesAdjustedCost, getDroughtResistance, getPollinatorChance } from '../core/species.js';
import { computeCurrentLifeStage, currentStageRequirements, getNextStage, resetStageProgressCounters } from '../core/stages.js';
import { createActions, getActionAvailability } from '../core/actions.js';
import { createMajorEvents, rollMajorEvent, rollMinorEvents, resolveSeedFate } from '../core/events.js';
import { updateAlliesCount } from '../core/diplomacy.js';
import { recordDamageForState, healthWarningBandForState, deathFlavorForCause } from '../core/survival.js';

function loadVersion() {
  const raw = readFileSync(new URL('../version.json', import.meta.url), 'utf8');
  return JSON.parse(raw).version;
}

function parseArgs(argv) {
  const options = { turns: 24, games: 1, seed: 1, species: 'Plum' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--turns') options.turns = Math.max(1, Number.parseInt(argv[i + 1] || '24', 10) || 24);
    if (arg === '--games') options.games = Math.max(1, Number.parseInt(argv[i + 1] || '1', 10) || 1);
    if (arg === '--seed') options.seed = Number.parseInt(argv[i + 1] || '1', 10) || 1;
    if (arg === '--species' && argv[i + 1]) options.species = argv[i + 1];
  }
  if (!SPECIES[options.species]) options.species = 'Plum';
  return options;
}

function makeStartingNeighbors(rng) {
  const speciesNames = Object.keys(SPECIES);
  const shuffled = [...speciesNames].sort(() => rng() - 0.5);
  const positions = [0, 1, 3, 4];
  return positions.map((slot, i) => {
    const species = shuffled[i % shuffled.length];
    const stageChoices = ['Sprout', 'Seedling', 'Sapling', 'Small Tree', 'Mature Tree'];
    const stageName = stageChoices[Math.floor(rng() * stageChoices.length)];
    const stage = LIFE_STAGES.find(x => x.name === stageName) || LIFE_STAGES[1];
    return {
      slot,
      species,
      relation: 0,
      stageScore: stage.threshold + Math.floor(rng() * 160),
      hostile: false,
      ally: false,
      helpGivenToThem: 0,
      helpRefusedToThem: 0,
      helpReceivedFromThem: 0,
      timesAskedThemForHelp: 0,
      lastAidMemory: '',
      maxHealth: 10,
      health: 10,
      activeCrises: [],
      crisisCounter: 0,
      dead: false,
    };
  });
}

function createInitialState(speciesName, rng) {
  const spec = SPECIES[speciesName];
  return {
    started: true,
    selectedSpecies: speciesName,
    year: 1,
    seasonIndex: 0,
    turnInSeason: 1,
    score: 0,
    lifeStage: LIFE_STAGES[0],
    sunlight: 5,
    water: 4,
    nutrients: 4,
    actions: 1,
    branches: spec.branches || 0,
    rootZones: spec.rootZones || 0,
    leafClusters: 0,
    trunk: spec.trunk || 1,
    flowers: 0,
    pollinated: 0,
    developing: 0,
    seeds: 0,
    viableSeeds: 0,
    allies: 0,
    health: spec.health + 3,
    maxHealth: spec.health + 3,
    offspringPool: 0,
    defense: 0,
    fruitDefense: 0,
    offspringTrees: 0,
    pendingFruitThreat: null,
    pendingOffspringThreat: false,
    pendingChemicalThreat: null,
    taprootDepth: 0,
    canopySpread: 0,
    log: [],
    eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0, soilBonus: 0, shelter: 0, shade: 0 },
    majorEvent: null,
    minorEvent: null,
    gameOver: false,
    victoryAchieved: false,
    neighbors: makeStartingNeighbors(rng),
    firstRootActionTaken: false,
    turnsInStage: 0,
    majorEventsSurvivedInStage: 0,
    growthNudgeCooldown: 3 + Math.floor(rng() * 2),
    hasProducedFruit: false,
    milestones: {},
    healthWarningLevel: 0,
    lastDamageCause: 'decline',
    pendingInteractions: [],
    recordsSavedThisRun: false,
    phase: 'action',
  };
}

function addLog(state, line) {
  state.log.push(line);
}

function canAfford(state, cost) {
  return state.sunlight >= (cost.sunlight || 0)
    && state.water >= (cost.water || 0)
    && state.nutrients >= (cost.nutrients || 0)
    && state.actions > 0;
}

function spend(state, cost) {
  state.sunlight -= (cost.sunlight || 0);
  state.water -= (cost.water || 0);
  state.nutrients -= (cost.nutrients || 0);
  state.actions -= 1;
}

function getScaledCost(state, actionKey, baseCost) {
  return getSpeciesAdjustedCost(state, actionKey, baseCost, computeCurrentLifeStage(state));
}

function isActionUnlocked(state, actionKey) {
  return LIFE_STAGES.some(stage => stage.rank <= state.lifeStage.rank && stage.unlocks.includes(actionKey));
}

function updateNeighborAliveState(state, neighbor) {
  if (neighbor.health <= 0) neighbor.dead = true;
  updateAlliesCount(state, getRelationshipState);
}

function createHeadlessGame(seed, speciesName) {
  const rng = createSeededRng(seed);
  const originalRandom = Math.random;
  Math.random = rng;

  const state = createInitialState(speciesName, rng);

  function maybeShowHealthWarning(onContinue) {
    const level = healthWarningBandForState(state);
    if (level > state.healthWarningLevel) {
      state.healthWarningLevel = level;
      onContinue?.();
      return true;
    }
    onContinue?.();
    return false;
  }

  function maybeShowGrowthNudge() { return false; }
  function maybeShowAllyWarning() { return false; }

  function tryAdvanceLifeStage(onContinue) {
    const next = getNextStage(state);
    if (!next) return false;
    const reqs = currentStageRequirements(state);
    if (!reqs.length || reqs.every(r => r.met)) {
      state.lifeStage = next;
      resetStageProgressCounters(state, rng);
      addLog(state, `You have grown. You are now a ${next.name}.`);
      onContinue?.();
      return true;
    }
    return false;
  }

  function growNeighbors() {
    state.neighbors.forEach(n => {
      if (n.dead) return;
      n.stageScore += 20 + Math.floor(rng() * 35);
      if (getRelationshipState(n.relation).name === 'Hostile' && rng() < 0.25) {
        state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.08;
      }
    });
  }

  const majorEvents = createMajorEvents({
    getThreatMultiplier: () => 1,
    recordDamage: (amount, cause) => recordDamageForState(state, amount, cause),
    getDroughtResistance: () => getDroughtResistance(state),
    getRelationshipState,
    updateNeighborAliveState: neighbor => updateNeighborAliveState(state, neighbor),
    updateAlliesCount: () => updateAlliesCount(state, getRelationshipState),
  });

  const actions = createActions({
    resinReserveAction: s => { s.defense += 1; },
    woodSurgeAction: s => { s.trunk += 1; s.rootZones += 1; },
    attemptConnection: s => {
      const target = s.neighbors.find(n => !n.dead && getRelationshipState(n.relation).name !== 'Ally');
      if (!target) return;
      target.relation += 25;
      if (getRelationshipState(target.relation).name === 'Ally') target.ally = true;
      updateAlliesCountForState(s, getRelationshipState);
    },
    offerAidToAlly: s => {
      const target = s.neighbors.find(n => !n.dead && getRelationshipState(n.relation).name === 'Ally');
      if (!target) return;
      target.health = Math.min(target.maxHealth, target.health + 2);
      target.helpGivenToThem += 1;
      target.relation += 5;
    },
    requestHelpFromAllies: s => {
      if (s.allies < 1) return;
      s.water += 1;
      s.nutrients += 1;
      s.health = Math.min(s.maxHealth, s.health + 1);
    },
    shadeRivalAction: s => {
      const target = s.neighbors.find(n => !n.dead && getRelationshipState(n.relation).name === 'Hostile');
      if (!target) return;
      target.health = Math.max(0, target.health - 1);
      target.relation -= 5;
      if (target.health <= 0) updateNeighborAliveState(s, target);
    },
    rootDominionAction: s => {
      s.neighbors.filter(n => !n.dead && getRelationshipState(n.relation).name === 'Hostile').forEach(target => {
        target.health = Math.max(0, target.health - 2);
        target.relation -= 10;
        if (target.health <= 0) updateNeighborAliveState(s, target);
      });
    },
    getRelationshipState,
  });

  const engine = createEngine({
    SEASONS,
    computeCurrentLifeStage: () => computeCurrentLifeStage(state),
    getStageProgressIncrement: () => getStageProgressIncrement(state),
    rollMajorEvent: () => rollMajorEvent(majorEvents),
    rollMinorEvents: () => rollMinorEvents(state, {
      currentSeasonName: SEASONS[state.seasonIndex].name,
      getPollinatorChance: baseChance => getPollinatorChance(state, baseChance),
      species: SPECIES,
      recordDamage: (amount, cause) => recordDamageForState(state, amount, cause),
      STAGE_BY_NAME,
      getRelationshipState,
      advanceAllyCrises: () => {},
      checkAllyBetrayal: () => false,
      queueHostileTreeThreat: () => {},
      queueChemicalDefenseThreat: () => {},
      computeCurrentLifeStage: () => computeCurrentLifeStage(state),
    }),
    resolveSeedFate,
    updateAlliesCount: () => updateAlliesCount(state, getRelationshipState),
    growNeighbors,
    tryAdvanceLifeStage,
    maybeShowGrowthNudge,
    maybeShowAllyWarning,
    showResourcePhase: () => {},
    updateScore: () => {},
    updateUI: () => {},
    render: () => {},
    showModal: (_title, _body, onContinue) => onContinue?.(),
    processPendingInteractions: done => {
      const queue = [...state.pendingInteractions];
      state.pendingInteractions = [];
      queue.forEach(fn => fn?.(() => {}));
      done?.();
    },
    maybeShowHealthWarning,
    saveCurrentRunToLeaderboard: () => {},
    deathFlavor: cause => deathFlavorForCause(cause),
    generateSuccessionChoices: () => [],
    continueAsSuccessor: () => {},
    showChoiceModal: (_title, _body, choices) => choices?.[0]?.onChoose?.(),
    renderSpringSeedFateBody: () => '',
    renderGameOverBody: () => '',
    renderSuccessionBody: () => '',
    renderVictoryBody: () => '',
  });

  function chooseAction() {
    const seasonName = SEASONS[state.seasonIndex].name;
    const available = actions
      .map(action => ({
        action,
        availability: getActionAvailability({
          action,
          state,
          lifeStages: LIFE_STAGES,
          currentStageRank: state.lifeStage.rank,
          currentSeasonName: seasonName,
          seasonalActions: SEASONAL_ACTIONS,
          getScaledCost: cost => getScaledCost(state, action.key, cost),
          canAfford: cost => canAfford(state, cost),
          isActionUnlocked: key => isActionUnlocked(state, key),
        }),
      }))
      .filter(entry => !entry.availability.hidden && entry.availability.usable);

    const priorities = [
      'extendRoot', 'growLeaves', 'growBranch', 'taproot', 'canopy',
      'thicken', 'bark', 'flower', 'massFlower', 'nurtureOffspring',
      'requestHelp', 'connect', 'aidAlly', 'rhizosphere', 'shelterGrove',
      'resinReserve', 'woodSurge', 'shadeRival', 'rootDominion', 'mastYear',
    ];

    if (state.health <= Math.max(2, Math.floor(state.maxHealth * 0.4))) {
      const rescue = available.find(entry => ['requestHelp', 'bark', 'thicken', 'taproot'].includes(entry.action.key));
      if (rescue) return rescue;
    }

    if (state.lifeStage.name === 'Mature Tree' && state.allies < 1) {
      const allyAction = available.find(entry => entry.action.key === 'connect');
      if (allyAction) return allyAction;
    }

    for (const key of priorities) {
      const match = available.find(entry => entry.action.key === key);
      if (match) return match;
    }
    return available[0] || null;
  }

  function run(turnLimit) {
    const history = [];
    let turnsPlayed = 0;

    while (!state.gameOver && !state.victoryAchieved && turnsPlayed < turnLimit) {
      const gains = engine.startTurn(state, { addLog: line => addLog(state, line), presentResources: () => {} });

      while (state.actions > 0 && !state.gameOver) {
        const picked = chooseAction();
        if (!picked) {
          state.actions = 0;
          break;
        }
        engine.executeAction(state, picked.action, picked.availability.scaledCost, {
          spend: cost => spend(state, cost),
          showFeedback: () => {},
          addLog: line => addLog(state, line),
          maybeTriggerActionMilestone: () => false,
          resumeTurnFlow: () => {},
          renderActions: () => {},
          showEventPhase: () => {},
        });
      }

      const eventResult = engine.showEventPhase(state);
      state.majorEvent = eventResult.major;
      state.minorEvent = eventResult.minors;

      if (state.health <= 0) {
        engine.handleDeath(state);
        break;
      }

      engine.continueAfterEvent(state, {
        processPendingInteractions: done => {
          const queue = [...state.pendingInteractions];
          state.pendingInteractions = [];
          queue.forEach(fn => fn?.(() => {}));
          done?.();
        },
        maybeShowHealthWarning: advance => maybeShowHealthWarning(advance),
        advanceTurn: () => engine.advanceTurn(state, { onDeath: () => engine.handleDeath(state) }),
        showTaprootResilience: continueFlow => continueFlow?.(),
      });

      turnsPlayed += 1;
      history.push({
        turn: turnsPlayed,
        year: state.year,
        season: SEASONS[state.seasonIndex].name,
        stage: state.lifeStage.name,
        score: state.score,
        resources: { sunlight: state.sunlight, water: state.water, nutrients: state.nutrients },
        gains: { sunlight: gains.sunlightGain, water: gains.waterGain, nutrients: gains.nutrientGain },
        majorEvent: eventResult.major?.key || null,
        minorEvents: eventResult.minors.map(e => e.effect),
      });
    }

    Math.random = originalRandom;
    return {
      seed,
      species: state.selectedSpecies,
      turnsPlayed,
      year: state.year,
      stage: state.lifeStage.name,
      score: state.score,
      allies: state.allies,
      viableSeeds: state.viableSeeds,
      offspringPool: state.offspringPool,
      health: state.health,
      maxHealth: state.maxHealth,
      victoryAchieved: state.victoryAchieved,
      gameOver: state.gameOver,
      deathCause: state.gameOver ? state.lastDamageCause : null,
      deathFlavor: state.gameOver ? deathFlavorForCause(state.lastDamageCause) : null,
      history,
    };
  }

  return { run };
}

const options = parseArgs(process.argv.slice(2));
const games = [];
for (let i = 0; i < options.games; i += 1) {
  const gameSeed = options.seed + i;
  const game = createHeadlessGame(gameSeed, options.species);
  games.push(game.run(options.turns));
}

const summary = {
  games: games.length,
  wins: games.filter(g => g.victoryAchieved).length,
  losses: games.filter(g => g.gameOver).length,
  averageScore: Number((games.reduce((sum, g) => sum + g.score, 0) / games.length).toFixed(2)),
  averageYears: Number((games.reduce((sum, g) => sum + g.year, 0) / games.length).toFixed(2)),
  byStage: Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, games.filter(g => g.stage === stage.name).length]).filter(([, count]) => count > 0)),
};

console.log(JSON.stringify({
  version: loadVersion(),
  mode: 'simulation-mvp',
  options,
  summary,
  games,
}, null, 2));
