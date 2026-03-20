import {
  SEASONS,
  LIFE_STAGES,
  STAGE_BY_NAME,
  SEASONAL_ACTIONS,
  LEADERBOARD_KEY,
  RELATIONSHIP_STATES,
  getRelationshipState,
  getLifeStage,
  getNeighborStage,
} from './core/constants.js';
import {
  SPECIES,
  getCurrentSpeciesSpec,
  getStageProgressIncrement,
  getSpeciesAdjustedCost,
  getAdjustedRelationshipDelta,
  getPollinatorChance,
  getDroughtResistance,
} from './core/species.js';
import {
  computeCurrentLifeStage as computeCurrentLifeStageFromState,
  turnsForYears,
  currentStageRequirements as getCurrentStageRequirements,
  getNextStage as getNextStageFromState,
  resetStageProgressCounters as resetStageProgressCountersForState,
} from './core/stages.js';
import { randomChoice, randomInt } from './core/random.js';
import { CATEGORY_NAMES, createActions, getActionAvailability } from './core/actions.js';
import {
  createMajorEvents,
  rollMajorEvent as rollMajorEventFromList,
  resolveFruitThreats as resolveFruitThreatsForState,
  processSeasonalReproduction as processSeasonalReproductionForState,
  resolveSeedFate as resolveSeedFateForCount,
  rollMinorEvents as rollMinorEventsForState,
} from './core/events.js';
import {
  applyRelationshipDelta as applyRelationshipDeltaForState,
  updateAlliesCount as updateAlliesCountForState,
  compareConflictPower as compareConflictPowerForState,
  checkAllyBetrayal as checkAllyBetrayalForState,
} from './core/diplomacy.js';
import { createEngine } from './core/engine.js';
import { renderActionPanels } from './ui/actions.js';
import { renderEventPhaseBody } from './ui/events.js';
import { showStandardModal } from './ui/modal.js';
import { showChoiceModalUI } from './ui/choice-modal.js';
import { renderResourcePhaseBody } from './ui/resources.js';
import { renderSpringSeedFateBody, renderVictoryBody } from './ui/outcomes.js';
import { renderSpeciesSummary, initSpeciesSelectUI } from './ui/species.js';
import { createLeaderboardStore, createRunRecord, renderLeaderboardBody } from './ui/leaderboard.js';
import { renderForestScene } from './ui/canvas.js';
import { showFeedbackUI, setTurnEndBannerUI, initTooltipsUI, initCollapsibleGroupsUI, updateHudUI } from './ui/hud.js';

function computeCurrentLifeStage() {
  return computeCurrentLifeStageFromState(state);
}

function currentStageRequirements() {
  return getCurrentStageRequirements(state);
}

function getNextStage() {
  return getNextStageFromState(state);
}

function resetStageProgressCounters() {
  resetStageProgressCountersForState(state);
}

function maybeShowGrowthNudge() {
  const reqs = currentStageRequirements();
  if (reqs.length !== 3) return false;
  const met = reqs.filter(r => r.met);
  const missing = reqs.filter(r => !r.met);
  if (met.length !== 2 || missing.length !== 1) return false;
  if (state.growthNudgeCooldown > 0) return false;

  const nudgeMap = {
    time: [
      'Your roots feel restless... something shifts slowly within.',
      'The seasons work on you in silence. Change is coming.',
    ],
    roots: [
      'Your taproot probes deeper, seeking something it cannot name.',
      'The soil below still holds something you need.',
    ],
    leaves: [
      'You feel an ache for wider green, for more light to hold.',
      'Your small crown longs to unfurl further into the air.',
    ],
    major: [
      'You sense storms approaching. Endurance will bring change.',
      'Hard weather will teach your fibers what they must become.',
    ],
    allies: [
      'Your roots touch others in the dark. Connection calls.',
      'The forest would know you better if you reached outward.',
    ],
  };

  const options = nudgeMap[missing[0].key] || ['Something in you strains toward its next form.'];
  const message = randomChoice(options);
  state.growthNudgeCooldown = 3 + randomInt(2);
  showModal('A Quiet Urge', `<p><em>${message}</em></p>`, () => {
    updateUI();
    render();
    if (state.phase === 'event') showResourcePhase();
    else resumeTurnFlow();
  });
  return true;
}

function resumeTurnFlow() {
  updateScore();
  updateUI();
  render();
  renderActions();
  if (state.actions <= 0) {
    showEventPhase();
  }
}

// Ally warning system - warns players they need to invest in diplomacy
function maybeShowAllyWarning() {
  const stage = computeCurrentLifeStage().name;
  
  // Only warn in stages where allies will be needed
  if (stage !== 'Sapling' && stage !== 'Small Tree' && stage !== 'Mature Tree') return false;
  
  // Don't warn if already have enough allies
  if (state.allies >= 1) return false;
  
  // Don't warn too frequently
  if (state.growthNudgeCooldown > 0) return false;
  
  // Calculate urgency based on stage
  let urgency = 0;
  if (stage === 'Sapling') urgency = 1; // Early warning
  if (stage === 'Small Tree') urgency = 2; // Getting close
  if (stage === 'Mature Tree') urgency = 3; // Critical
  
  const warnings = {
    1: [
      'Your roots sense other trees nearby. The fungal network awaits those who reach out.',
      'The forest grows stronger together. Solitude has its limits.',
    ],
    2: [
      'You feel the weight of growing alone. Ancient trees do not stand without kin.',
      'Your roots brush against others in the dark, but no bonds have formed. Time grows short.',
      'The path to Ancient requires connection. The soil remembers those who reach out.',
    ],
    3: [
      'URGENT: You stand at the threshold of greatness, but alone. Without allies, Ancient remains beyond reach.',
      'Your roots ache for connection. The fungal network is your only path forward now.',
      'Time runs short. Seek root connection, or your lineage ends here.',
    ],
  };
  
  const options = warnings[urgency] || warnings[1];
  const message = randomChoice(options);
  
  const titles = {
    1: 'A Whisper in the Soil',
    2: 'The Forest Reminds You',
    3: 'CRITICAL: Connection Needed',
  };
  
  state.growthNudgeCooldown = 4 + Math.floor(Math.random() * 2);
  showModal(titles[urgency], `<p><em>${message}</em></p><p><strong>Current allies:</strong> ${state.allies}/1 needed for Ancient</p>`, () => {
    updateUI();
    render();
    if (state.phase === 'event') showResourcePhase();
    else resumeTurnFlow();
  });
  return true;
}

function tryAdvanceLifeStage(onContinue) {
  const next = getNextStage();
  if (!next) return false;
  const reqs = currentStageRequirements();
  if (!reqs.length || reqs.every(r => r.met)) {
    state.lifeStage = next;
    resetStageProgressCounters();
    addLog(`You have grown. You are now a ${next.name}.`);
    showFeedback(`You are now a ${next.name}!`, 'success');
    showModal(next.name, `<p><em>${next.popup}</em></p>`, () => {
      updateScore();
      updateUI();
      render();
      if (onContinue) onContinue();
      else resumeTurnFlow();
    });
    return true;
  }
  return false;
}


function getCurrentSpeciesSpecForState() {
  return getCurrentSpeciesSpec(state);
}

function getStageProgressIncrementForState() {
  return getStageProgressIncrement(state);
}

function getSpeciesAdjustedCostForState(actionKey, baseCost) {
  return getSpeciesAdjustedCost(state, actionKey, baseCost, computeCurrentLifeStage());
}

function applyRelationshipDelta(neighbor, delta) {
  return applyRelationshipDeltaForState(state, neighbor, delta, getAdjustedRelationshipDelta);
}

function getPollinatorChanceForState(baseChance) {
  return getPollinatorChance(state, baseChance);
}

function getDroughtResistanceForState() {
  return getDroughtResistance(state);
}

// Cost scaling: base costs multiply by stage rank (Sapling=×2, Small Tree=×3, etc.)
function getScaledCost(baseCost, actionKey = null) {
  return getSpeciesAdjustedCostForState(actionKey, baseCost);
}

const ACTIONS = createActions({
  resinReserveAction,
  woodSurgeAction,
  attemptConnection,
  offerAidToAlly,
  requestHelpFromAllies,
  shadeRivalAction,
  rootDominionAction,
  getRelationshipState,
});

const state = {
  started: false,
  selectedSpecies: null,
  year: 1,
  seasonIndex: 0,
  turnInSeason: 1,
  score: 0,
  lifeStage: LIFE_STAGES[0],
  sunlight: 0,
  water: 0,
  nutrients: 0,
  actions: 0,
  branches: 0,
  rootZones: 0,
  leafClusters: 0,
  trunk: 0,
  flowers: 0,
  pollinated: 0,
  developing: 0,
  seeds: 0,
  viableSeeds: 0,
  allies: 0,
  health: 0,
  maxHealth: 0,
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
  eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0, soilBonus: 0, shelter: 0 },
  majorEvent: null,
  minorEvent: null,
  gameOver: false,
  victoryAchieved: false,
  // Diplomacy tracking
  neighbors: [],
  firstRootActionTaken: false,
  turnsInStage: 0,
  majorEventsSurvivedInStage: 0,
  growthNudgeCooldown: 3,
  hasProducedFruit: false,
  milestones: {},
  healthWarningLevel: 0,
  lastDamageCause: 'decline',
  pendingInteractions: [],
  recordsSavedThisRun: false,
};

const els = {
  speciesList: document.getElementById('species-list'),
  startGame: document.getElementById('start-game'),
  speciesPanel: document.getElementById('species-panel'),
  gamePanel: document.getElementById('game-panel'),
  hudPanel: document.getElementById('hud-panel'),
  canvas: document.getElementById('game-canvas'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalButton: document.getElementById('modal-button'),
  actionsList: document.getElementById('actions-list'),
  viewLeaderboard: document.getElementById('view-leaderboard'),
  log: document.getElementById('log'),
  feedbackContainer: document.getElementById('feedback-container'),
  tooltip: document.getElementById('tooltip'),
  actionsBanner: document.getElementById('actions-banner'),
  actionsRemaining: document.getElementById('actions-remaining'),
  turnEndBanner: document.getElementById('turn-end-banner'),
};

const ctx = els.canvas.getContext('2d');

// Floating feedback system
function initSpeciesSelect() {
  const names = Object.keys(SPECIES);
  const chosen = names[randomInt(names.length)];
  state.selectedSpecies = chosen;
  initSpeciesSelectUI(els, chosen, speciesName => renderSpeciesSummary(speciesName, SPECIES[speciesName], { title: `${speciesName} tree`, intro: 'You are a' }));
}

function startGame() {
  const spec = SPECIES[state.selectedSpecies];
  Object.assign(state, {
    started: true,
    year: 1,
    seasonIndex: 0,
    turnInSeason: 1,
    score: 0,
    lifeStage: LIFE_STAGES[0],
    sunlight: 5,
    water: 4,
    nutrients: 4,
    actions: 1,
    branches: 0,
    rootZones: 0,
    leafClusters: 0,
    trunk: 1,
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
    eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0, soilBonus: 0, shelter: 0 },
    gameOver: false,
    victoryAchieved: false,
    neighbors: makeStartingNeighbors(),
    firstRootActionTaken: false,
    turnsInStage: 0,
    majorEventsSurvivedInStage: 0,
    growthNudgeCooldown: 3 + Math.floor(Math.random() * 2),
    hasProducedFruit: false,
    milestones: {},
    healthWarningLevel: 0,
    lastDamageCause: 'decline',
    pendingInteractions: [],
    recordsSavedThisRun: false,
  });
  els.speciesPanel.classList.add('hidden');
  els.gamePanel.classList.remove('hidden');
  els.hudPanel.classList.remove('hidden');
  
  // Initialize UI features
  initTooltips();
  initCollapsibleGroups();
  
  addLog('You begin as a seed, buried in the dark soil.');
  updateUI();
  showResourcePhase();
}

let engine;

function currentSeason() { return engine.currentSeason(state); }


function showModal(title, body, onContinue) {
  return showStandardModal(els, title, body, onContinue);
}

const leaderboard = createLeaderboardStore({
  storage: localStorage,
  storageKey: LEADERBOARD_KEY,
  limit: 10,
});

function saveCurrentRunToLeaderboard(reason = 'game over') {
  const entry = createRunRecord(state, reason);
  leaderboard.saveRun(entry);
  state.recordsSavedThisRun = true;
  return entry;
}

function showLeaderboardModal() {
  showModal('Grove Records', renderLeaderboardBody(leaderboard.load()), () => {});
}

function generateSuccessionChoices(count = 3) {
  const templates = [
    {
      label: 'Deep-rooted heir',
      summary: 'Begins sturdier belowground, with better roots and a thicker trunk.',
      stats: {
        health: Math.max(6, Math.floor(state.maxHealth * 0.72)),
        maxHealth: Math.max(6, Math.floor(state.maxHealth * 0.72)),
        branches: Math.max(1, Math.floor(state.branches * 0.45)),
        rootZones: Math.max(2, Math.floor(state.rootZones * 0.75)),
        leafClusters: Math.max(1, Math.floor(state.leafClusters * 0.45)),
        trunk: Math.max(1, Math.floor(state.trunk * 0.75)),
      },
    },
    {
      label: 'Leaf-bright heir',
      summary: 'Starts with a livelier crown and more sunlight-gathering potential.',
      stats: {
        health: Math.max(6, Math.floor(state.maxHealth * 0.68)),
        maxHealth: Math.max(6, Math.floor(state.maxHealth * 0.68)),
        branches: Math.max(1, Math.floor(state.branches * 0.7)),
        rootZones: Math.max(1, Math.floor(state.rootZones * 0.5)),
        leafClusters: Math.max(2, Math.floor(state.leafClusters * 0.8)),
        trunk: Math.max(1, Math.floor(state.trunk * 0.5)),
      },
    },
    {
      label: 'Hardy survivor',
      summary: 'A balanced descendant carrying enough structure to recover steadily.',
      stats: {
        health: Math.max(7, Math.floor(state.maxHealth * 0.75)),
        maxHealth: Math.max(7, Math.floor(state.maxHealth * 0.75)),
        branches: Math.max(1, Math.floor(state.branches * 0.55)),
        rootZones: Math.max(1, Math.floor(state.rootZones * 0.6)),
        leafClusters: Math.max(1, Math.floor(state.leafClusters * 0.6)),
        trunk: Math.max(1, Math.floor(state.trunk * 0.6)),
      },
    },
  ];
  return templates.slice(0, Math.max(1, Math.min(count, templates.length)));
}

function continueAsSuccessor(choice) {
  state.offspringPool = Math.max(0, state.offspringPool - 1);
  state.offspringTrees = Math.max(0, state.offspringTrees - 1);
  state.health = choice.stats.health;
  state.maxHealth = choice.stats.maxHealth;
  state.branches = choice.stats.branches;
  state.rootZones = choice.stats.rootZones;
  state.leafClusters = choice.stats.leafClusters;
  state.trunk = choice.stats.trunk;
  state.flowers = 0;
  state.pollinated = 0;
  state.developing = 0;
  state.seeds = 0;
  state.sunlight = Math.max(0, Math.floor(state.sunlight * 0.35));
  state.water = Math.max(0, Math.floor(state.water * 0.35));
  state.nutrients = Math.max(0, Math.floor(state.nutrients * 0.35));
  addLog(`Your current tree died, but the lineage continues through a ${choice.label.toLowerCase()}.`);
  showFeedback('A chosen offspring carries the lineage onward.', 'warning');
  updateAlliesCount();
  updateScore();
  updateUI();
  render();
  showResourcePhase();
}

function showChoiceModal(title, body, choices) {
  return showChoiceModalUI(els, title, body, choices);
}

function processPendingInteractions(onDone) {
  if (!state.pendingInteractions.length) return onDone?.();
  const interaction = state.pendingInteractions.shift();
  interaction(() => processPendingInteractions(onDone));
}

function showResourcePhase() {
  if (state.gameOver) return;
  setTurnEndBanner('');
  return engine.startTurn(state, {
    addLog,
    presentResources: (gains) => {
      showModal('Your Tree Gathers...', renderResourcePhaseBody({ state, gains }), () => {
        renderActions();
      });
    },
  });
}

function canAfford(cost) {
  return state.sunlight >= (cost.sunlight || 0) && 
         state.water >= (cost.water || 0) && 
         state.nutrients >= (cost.nutrients || 0) && 
         state.actions > 0;
}

function spend(cost) {
  state.sunlight -= (cost.sunlight || 0);
  state.water -= (cost.water || 0);
  state.nutrients -= (cost.nutrients || 0);
  state.actions -= 1;
}

function makeStartingNeighbors() {
  const speciesNames = Object.keys(SPECIES);
  // Shuffle species and pick first 4 (or cycle if fewer than 4)
  const shuffled = [...speciesNames].sort(() => Math.random() - 0.5);
  const positions = [0, 1, 3, 4];
  return positions.map((slot, i) => {
    const species = shuffled[i % shuffled.length];
    const stageChoices = ['Sprout', 'Seedling', 'Sapling', 'Small Tree', 'Mature Tree'];
    const stageName = stageChoices[Math.floor(Math.random() * stageChoices.length)];
    const stage = LIFE_STAGES.find(x => x.name === stageName) || LIFE_STAGES[1];
    return {
      slot,
      species,
      relation: 0,
      stageScore: stage.threshold + Math.floor(Math.random() * 160),
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

function getNeighborAtSlot(idx) {
  return state.neighbors.find(n => n.slot === idx && !n.dead) || null;
}

function updateAlliesCount() {
  return updateAlliesCountForState(state, getRelationshipState);
}

function growNeighbors() {
  state.neighbors.forEach(n => {
    if (n.dead) return;
    n.stageScore += 20 + Math.floor(Math.random() * 35);
    if (getRelationshipState(n.relation).name === 'Hostile' && Math.random() < 0.25) {
      state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.08;
    }
  });
}

function chooseNeighborModal(onPick, filterFn = () => true, title = 'Choose a neighboring tree', body = 'Your roots probe the soil for a possible connection.', includeBack = false) {
  const choices = state.neighbors
    .filter(n => !n.dead)
    .filter(filterFn)
    .map(n => {
      const rel = getRelationshipState(n.relation).name.toLowerCase();
      const healthText = typeof n.health === 'number' && typeof n.maxHealth === 'number' ? ` · ${n.health}/${n.maxHealth} health` : '';
      return { label: `${n.species} (${rel}${healthText})`, onChoose: () => onPick(n) };
    });
  if (includeBack) choices.push({ label: 'Back', onChoose: () => resumeTurnFlow() });
  showChoiceModal(title, `<p>${body}</p>`, choices);
}

function relationshipFlavorChange(oldState, newState, species) {
  const key = `${oldState}->${newState}`;
  const lines = {
    'Ally->Dead': `The ${species} is gone from the grove. Its roots no longer answer yours.`,
    'Friendly->Dead': `The ${species} dies, and the soil falls quiet where it once spoke.`,
    'Neutral->Dead': `The ${species} dies and leaves an empty space in the grove.`,
    'Rival->Dead': `The ${species} dies. Even rivalry ends in silence.`,
    'Hostile->Dead': `The ${species} dies, and the chemical bitterness fades from the soil.`,
    'Neutral->Friendly': `The ${species} no longer treats you as a stranger. Your roots are noticed now.`,
    'Friendly->Ally': `The ${species} welcomes you fully. Beneath the soil, you are allies now.`,
    'Rival->Neutral': `The bitterness in the soil eases. The ${species} no longer treats you as a rival.`,
    'Hostile->Rival': `The ${species} still resents you, but the first fury has cooled into rivalry.`,
    'Hostile->Neutral': `The chemical war subsides. The ${species} withdraws its hatred and turns wary instead.`,
    'Friendly->Neutral': `The ${species} grows more guarded. The bond between you weakens.`,
    'Neutral->Rival': `The ${species} begins to contest your place in the forest.`,
    'Rival->Hostile': `The ${species} turns openly hostile. The soil itself feels poisonous.`,
  };
  return lines[key] || `Your standing with the ${species} changes: ${oldState} → ${newState}.`;
}

function showRelationshipChangeModal(species, oldState, newState, onContinue) {
  if (oldState === newState) return onContinue?.();
  showModal(`Relationship Shift: ${species}`, `<p><em>${relationshipFlavorChange(oldState, newState, species)}</em></p><p>Status changed from <strong>${oldState}</strong> to <strong>${newState}</strong>.</p>`, onContinue);
}

function maybeShowMilestone(key, title, body, onContinue) {
  if (state.milestones[key]) return false;
  state.milestones[key] = true;
  showModal(title, `<p><em>${body}</em></p>`, onContinue);
  return true;
}

function maybeTriggerActionMilestone(actionKey) {
  if (actionKey === 'extendRoot' && state.rootZones === 1) {
    return maybeShowMilestone('firstRoot', 'First Root', 'Your first root slips into the soil, tasting darkness, moisture, and promise.', () => {
      resumeTurnFlow();
    });
  }
  if (actionKey === 'growLeaves' && state.leafClusters === 1) {
    return maybeShowMilestone('firstLeaf', 'First Leaves', 'Your first leaves unfurl into the light. The sun is no longer a rumor but a source of life.', () => {
      resumeTurnFlow();
    });
  }
  if (actionKey === 'growLeaves' && state.leafClusters === 2) {
    return maybeShowMilestone('fullCrown', 'A Wider Reach', 'More green spreads above you. You are no longer merely surviving; you are beginning to claim space.', () => {
      resumeTurnFlow();
    });
  }
  return false;
}



function scaledAidNutrientCost(base = 10, neighbor = null, crisis = null) {
  const stageRank = computeCurrentLifeStage().rank;
  const severity = crisis?.severity || 1;
  return Math.min(25, Math.max(6, base + (stageRank - 1) * 2 + (severity - 1) * 4));
}

function updateNeighborAliveState(neighbor, cause = 'hardship') {
  if (!neighbor || neighbor.health > 0) return false;
  const oldState = getRelationshipState(neighbor.relation).name;
  neighbor.health = 0;
  neighbor.relation = -100;
  neighbor.ally = false;
  neighbor.dead = true;
  neighbor.activeCrises = [];
  addLog(`The ${neighbor.species} dies from ${cause}.`);
  updateAlliesCount();
  showModal('Ally Lost', `<p><em>The ${neighbor.species} falls silent in the grove.</em></p><p>Its health has reached zero, and its roots no longer answer yours.</p><p><strong>Cause:</strong> ${cause}</p>`, () => {
    showRelationshipChangeModal(neighbor.species, oldState, 'Dead', () => { updateUI(); render(); });
  });
  return true;
}

function crisisLabel(crisis) {
  const icon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
  return `${crisis.title} (${crisis.amount}${icon})`;
}

function createAllyCrisis(neighbor) {
  const options = [
    { kind: 'nutrients', title: 'Mite bloom', amount: 8, severity: 2, healthLoss: 2, flavors: [
      `The ${neighbor.species}'s bark crawls with mites. The infestation is eating into its reserves.`,
      `The ${neighbor.species} is still struggling with mites. The crawling pressure is spreading into fresh tissue.`,
      `The ${neighbor.species} is losing ground to the mites. Its distress comes through the roots in ragged pulses.`
    ]},
    { kind: 'water', title: 'Dry roots', amount: 7, severity: 2, healthLoss: 2, flavors: [
      `The ${neighbor.species}'s leaves hang limp. Its roots are finding only dust.`,
      `The ${neighbor.species} is still desiccating. It begs for water through the fungal dark.`,
      `The ${neighbor.species} is close to collapse from thirst. Even its cambium feels brittle.`
    ]},
    { kind: 'nutrients', title: 'Blight recovery', amount: 10, severity: 3, healthLoss: 3, flavors: [
      `The ${neighbor.species} has spent itself fighting blight. It needs dense reserves to recover.`,
      `The ${neighbor.species} is still trying to wall off blight. Its reserves are nearly gone.`,
      `The ${neighbor.species} can barely contain the blight now. Without rich help, it may die.`
    ]}
  ];
  const chosen = options[Math.floor(Math.random() * options.length)];
  return { ...chosen, stage: 0, id: `${Date.now()}-${Math.random()}` };
}

function maybeAddAllyCrisis(neighbor) {
  const allowMultiple = computeCurrentLifeStage().rank >= STAGE_BY_NAME['Small Tree'].rank;
  neighbor.activeCrises = neighbor.activeCrises || [];
  if (!allowMultiple && neighbor.activeCrises.length > 0) return null;
  const crisis = createAllyCrisis(neighbor);
  neighbor.activeCrises.push(crisis);
  return crisis;
}

function advanceAllyCrises(events) {
  for (const neighbor of state.neighbors) {
    if (getRelationshipState(neighbor.relation).name !== 'Ally') continue;
    neighbor.activeCrises = neighbor.activeCrises || [];
    if (neighbor.activeCrises.length === 0 && Math.random() < (state.allies === 1 ? 0.22 : 0.3)) maybeAddAllyCrisis(neighbor);
    for (const crisis of [...neighbor.activeCrises]) {
      const flavor = crisis.flavors[Math.min(crisis.stage, crisis.flavors.length - 1)];
      events.push({ text: flavor, effect: 'warning' });
      state.pendingInteractions.push((done) => showAllyAidRequest(neighbor, crisis, done));
      crisis.stage += 1;
      neighbor.health = Math.max(0, neighbor.health - crisis.healthLoss);
      if (neighbor.health <= 0) {
        events.push({ text: `The ${neighbor.species} finally gives way to ${crisis.title.toLowerCase()}.`, effect: 'damage' });
        updateNeighborAliveState(neighbor, crisis.title.toLowerCase());
      }
    }
  }
}

function showAllyAidRequest(neighbor, crisis, done) {
  const resIcon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
  const oldState = getRelationshipState(neighbor.relation).name;
  const available = state[crisis.kind];
  const title = `${neighbor.species} asks for help`;
  showChoiceModal(title, `<p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p><p>It needs <strong>${crisis.amount} ${resIcon} ${crisis.kind}</strong>.</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p><p><em>Your current reserves: ☀️${state.sunlight} · 💧${state.water} · 🌱${state.nutrients}</em></p>`, [
    {
      label: 'Give what you can',
      onChoose: () => {
        const given = Math.min(crisis.amount, available);
        state[crisis.kind] -= given;
        let relationDelta = 0;
        let body = '';
        if (given >= crisis.amount) {
          relationDelta = 12;
          neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + crisis.healthLoss + 2);
          neighbor.activeCrises = (neighbor.activeCrises || []).filter(c => c.id !== crisis.id);
          body = `You meet the full request. The ${neighbor.species} steadies and remembers your generosity.`;
        } else if (given > 0) {
          relationDelta = 2;
          neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + 1);
          crisis.amount = Math.max(1, crisis.amount - given);
          body = `You send ${given} ${crisis.kind}. It helps, but the crisis is not over.`;
        } else {
          relationDelta = -8;
          crisis.amount += 2;
          body = `You cannot send any of what it needs. The ${neighbor.species} feels the failure sharply.`;
        }
        neighbor.helpGivenToThem += given > 0 ? 1 : 0;
        neighbor.helpRefusedToThem += given <= 0 ? 1 : 0;
        applyRelationshipDelta(neighbor, relationDelta);
        const newState = getRelationshipState(neighbor.relation).name;
        showModal('Aid Given', `<p>${body}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
          updateAlliesCount(); updateScore(); updateUI(); render();
          showRelationshipChangeModal(neighbor.species, oldState, newState, done);
        });
      }
    },
    {
      label: 'Withhold your resources',
      onChoose: () => {
        neighbor.helpRefusedToThem += 1;
        crisis.amount += 2;
        neighbor.relation = Math.max(-100, neighbor.relation - 12);
        const newState = getRelationshipState(neighbor.relation).name;
        showModal('Aid Withheld', `<p>You keep your reserves. The ${neighbor.species} weakens and remembers the silence.</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
          updateAlliesCount(); updateScore(); updateUI(); render();
          showRelationshipChangeModal(neighbor.species, oldState, newState, done);
        });
      }
    }
  ]);
}

function checkAllyBetrayal(events) {
  return checkAllyBetrayalForState(state, events, {
    computeCurrentLifeStage,
    STAGE_BY_NAME,
    getRelationshipState,
    recordDamage,
    onRelationshipShift: (neighbor, oldState, newState) => {
      state.pendingInteractions.push((done) => {
        showRelationshipChangeModal(neighbor.species, oldState, newState, () => {
          updateAlliesCount(); updateScore(); updateUI(); render(); done();
        });
      });
    },
  });
}

function resinReserveAction(s) {
  showChoiceModal('Resin Reserve', '<p>How will you spend this dense pulse of nutrients?</p>', [
    { label: 'Saturate bark with bitter resin (−12🌱)', onChoose: () => { state.nutrients = Math.max(0, state.nutrients - 12); state.defense += 2; state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.95); showModal('Resin Reserve', '<p>Your tissues run bitter and guarded. Insects and infection will have a harder time taking hold.</p>', resumeTurnFlow); } },
    { label: 'Build emergency defensive stores (−16🌱)', onChoose: () => { state.nutrients = Math.max(0, state.nutrients - 16); state.fruitDefense += 2; state.eventModifiers.shelter = (state.eventModifiers.shelter || 0) + 1; showModal('Resin Reserve', '<p>You bank dense reserves against the next hardship, thickening your defensive chemistry.</p>', resumeTurnFlow); } },
    { label: 'Back', onChoose: () => resumeTurnFlow() }
  ]);
}

function woodSurgeAction(s) {
  showChoiceModal('Wood Surge', '<p>How will you spend this growth surge?</p>', [
    { label: 'Drive down and outward (−12🌱)', onChoose: () => { state.nutrients = Math.max(0, state.nutrients - 12); state.rootZones += 1; state.taprootDepth += 1; showModal('Wood Surge', '<p>You invest heavily belowground. Your roots thicken and your taproot pushes toward deeper water.</p>', resumeTurnFlow); } },
    { label: 'Lay on wood and crown (−16🌱)', onChoose: () => { state.nutrients = Math.max(0, state.nutrients - 16); state.trunk += 1; state.canopySpread += 1; state.leafClusters += 1; state.maxHealth += 1; state.health = Math.min(state.maxHealth, state.health + 1); showModal('Wood Surge', '<p>You turn surplus nutrients into wood, crown, and living strength.</p>', resumeTurnFlow); } },
    { label: 'Back', onChoose: () => resumeTurnFlow() }
  ]);
}

function offerAidToAlly(s) {
  const allies = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally');
  if (!allies.length) return resumeTurnFlow();
  const choose = (neighbor) => {
    const oldState = getRelationshipState(neighbor.relation).name;
    const crisis = (neighbor.activeCrises || [])[0] || null;
    const nutrientCost = scaledAidNutrientCost(8, neighbor, crisis);
    const waterCost = crisis?.kind === 'water' ? Math.min(10, Math.max(3, crisis.amount)) : 2;
    if (state.nutrients < nutrientCost || state.water < waterCost) {
      showModal('Aid Sent', `<p>You want to support the ${neighbor.species}, but you do not have the reserves to send meaningful help.</p><p><strong>Needed:</strong> 🌱${nutrientCost} · 💧${waterCost}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, resumeTurnFlow);
      return;
    }
    state.nutrients -= nutrientCost;
    state.water -= waterCost;
    neighbor.helpGivenToThem += 1;
    neighbor.lastAidMemory = 'you-gave-freely';
    applyRelationshipDelta(neighbor, crisis ? 10 : 8);
    neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + (crisis ? 3 : 2));
    if (crisis) neighbor.activeCrises = neighbor.activeCrises.filter(c => c.id !== crisis.id);
    const newState = getRelationshipState(neighbor.relation).name;
    const crisisLine = crisis ? `<p>Your aid helps the ${neighbor.species} push back ${crisis.title.toLowerCase()}.</p>` : '';
    showModal('Aid Sent', `<p>You send water and nutrients through the fungal dark to the ${neighbor.species}. It feels the gift and grows warmer toward you.</p>${crisisLine}<p><strong>Spent:</strong> 🌱${nutrientCost} · 💧${waterCost}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
      updateAlliesCount(); updateScore(); updateUI(); render();
      showRelationshipChangeModal(neighbor.species, oldState, newState, resumeTurnFlow);
    });
  };
  if (allies.length === 1) return choose(allies[0]);
  chooseNeighborModal(choose, n => getRelationshipState(n.relation).name === 'Ally', 'Offer aid to which ally?', 'Choose an allied tree to support.', true);
}

function shadeRivalAction(s) {
  const hostiles = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Hostile');
  if (!hostiles.length) return resumeTurnFlow();
  chooseNeighborModal((neighbor) => {
    neighbor.stageScore = Math.max(0, neighbor.stageScore - 30);
    neighbor.relation = Math.max(-100, neighbor.relation - 4);
    state.sunlight += 2;
    showModal('Shade Cast', `<p>You bend your growing crown toward the ${neighbor.species}, stealing back light it would have taken from you.</p><p>You gain <strong>2 sunlight</strong>.</p>`, resumeTurnFlow);
  }, n => getRelationshipState(n.relation).name === 'Hostile', 'Shade which rival?', 'Choose a hostile tree to suppress.', true);
}

function rootDominionAction(s) {
  let affected = 0;
  state.neighbors.forEach(n => {
    if (getRelationshipState(n.relation).name === 'Hostile') {
      n.stageScore = Math.max(0, n.stageScore - 50);
      n.relation = Math.max(-100, n.relation - 6);
      affected += 1;
    }
  });
  state.sunlight += affected;
  state.nutrients += affected;
  showModal('Root Dominion', `<p>Your roots seize the contested soil. Hostile trees recoil from your underground dominance.</p><p><strong>${affected}</strong> rival tree${affected !== 1 ? 's were' : ' was'} pressured. You gain <strong>${affected} sunlight</strong> and <strong>${affected} nutrients</strong>.</p>`, resumeTurnFlow);
}

function requestHelpFromAllies(s) {
  const allies = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally');
  if (!allies.length) {
    showFeedback('No allies are close enough to help', 'warning');
    resumeTurnFlow();
    return;
  }
  const askOne = (neighbor) => {
    neighbor.timesAskedThemForHelp += 1;
    const favorBalance = neighbor.helpGivenToThem - neighbor.timesAskedThemForHelp;
    const stageBonus = Math.max(0, getNeighborStage(neighbor.stageScore).rank - 1);
    const rawHeal = 2 + Math.floor(Math.random() * 4) + Math.max(0, stageBonus > 2 ? 1 : 0);
    const heal = Math.max(2, Math.min(5, rawHeal));
    const actualHeal = Math.min(heal, state.maxHealth - state.health);
    let relationShift = 6;
    let tone = `The ${neighbor.species} sends strength through the fungal dark.`;
    if (favorBalance < -2) {
      relationShift = -4;
      tone = `The ${neighbor.species} answers, but coolly. You have asked much of it lately, and given little in return.`;
    } else if (neighbor.helpGivenToThem > neighbor.helpRefusedToThem) {
      relationShift = 10;
      tone = `The ${neighbor.species} remembers that you answered its need before. It sends help with warmth.`;
    }
    state.health += actualHeal;
    neighbor.helpReceivedFromThem += 1;
    const oldState = getRelationshipState(neighbor.relation).name;
    applyRelationshipDelta(neighbor, relationShift);
    const newState = getRelationshipState(neighbor.relation).name;
    neighbor.lastAidMemory = actualHeal > 0 ? 'helped-you' : 'could-not-help';
    addLog(`${tone} You recover ${actualHeal} health from ${neighbor.species}.`);
    showModal('Allied Aid', `<p>${tone}</p><p><strong>${neighbor.species}</strong> gives you <strong>${actualHeal} health</strong>.</p>`, () => {
      updateAlliesCount(); updateScore(); updateUI(); render(); renderActions();
      showRelationshipChangeModal(neighbor.species, oldState, newState, () => {
        updateAlliesCount(); updateScore(); updateUI(); render(); renderActions();
        if (state.actions <= 0) showEventPhase();
      });
    });
  };
  if (allies.length === 1) return askOne(allies[0]);
  chooseNeighborModal(askOne, n => getRelationshipState(n.relation).name === 'Ally', 'Ask an ally for help', 'Choose which allied tree you are asking to support you.', true);
}

function attemptConnection(s) {
  chooseNeighborModal((neighbor) => {
    const rootBonus = Math.min(0.35, Math.max(0, state.rootZones - 2) * 0.08);
    const oldState = getRelationshipState(neighbor.relation).name;
    const roll = Math.random();
    let message = '';
    let feedback = { text: '', type: 'info' };

    if (oldState === 'Ally') {
      applyRelationshipDelta(neighbor, 10);
      message = `Your roots find the familiar touch of the ${neighbor.species}. Resources and signals pass warmly between you.`;
      feedback = { text: `${neighbor.species} strengthens your alliance`, type: 'success' };
    } else if (oldState === 'Friendly') {
      if (roll < 0.7 + rootBonus) {
        applyRelationshipDelta(neighbor, 20);
        message = `The ${neighbor.species} answers your overture with quiet warmth, opening more of its root network to you.`;
        feedback = { text: `${neighbor.species} welcomed your roots`, type: 'success' };
      } else {
        applyRelationshipDelta(neighbor, -5);
        message = `The ${neighbor.species} hesitates. It does not reject you, but keeps part of itself withheld.`;
        feedback = { text: `${neighbor.species} grew cautious`, type: 'info' };
      }
    } else if (oldState === 'Neutral') {
      if (roll < 0.50 + rootBonus) { // INCREASED from 0.35 to 0.50
        applyRelationshipDelta(neighbor, 20);
        message = `The ${neighbor.species} pauses, then accepts your tentative underground greeting.`;
        feedback = { text: `${neighbor.species} responded cautiously`, type: 'success' };
      } else if (roll < 0.75) {
        applyRelationshipDelta(neighbor, 2);
        message = `The ${neighbor.species} senses you, but offers little in return. For now, the soil remains politely quiet.`;
        feedback = { text: `${neighbor.species} mostly ignored you`, type: 'info' };
      } else {
        applyRelationshipDelta(neighbor, -15);
        message = `The ${neighbor.species} interprets your reach as intrusion and releases a bitter pulse through the soil.`;
        state.health = Math.max(0, state.health - 1);
        recordDamage(1, 'chemicals');
        feedback = { text: `${neighbor.species} rebuffed you`, type: 'error' };
      }
    } else if (oldState === 'Rival') {
      if (roll < 0.18 + rootBonus) {
        applyRelationshipDelta(neighbor, 18);
        message = `After a tense silence, the ${neighbor.species} relents. The rivalry softens, if only a little.`;
        feedback = { text: `${neighbor.species} softened`, type: 'success' };
      } else {
        applyRelationshipDelta(neighbor, -12);
        message = `The ${neighbor.species} answers with defensive chemistry, warning you that the rivalry is still alive.`;
        state.health = Math.max(0, state.health - 1);
        recordDamage(1, 'chemicals');
        state.nutrients = Math.max(0, state.nutrients - 1);
        feedback = { text: `${neighbor.species} retaliated`, type: 'error' };
      }
    } else if (oldState === 'Hostile') {
      if (roll < 0.08 + rootBonus) {
        applyRelationshipDelta(neighbor, 30);
        message = `Against all expectation, the ${neighbor.species} does not strike. Its hatred cools, though distrust still lingers.`;
        feedback = { text: `${neighbor.species} cooled slightly`, type: 'success' };
      } else {
        applyRelationshipDelta(neighbor, -8);
        message = `The ${neighbor.species} reacts at once, flooding the soil with hostile chemicals. Your tissues burn with the warning.`;
        state.health = Math.max(0, state.health - 2);
        recordDamage(2, 'chemicals');
        state.water = Math.max(0, state.water - 1);
        state.nutrients = Math.max(0, state.nutrients - 1);
        feedback = { text: `${neighbor.species} struck back violently`, type: 'error' };
      }
    }

    const newState = getRelationshipState(neighbor.relation).name;
    neighbor.ally = newState === 'Ally';
    addLog(message);
    showFeedback(feedback.text, feedback.type);
    updateAlliesCount();
    updateScore();
    updateUI();
    render();
    renderActions();

    showModal(`Root Contact: ${neighbor.species}`, `<p>${message}</p><p><strong>Current relationship:</strong> ${newState}</p>`, () => {
      updateUI();
      render();
      renderActions();
      showRelationshipChangeModal(neighbor.species, oldState, newState, () => {
        updateUI();
        render();
        renderActions();
      });
    });
  });
}

function getNeighborTree(idx) {
  if (idx === 2) return null;
  if (idx === 0 && state.offspringTrees > 0) {
    const childStage = getLifeStage(Math.max(120, state.score * 0.2));
    return {
      species: state.selectedSpecies || 'Plum',
      age: Math.max(0.25, childStage.threshold / 2000),
      health: 0.8,
      branches: Math.max(1, Math.min(4, Math.floor(childStage.threshold / 300) + 1)),
      roots: Math.max(2, Math.min(4, Math.floor(childStage.threshold / 300) + 2)),
      trunk: Math.max(1, Math.min(3, Math.floor(childStage.threshold / 800) + 1)),
      ally: true,
      offspring: true,
      stageName: childStage.name,
    };
  }
  const base = getNeighborAtSlot(idx);
  if (!base) return null;
  const stage = getNeighborStage(base.stageScore);
  return {
    species: base.species,
    age: Math.max(0.25, stage.threshold / 2000),
    health: 0.6 + Math.min(0.3, stage.threshold / 6000),
    branches: Math.max(1, Math.min(5, Math.floor(stage.threshold / 300) + 1)),
    roots: Math.max(2, Math.min(6, Math.floor(stage.threshold / 300) + 2)),
    trunk: Math.max(1, Math.min(4, Math.floor(stage.threshold / 700) + 1)),
    ally: getRelationshipState(base.relation).name === 'Ally',
    relationName: getRelationshipState(base.relation).name,
    stageName: stage.name,
  };
}

function isActionUnlocked(actionKey) {
  const unlockStage = LIFE_STAGES.find(stage => stage.unlocks.includes(actionKey));
  const currentStage = computeCurrentLifeStage();
  if (!unlockStage || !currentStage) return false;
  return currentStage.rank >= unlockStage.rank;
}

function getAffordableActions() {
  return ACTIONS.filter(action => {
    if (action.hideAt) {
      const hideStage = LIFE_STAGES.find(s => s.name === action.hideAt);
      if (hideStage && computeCurrentLifeStage().rank >= hideStage.rank) return false;
    }
    const prereqOk = action.prereq ? action.prereq(state) : true;
    const affordable = canAfford(getScaledCost(action.baseCost, action.key));
    const unlocked = isActionUnlocked(action.key);
    const allowedSeasons = SEASONAL_ACTIONS[action.key];
    const seasonLocked = allowedSeasons && !allowedSeasons.includes(currentSeason().name);
    return prereqOk && affordable && unlocked && !seasonLocked;
  });
}

function renderActions() {
  els.actionsList.innerHTML = '';

  const currentStageName = computeCurrentLifeStage().name;
  const currentStageRank = computeCurrentLifeStage().rank;

  // Group actions by category
  const categories = { growth: [], defense: [], diplomacy: [], reproduction: [] };
  const futureActions = [];

  ACTIONS.forEach(action => {
    const availability = getActionAvailability({
      action,
      state,
      lifeStages: LIFE_STAGES,
      currentStageRank,
      currentSeasonName: currentSeason().name,
      seasonalActions: SEASONAL_ACTIONS,
      getScaledCost,
      canAfford,
      isActionUnlocked,
    });
    if (availability.hidden) return;

    const { scaledCost, usable, reason } = availability;

    const sunRequired = scaledCost.sunlight || 0;
    const waterRequired = scaledCost.water || 0;
    const nutRequired = scaledCost.nutrients || 0;
    const sunEnough = state.sunlight >= sunRequired;
    const waterEnough = state.water >= waterRequired;
    const nutEnough = state.nutrients >= nutRequired;
    const sunClass = sunEnough ? 'res-sun' : 'res-sun res-low';
    const waterClass = waterEnough ? 'res-water' : 'res-water res-low';
    const nutClass = nutEnough ? 'res-nutrient' : 'res-nutrient res-low';

    let costsHtml = '<div class="action-costs">';
    if (sunRequired > 0) costsHtml += `<span class="cost ${sunClass}">☀️${sunRequired}</span>`;
    if (waterRequired > 0) costsHtml += `<span class="cost ${waterClass}">💧${waterRequired}</span>`;
    if (nutRequired > 0) costsHtml += `<span class="cost ${nutClass}">🌱${nutRequired}</span>`;
    costsHtml += '</div>';

    const actionData = { action, scaledCost, costsHtml, sunRequired, waterRequired, nutRequired };

    if (usable) {
      if (categories[action.category]) {
        categories[action.category].push(actionData);
      }
    } else {
      futureActions.push({ ...actionData, reason });
    }
  });

  if (state.actions > 0 && Object.values(categories).every(arr => arr.length === 0)) {
    const warning = document.createElement('div');
    warning.className = 'nothing-affordable';
    warning.innerHTML = `<strong>⚠️ No action available</strong>Your tree can do nothing more this turn. Time will move on.`;
    els.actionsList.appendChild(warning);
    setTurnEndBanner('No usable action remains. Night will fall as soon as this phase closes.');
    setTimeout(() => {
      if (els.modal.classList.contains('hidden')) {
        showEventPhase();
      }
    }, 700);
    return;
  }

  renderActionPanels({
    els,
    categories,
    futureActions,
    categoryNames: CATEGORY_NAMES,
    onUseAction: (action, scaledCost) => {
      engine.executeAction(state, action, scaledCost, {
        spend,
        showFeedback,
        addLog,
        maybeTriggerActionMilestone,
        resumeTurnFlow,
        renderActions,
        showEventPhase,
      });
    },
    onFinishTurn: () => {
      showFeedback('Turn ended early', 'info');
      showEventPhase();
    },
  });
}
// Escalating threats: damage increases after year 10
function getThreatMultiplier() {
  if (state.year < 10) return 1;
  return 1 + ((state.year - 10) * 0.1); // +10% per year after 10
}

// Expanded event pool with real botany/ecology inspiration
const MAJOR_EVENTS = createMajorEvents({
  getThreatMultiplier,
  recordDamage,
  getDroughtResistance: getDroughtResistanceForState,
  getRelationshipState,
  updateNeighborAliveState,
  updateAlliesCount,
});

engine = createEngine({
  SEASONS,
  computeCurrentLifeStage,
  getStageProgressIncrement: getStageProgressIncrementForState,
  rollMajorEvent,
  rollMinorEvents,
  resolveSeedFate,
  updateAlliesCount,
  growNeighbors,
  tryAdvanceLifeStage,
  maybeShowGrowthNudge,
  maybeShowAllyWarning,
  showResourcePhase,
  updateScore,
  updateUI,
  render,
  showModal,
  processPendingInteractions,
  maybeShowHealthWarning,
  saveCurrentRunToLeaderboard,
  deathFlavor,
  generateSuccessionChoices,
  continueAsSuccessor,
  showChoiceModal,
  renderSpringSeedFateBody,
  renderGameOverBody,
  renderSuccessionBody,
  renderVictoryBody,
});

function resolveFruitThreats(events) {
  return resolveFruitThreatsForState(state, events);
}

function processSeasonalReproduction(events) {
  return processSeasonalReproductionForState(state, events, () => currentSeason().name);
}

function resolveSeedFate(seedCount) {
  return resolveSeedFateForCount(seedCount);
}


function compareConflictPower(neighbor) {
  return compareConflictPowerForState(state, neighbor, getNeighborStage);
}

function queueHostileTreeThreat(neighbor, events) {
  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const DIPLOMACY_COST = { sunlight: 5, water: 2, nutrients: 3 };

  events.push({ text: `The hostile ${neighbor.species} crowds your light and tangles the soil around your roots.`, effect: 'warning' });
  state.pendingInteractions.push((done) => {
    const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight &&
                             state.water >= DEFENSE_COST.water &&
                             state.nutrients >= DEFENSE_COST.nutrients;
    const canAffordDiplomacy = state.sunlight >= DIPLOMACY_COST.sunlight &&
                                state.water >= DIPLOMACY_COST.water &&
                                state.nutrients >= DIPLOMACY_COST.nutrients;

    const costText = `☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}`;
    const diploText = `☀️${DIPLOMACY_COST.sunlight} 💧${DIPLOMACY_COST.water} 🌱${DIPLOMACY_COST.nutrients}`;

    showChoiceModal('Hostile Encroachment',
      `<p><em>A hostile ${neighbor.species} presses into your space, trying to steal your sunlight and entangle your roots.</em></p>` +
      `<p><strong>Your resources:</strong> ☀️${state.sunlight} 💧${state.water} 🌱${state.nutrients}</p>`, [
      {
        label: canAffordDefense ? `Chemical battle (${costText})` : `Chemical battle (${costText}) — too costly right now`,
        onChoose: () => {
          // Re-check resources at click time
          const hasResources = state.sunlight >= DEFENSE_COST.sunlight &&
                               state.water >= DEFENSE_COST.water &&
                               state.nutrients >= DEFENSE_COST.nutrients;
          if (!hasResources) {
            // Not enough resources - apply penalty
            state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
            const lostSun = Math.min(state.sunlight, 2);
            state.sunlight -= lostSun;
            neighbor.relation = Math.max(-100, neighbor.relation - 4);
            showModal('Space Lost', `<p>You lack the resources to defend yourself. The ${neighbor.species} steals your light.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`, () => {
              updateScore(); updateUI(); render(); done();
            });
            return;
          }

          // Deduct cost
          state.sunlight -= DEFENSE_COST.sunlight;
          state.water -= DEFENSE_COST.water;
          state.nutrients -= DEFENSE_COST.nutrients;

          const oldState = getRelationshipState(neighbor.relation).name;
          const { yourPower, theirPower } = compareConflictPower(neighbor);
          const swing = yourPower - theirPower + Math.floor(Math.random() * 5) - 2;
          let body = '';
          if (swing >= 2) {
            const stolenSun = Math.max(1, Math.min(3, Math.floor(Math.random() * 3) + 1));
            const stolenWater = Math.max(0, Math.min(2, Math.floor(Math.random() * 2)));
            const stolenNutrients = Math.max(1, Math.min(3, Math.floor(Math.random() * 3) + 1));
            state.sunlight += stolenSun; state.water += stolenWater; state.nutrients += stolenNutrients;
            neighbor.stageScore = Math.max(0, neighbor.stageScore - 40);
            neighbor.relation = Math.max(-100, neighbor.relation - 6);
            body = `Your chemistry turns the contested ground against the ${neighbor.species}. You siphon <strong>${stolenSun} sunlight</strong>, <strong>${stolenWater} water</strong>, and <strong>${stolenNutrients} nutrients</strong>.`;
          } else if (swing <= -2) {
            const lostSun = Math.min(state.sunlight, Math.max(1, Math.floor(Math.random() * 3) + 1));
            const lostWater = Math.min(state.water, Math.max(0, Math.floor(Math.random() * 2)));
            const lostNutrients = Math.min(state.nutrients, Math.max(1, Math.floor(Math.random() * 3) + 1));
            state.sunlight -= lostSun; state.water -= lostWater; state.nutrients -= lostNutrients;
            neighbor.stageScore += 40;
            neighbor.relation = Math.max(-100, neighbor.relation - 8);
            body = `The ${neighbor.species} overpowers you in the soil-war, stripping away <strong>${lostSun} sunlight</strong>, <strong>${lostWater} water</strong>, and <strong>${lostNutrients} nutrients</strong>.`;
          } else {
            neighbor.relation = Math.max(-100, neighbor.relation - 2);
            body = `The struggle poisons the ground between you, but neither of you yields. You repel the ${neighbor.species}, for now.`;
          }
          const newState = getRelationshipState(neighbor.relation).name;
          showModal('Chemical Battle', `<p>${body}</p><p><em>Spent: ${costText}</em></p><p><strong>Your resources now:</strong> ☀️ ${state.sunlight} · 💧 ${state.water} · 🌱 ${state.nutrients}</p>`, () => {
            updateAlliesCount(); updateScore(); updateUI(); render();
            showRelationshipChangeModal(neighbor.species, oldState, newState, done);
          });
        }
      },
      {
        label: canAffordDiplomacy ? `Attempt diplomacy (${diploText})` : `Attempt diplomacy (${diploText}) — too costly right now`,
        onChoose: () => {
          // Re-check resources at click time
          const hasResources = state.sunlight >= DIPLOMACY_COST.sunlight &&
                               state.water >= DIPLOMACY_COST.water &&
                               state.nutrients >= DIPLOMACY_COST.nutrients;
          if (!hasResources) {
            // Not enough resources - apply penalty
            state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
            const lostSun = Math.min(state.sunlight, 2);
            state.sunlight -= lostSun;
            neighbor.relation = Math.max(-100, neighbor.relation - 4);
            showModal('Space Lost', `<p>You lack the resources for diplomacy. The ${neighbor.species} steals your light.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`, () => {
              updateScore(); updateUI(); render(); done();
            });
            return;
          }

          // Deduct cost
          state.sunlight -= DIPLOMACY_COST.sunlight;
          state.water -= DIPLOMACY_COST.water;
          state.nutrients -= DIPLOMACY_COST.nutrients;

          const oldState = getRelationshipState(neighbor.relation).name;
          const rootBonus = Math.min(0.25, Math.max(0, state.rootZones - 3) * 0.05);
          const roll = Math.random();
          let body = '';
          let success = false;

          if (roll < 0.35 + rootBonus) {
            // Success - improve relationship
            applyRelationshipDelta(neighbor, 25);
            neighbor.stageScore = Math.max(0, neighbor.stageScore - 20);
            body = `You extend your roots with gifts of nutrients and a tentative truce. The ${neighbor.species} hesitates, then accepts. The hostility between you softens into wary neutrality.`;
            success = true;
          } else if (roll < 0.65 + rootBonus) {
            // Partial success - small improvement but still hostile
            applyRelationshipDelta(neighbor, 8);
            body = `Your overture is met with suspicion. The ${neighbor.species} does not attack, but keeps its distance. The soil between you remains tense.`;
          } else {
            // Failure - wasted resources, relation worsens slightly
            applyRelationshipDelta(neighbor, -5);
            neighbor.stageScore += 20;
            body = `The ${neighbor.species} interprets your gifts as weakness and presses harder. Your diplomacy failed, and the rivalry deepens.`;
          }

          const newState = getRelationshipState(neighbor.relation).name;
          showModal(success ? 'Diplomacy Succeeded' : 'Diplomacy Attempt', `<p>${body}</p><p><em>Spent: ${diploText}</em></p><p><strong>Your resources now:</strong> ☀️ ${state.sunlight} · 💧 ${state.water} · 🌱 ${state.nutrients}</p>`, () => {
            updateAlliesCount(); updateScore(); updateUI(); render();
            showRelationshipChangeModal(neighbor.species, oldState, newState, done);
          });
        }
      },
      {
        label: 'Endure and conserve strength',
        onChoose: () => {
          state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
          const lostSun = Math.min(state.sunlight, 2);
          state.sunlight -= lostSun;
          neighbor.relation = Math.max(-100, neighbor.relation - 4);
          showModal('Space Lost', `<p>You hold back. The ${neighbor.species} steals some of your light while your roots yield ground.</p><p>You lose <strong>${lostSun} sunlight</strong>.</p>`, () => {
            updateScore(); updateUI(); render(); done();
          });
        }
      }
    ]);
  });
}

function queueAllyAidRequest(neighbor, events) {
  // Ally crises are now managed by advanceAllyCrises().
}

function queueChemicalDefenseThreat(events) {
  const DEFENSE_COST = { sunlight: 3, water: 1, nutrients: 2 };
  const canAffordDefense = state.sunlight >= DEFENSE_COST.sunlight &&
                           state.water >= DEFENSE_COST.water &&
                           state.nutrients >= DEFENSE_COST.nutrients;

  const currentStage = computeCurrentLifeStage().name;
  let threats;

  if (currentStage === 'Seedling') {
    threats = [
      {
        title: 'Aphid Cluster',
        warning: 'Tiny aphids gather on your tender stem, piercing and sucking at your sap.',
        defend: () => { state.defense += 1; return 'You release sticky compounds that trap the aphids. They fall away, unable to feed.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); recordDamage(1, 'insects'); return 'The aphids feast unchecked, draining your strength. You lose 1 leaf cluster and 1 health.'; }
      },
      {
        title: 'Surface Crawlers',
        warning: 'Small insects swarm the soil surface around your base, nibbling at your tender roots.',
        defend: () => { state.defense += 1; return 'You release defensive compounds into the soil. The crawlers retreat from your roots.'; },
        ignore: () => { state.rootZones = Math.max(0, state.rootZones - 1); state.health = Math.max(0, state.health - 1); recordDamage(1, 'insects'); return 'The insects damage your shallow roots. You lose 1 root zone and 1 health.'; }
      },
      {
        title: 'Damp Rot',
        warning: 'The soil around you stays too wet. Mold creeps up your tender stem.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize protective chemistry. The mold cannot take hold on your tissues.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); recordDamage(2, 'blight'); return 'The damp rot spreads. You lose 2 health as your stem weakens.'; }
      }
    ];
  } else {
    threats = [
      {
        title: 'Mite Surge',
        warning: 'Tiny mites mass along your bark and tender leaves, itching and feeding in their thousands.',
        defend: () => { state.defense += 1; return 'You flood your tissues with bitter compounds. The mites retreat before they can do serious harm.'; },
        ignore: () => { state.leafClusters = Math.max(0, state.leafClusters - 1); state.health = Math.max(0, state.health - 1); recordDamage(1, 'insects'); return 'You do nothing. The mites feast, costing you 1 leaf cluster and 1 health.'; }
      },
      {
        title: 'Hungry Browsers',
        warning: 'Warm-blooded mouths nose through your lower growth, searching for tender shoots and leaves.',
        defend: () => {
          state.fruitDefense += 1;
          if (state.developing > 0) return 'You turn your tissues bitter. The browsers recoil before they can strip your leaves or reach your fruit.';
          return 'You turn your tissues bitter. The browsers recoil before they can strip your young growth.';
        },
        ignore: () => {
          const lostFruit = Math.min(2, state.developing);
          if (lostFruit > 0) state.developing = Math.max(0, state.developing - lostFruit);
          state.leafClusters = Math.max(0, state.leafClusters - 1);
          recordDamage(1, 'insects');
          if (lostFruit > 0) return `You leave yourself undefended. Browsers strip 1 leaf cluster and ruin ${lostFruit} fruit.`;
          return 'You leave yourself undefended. Browsers strip 1 leaf cluster and chew through your tender new growth.';
        }
      },
      {
        title: 'Spores on the Damp Air',
        warning: 'Damp air clings too long. Spores settle into tender tissues and wounded places.',
        defend: () => { state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.9); return 'You mobilize defensive chemistry before the infection can take hold.'; },
        ignore: () => { state.health = Math.max(0, state.health - 2); recordDamage(2, 'blight'); return 'Blight takes hold. You lose 2 health to spreading infection.'; }
      }
    ];
  }
  const threat = threats[Math.floor(Math.random() * threats.length)];
  const costText = `☀️${DEFENSE_COST.sunlight} 💧${DEFENSE_COST.water} 🌱${DEFENSE_COST.nutrients}`;
  const affordText = canAffordDefense ? 'You can afford this response.' : 'You do not have enough stored resources for this response.';
  state.pendingInteractions.push((done) => {
    const choices = [
      {
        label: canAffordDefense ? `Release defensive compounds (${costText})` : `Release defensive compounds (${costText}) — too costly right now`,
        onChoose: () => {
          const hasResourcesNow = state.sunlight >= DEFENSE_COST.sunlight && state.water >= DEFENSE_COST.water && state.nutrients >= DEFENSE_COST.nutrients;
          if (!hasResourcesNow) {
            state.pendingChemicalThreat = threat;
            showModal(threat.title, `<p>You do not have enough reserves to mount a chemical defense. The danger will crest next turn.</p>`, () => { updateScore(); updateUI(); render(); done(); });
            return;
          }
          state.sunlight -= DEFENSE_COST.sunlight;
          state.water -= DEFENSE_COST.water;
          state.nutrients -= DEFENSE_COST.nutrients;
          const body = threat.defend();
          showModal(threat.title, `<p>${body}</p><p><em>Spent: ${costText}</em></p>`, () => { updateScore(); updateUI(); render(); done(); });
        }
      },
      {
        label: 'Conserve strength',
        onChoose: () => {
          state.pendingChemicalThreat = threat;
          showModal(threat.title, `<p>You conserve your reserves. The danger is not gone; it will break over you next turn.</p>`, () => { updateScore(); updateUI(); render(); done(); });
        }
      }
    ];
    showChoiceModal(threat.title, `<p><em>${threat.warning}</em></p><p>How do you respond?</p><p><strong>Defense cost:</strong> ${costText}</p><p><strong>Your resources:</strong> ☀️${state.sunlight} 💧${state.water} 🌱${state.nutrients}</p><p><em>${affordText}</em></p>`, choices);
  });
}

function rollMajorEvent() {
  return rollMajorEventFromList(MAJOR_EVENTS);
}

function rollMinorEvents() {
  return rollMinorEventsForState(state, {
    currentSeasonName: currentSeason().name,
    getPollinatorChance: getPollinatorChanceForState,
    species: SPECIES,
    recordDamage,
    STAGE_BY_NAME,
    getRelationshipState,
    advanceAllyCrises: (events) => advanceAllyCrises(events),
    checkAllyBetrayal: (events) => checkAllyBetrayal(events),
    queueHostileTreeThreat: (target, events) => queueHostileTreeThreat(target, events),
    queueChemicalDefenseThreat: (events) => queueChemicalDefenseThreat(events),
    computeCurrentLifeStage,
  });
}

function recordDamage(amount, cause) {
  if (amount > 0) state.lastDamageCause = cause || 'decline';
}

function healthWarningBand() {
  const ratio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
  if (ratio <= 0.10) return 4;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.45) return 2;
  if (ratio <= 0.70) return 1;
  return 0;
}

function healthWarningContent(level) {
  const content = {
    1: {
      title: 'Wounded',
      body: 'Something is wrong. Your tissues ache, and your leaves hang heavy. You can still recover, but the forest has begun to press against you.'
    },
    2: {
      title: 'Struggling',
      body: 'Stress spreads through you. Water and strength are no longer reaching every branch. What was once discomfort is becoming danger.'
    },
    3: {
      title: 'Critical',
      body: 'You are failing. Your roots weaken, your crown dims, and death presses close. Immediate relief is no longer optional.'
    },
    4: {
      title: 'Near Death',
      body: 'Your life is slipping away. Sap slows, tissues fail, and the forest waits in silence. Without help, this season may be your last.'
    }
  };
  return content[level];
}

function maybeShowHealthWarning(onContinue) {
  const level = healthWarningBand();
  if (level > state.healthWarningLevel) {
    state.healthWarningLevel = level;
    const warning = healthWarningContent(level);
    showModal(warning.title, `<p><em>${warning.body}</em></p>`, onContinue);
    return true;
  }
  if (level === 0) state.healthWarningLevel = 0;
  else if (level < state.healthWarningLevel) state.healthWarningLevel = level;
  return false;
}

function deathFlavor(cause) {
  const map = {
    drought: 'The soil gave less and less, until at last there was nothing left to draw. You dried where you stood.',
    fire: 'Flame climbed your bark and ran your crown in a single bright hunger. By morning, only blackened wood remained.',
    blight: 'Rot spread quietly through your tissues, turning strength to weakness until you could no longer hold yourself together.',
    storm: 'Wind found every weakness in your form. When the storm passed, you could not rise from what it had broken.',
    insects: 'Too many mouths found you tender. Piece by piece, stress and hunger hollowed out your strength.',
    frost: 'Cold entered the living places within you and would not leave. By thaw, too much had already died.',
    chemicals: 'Hostile compounds burned through the delicate balance that kept you alive. The soil itself became an enemy.',
    decline: 'Season by season, loss outweighed recovery. At last, your strength failed, and the forest closed over your absence.'
  };
  return map[cause] || map.decline;
}

function applyEventEffects(major, minors) {
  return engine.applyEventEffects(state, major, minors);
}

function showEventPhase() {
  if (!els.turnEndBanner?.classList.contains('hidden')) {
    els.turnEndBanner.innerHTML = `<strong>Turn ended:</strong> ${els.turnEndBanner.textContent.replace(/^Turn ending:\s*/, '')}`;
  }
  const { major, minors, consequences } = engine.showEventPhase(state);
  updateScore();
  updateUI();
  render();

  showModal('Night Falls...', renderEventPhaseBody({ major, minors, consequences }), () => {
    engine.continueAfterEvent(state, {
      processPendingInteractions,
      maybeShowHealthWarning,
      advanceTurn,
      showTaprootResilience: (onContinue) => {
        showModal('Taproot Resilience', '<p>Your deep taproot reaches moisture far below the drying surface. The drought still hurts, but not as much as it would have.</p>', onContinue);
      },
    });
  });
}

function handleSpringViability(onContinue) {
  return engine.handleSpringViability(state, (fate, prevSeeds) => {
    addLog(`${fate.sprouted} of ${prevSeeds} seeds successfully established this spring.`);
    if (fate.sprouted > 0) showFeedback(`${fate.sprouted} offspring sprouted!`, 'success');
    onContinue?.();
  });
}

function advanceTurn() {
  return engine.advanceTurn(state, {
    onDeath: () => handleDeath(),
    onAfterSpringViability: (fate, prevSeeds) => {
      addLog(`${fate.sprouted} of ${prevSeeds} seeds successfully established this spring.`);
      if (fate.sprouted > 0) showFeedback(`${fate.sprouted} offspring sprouted!`, 'success');
    },
    onAfterAdvance: () => {},
  });
}

function handleDeath() {
  return engine.handleDeath(state);
}

function updateScore() {
  return engine.updateScoreState(state);
}

function showFeedback(message, type = 'success') {
  return showFeedbackUI(els, message, type);
}

function setTurnEndBanner(message = '') {
  return setTurnEndBannerUI(els, message);
}

function initTooltips() {
  return initTooltipsUI(els);
}

function initCollapsibleGroups() {
  return initCollapsibleGroupsUI();
}

function updateUI() {
  return updateHudUI({
    els,
    state,
    currentSeasonName: currentSeason().name,
    currentStage: computeCurrentLifeStage(),
    currentStageRequirements: currentStageRequirements(),
    affordableActions: getAffordableActions(),
    speciesBadgeHtml: state.selectedSpecies
      ? renderSpeciesSummary(state.selectedSpecies, SPECIES[state.selectedSpecies], {
          title: state.selectedSpecies,
          intro: 'Species',
          compact: true,
        })
      : '',
  });
}

function addLog(message) {
  state.log.unshift(`[Y${state.year} ${currentSeason().name} T${state.turnInSeason}] ${message}`);
  state.log = state.log.slice(0, 18);
}

function render() {
  renderForestScene({
    ctx,
    canvas: els.canvas,
    state,
    currentSeason: currentSeason(),
    playerStageName: computeCurrentLifeStage().name,
    getNeighborTree,
    getRelationshipState,
  });
}

els.startGame.addEventListener('click', startGame);
els.viewLeaderboard?.addEventListener('click', showLeaderboardModal);
initSpeciesSelect();
render();
