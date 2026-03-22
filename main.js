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
  resolvePendingStartOfTurnEffects,
  buildChemicalDefenseDecision,
  resolveChemicalDefenseChoice,
  buildHostileEncroachmentDecision,
  resolveHostileEncroachmentChoice,
} from './core/events.js';
import {
  applyRelationshipDelta as applyRelationshipDeltaForState,
  updateAlliesCount as updateAlliesCountForState,
  compareConflictPower as compareConflictPowerForState,
  checkAllyBetrayal as checkAllyBetrayalForState,
  resolveConnectionAttempt,
  applyAggressionToNeighbor,
  listAggressionOptions,
  listConnectionOptions,
  listAidOptions,
  listHelpRequestOptions,
  resolveAidToAlly,
  resolveHelpRequestFromAlly,
} from './core/diplomacy.js';
import { recordDamageForState, healthWarningBandForState, getHealthWarningContent, deathFlavorForCause } from './core/survival.js';
import { createEngine } from './core/engine.js';
import { renderActionPanels } from './ui/actions.js';
import { renderEventPhaseBody } from './ui/events.js';
import { showStandardModal } from './ui/modal.js';
import { showChoiceModalUI } from './ui/choice-modal.js';
import { renderResourcePhaseBody } from './ui/resources.js';
import { renderSpringSeedFateBody, renderGameOverBody, renderSuccessionBody, renderVictoryBody } from './ui/outcomes.js';
import { renderSpeciesSummary, initSpeciesSelectUI } from './ui/species.js';
import { createLeaderboardStore, createRunRecord, renderLeaderboardBody } from './ui/leaderboard.js';
import { renderForestScene } from './ui/canvas.js';
import { showFeedbackUI, setTurnEndBannerUI, initTooltipsUI, initCollapsibleGroupsUI, updateHudUI } from './ui/hud.js';
import { createInitialBrowserState, getBrowserElements, initSpeciesSelectController, startBrowserGame, showGamePanelsUI } from './ui/browser-app.js';

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

const state = createInitialBrowserState({ initialLifeStage: LIFE_STAGES[0] });
const els = getBrowserElements(document);
const ctx = els.canvas.getContext('2d');

// Floating feedback system
function initSpeciesSelect() {
  return initSpeciesSelectController({
    state,
    speciesNames: Object.keys(SPECIES),
    chooseRandomIndex: length => randomInt(length),
    renderSpeciesSelect: speciesName => initSpeciesSelectUI(els, speciesName, name => renderSpeciesSummary(name, SPECIES[name], { title: `${name} tree`, intro: 'You are a' })),
  });
}

function startGame() {
  const spec = SPECIES[state.selectedSpecies];
  return startBrowserGame({
    state,
    selectedSpecies: state.selectedSpecies,
    species: spec,
    initialLifeStage: LIFE_STAGES[0],
    makeStartingNeighbors,
    initTooltips,
    initCollapsibleGroups,
    addLog,
    updateUI,
    showResourcePhase,
    showGamePanels: () => showGamePanelsUI(els),
    random: Math.random,
  });
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
  const pendingStartOfTurn = resolvePendingStartOfTurnEffects(state);
  if (pendingStartOfTurn.length) {
    const first = pendingStartOfTurn[0];
    updateScore();
    updateUI();
    render();
    showModal(first.title, `<p>${first.body}</p>`, () => {
      updateScore();
      updateUI();
      render();
      showResourcePhase();
    });
    return;
  }
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
  const options = listAidOptions(state, {
    getRelationshipState,
    scaledAidNutrientCost,
  });
  if (!options.length) return resumeTurnFlow();
  const choose = (neighbor) => {
    const option = options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
    if (!option) return resumeTurnFlow();
    const outcome = resolveAidToAlly(state, neighbor, {
      getRelationshipState,
      getAdjustedRelationshipDelta,
      scaledAidNutrientCost,
    });
    if (!outcome.ok) {
      showModal('Aid Sent', `<p>You want to support the ${neighbor.species}, but you do not have the reserves to send meaningful help.</p><p><strong>Needed:</strong> 🌱${outcome.nutrientCost} · 💧${outcome.waterCost}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, resumeTurnFlow);
      return;
    }
    const crisisLine = option.meta?.crisis ? `<p>Your aid helps the ${neighbor.species} push back ${option.meta.crisis.title.toLowerCase()}.</p>` : '';
    showModal('Aid Sent', `<p>You send water and nutrients through the fungal dark to the ${neighbor.species}. It feels the gift and grows warmer toward you.</p>${crisisLine}<p><strong>Spent:</strong> 🌱${outcome.nutrientCost} · 💧${outcome.waterCost}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
      updateAlliesCount(); updateScore(); updateUI(); render();
      showRelationshipChangeModal(neighbor.species, outcome.oldState, outcome.newState, resumeTurnFlow);
    });
  };
  if (options.length === 1) return choose(state.neighbors[options[0].targetIndex]);
  chooseNeighborModal(choose, n => options.some(option => option.targetIndex === state.neighbors.indexOf(n)), 'Offer aid to which ally?', 'Choose an allied tree to support.', true);
}

function runAggressionFlow(kind) {
  const options = listAggressionOptions(state, kind, { getRelationshipState });
  if (!options.length) return resumeTurnFlow();

  const title = kind === 'shade' ? 'Shade which neighbor?' : 'Assert dominion over which neighbor?';
  const body = kind === 'shade'
    ? 'Choose any neighboring tree to suppress.'
    : 'Choose any neighboring tree to pressure underground.';

  chooseNeighborModal((neighbor) => {
    const option = options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
    if (!option) return resumeTurnFlow();

    const proceed = () => {
      const outcome = applyAggressionToNeighbor(state, neighbor, kind, { getRelationshipState });
      if (kind === 'shade') {
        const sunlightGain = outcome.gains.sunlight;
        showModal('Shade Cast', `<p>You bend your growing crown toward the ${neighbor.species}, crowding out its leaves and stealing back light it would have taken from you.</p><p>You gain <strong>${sunlightGain} sunlight</strong>${outcome.alreadyContested ? '' : ', but the act hardens the relationship into open rivalry'}.</p>`, resumeTurnFlow);
      } else {
        const { sunlight, water, nutrients } = outcome.gains;
        showModal('Root Dominion', `<p>Your roots seize the contested soil beneath the ${neighbor.species}. You choke its access to water, nutrients, and light, and steal some of that strength for yourself.</p><p>You gain <strong>${sunlight} sunlight</strong>, <strong>${water} water</strong>, and <strong>${nutrients} nutrient</strong>${nutrients !== 1 ? 's' : ''}${outcome.alreadyContested ? '' : '. Starting this fight costs you the easier light you would have gained from an already-weakened rival'}.</p>`, resumeTurnFlow);
      }
    };

    if (option.requiresConfirmation) {
      showChoiceModal(
        option.confirmation.title,
        option.confirmation.body,
        [
          { label: 'Yes, turn this relationship hostile', className: 'btn warning', onClick: () => proceed() },
          { label: 'No, keep the peace', className: 'btn', onClick: () => resumeTurnFlow() },
        ]
      );
      return;
    }

    proceed();
  }, n => options.some(option => option.targetIndex === state.neighbors.indexOf(n)), title, body, true);
}

function shadeRivalAction(s) {
  return runAggressionFlow('shade');
}

function rootDominionAction(s) {
  return runAggressionFlow('dominion');
}

function requestHelpFromAllies(s) {
  const options = listHelpRequestOptions(state, {
    getRelationshipState,
    getNeighborStage,
  });
  if (!options.length) {
    showFeedback('No allies are close enough to help', 'warning');
    resumeTurnFlow();
    return;
  }
  const askOne = (neighbor) => {
    const option = options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
    if (!option) return resumeTurnFlow();
    const outcome = resolveHelpRequestFromAlly(state, neighbor, {
      getRelationshipState,
      getAdjustedRelationshipDelta,
      getNeighborStage,
      random: Math.random,
    });
    addLog(`${outcome.tone} You recover ${outcome.actualHeal} health from ${neighbor.species}.`);
    showModal('Allied Aid', `<p>${outcome.tone}</p><p><strong>${neighbor.species}</strong> gives you <strong>${outcome.actualHeal} health</strong>.</p>`, () => {
      updateAlliesCount(); updateScore(); updateUI(); render(); renderActions();
      showRelationshipChangeModal(neighbor.species, outcome.oldState, outcome.newState, () => {
        updateAlliesCount(); updateScore(); updateUI(); render(); renderActions();
        if (state.actions <= 0) showEventPhase();
      });
    });
  };
  if (options.length === 1) return askOne(state.neighbors[options[0].targetIndex]);
  chooseNeighborModal(askOne, n => options.some(option => option.targetIndex === state.neighbors.indexOf(n)), 'Ask an ally for help', 'Choose which allied tree you are asking to support you.', true);
}

function attemptConnection(s) {
  const options = listConnectionOptions(state, { getRelationshipState });
  if (!options.length) return resumeTurnFlow();
  chooseNeighborModal((neighbor) => {
    const option = options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
    if (!option) return resumeTurnFlow();
    const outcome = resolveConnectionAttempt(state, neighbor, {
      getRelationshipState,
      getAdjustedRelationshipDelta,
      recordDamage,
      random: Math.random,
    });

    addLog(outcome.message);
    showFeedback(outcome.feedback.text, outcome.feedback.type);
    updateAlliesCount();
    updateScore();
    updateUI();
    render();
    renderActions();

    showModal(`Root Contact: ${neighbor.species}`, `<p>${outcome.message}</p><p><strong>Current relationship:</strong> ${outcome.newState}</p>`, () => {
      updateUI();
      render();
      renderActions();
      showRelationshipChangeModal(neighbor.species, outcome.oldState, outcome.newState, () => {
        updateUI();
        render();
        renderActions();
      });
    });
  }, n => options.some(option => option.targetIndex === state.neighbors.indexOf(n)), 'Reach toward which neighbor?', 'Choose a neighboring tree to contact through the soil.', true);
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

  const noUsableActions = state.actions > 0 && Object.values(categories).every(arr => arr.length === 0);

  renderActionPanels({
    els,
    categories,
    futureActions,
    categoryNames: CATEGORY_NAMES,
    noUsableActions,
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
  const decision = buildHostileEncroachmentDecision(state, neighbor, {
    getRelationshipState,
    compareConflictPower,
  });

  events.push({ text: `The ${decision.meta.relationName} ${neighbor.species} crowds your light and tangles the soil around your roots.`, effect: 'warning' });
  state.pendingInteractions.push((done) => {
    showChoiceModal(decision.title, decision.body,
      decision.options.map(option => ({
        label: option.label,
        onChoose: () => {
          const outcome = resolveHostileEncroachmentChoice(state, neighbor, option.id, {
            getRelationshipState,
            compareConflictPower,
            applyRelationshipDelta,
            random: Math.random,
          });
          showModal(outcome.title, outcome.body, () => {
            updateAlliesCount(); updateScore(); updateUI(); render();
            showRelationshipChangeModal(neighbor.species, outcome.oldState, outcome.newState, done);
          });
        }
      }))
    );
  });
}

function queueAllyAidRequest(neighbor, events) {
  // Ally crises are now managed by advanceAllyCrises().
}

function queueChemicalDefenseThreat(events) {
  const decision = buildChemicalDefenseDecision(state, {
    computeCurrentLifeStage,
  });
  events.push({ text: decision.meta.threat.warning, effect: 'warning' });
  state.pendingInteractions.push((done) => {
    showChoiceModal(decision.title, decision.body, decision.options.map(option => ({
      label: option.label,
      onChoose: () => {
        const outcome = resolveChemicalDefenseChoice(state, decision, option.id, {
          recordDamage,
        });
        showModal(outcome.title, outcome.body, () => { updateScore(); updateUI(); render(); done(); });
      }
    })));
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
  return recordDamageForState(state, amount, cause);
}

function healthWarningBand() {
  return healthWarningBandForState(state);
}

function healthWarningContent(level) {
  return getHealthWarningContent(level);
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
  return deathFlavorForCause(cause);
}

function applyEventEffects(major, minors) {
  return engine.applyEventEffects(state, major, minors);
}

function showEventPhase() {
  setTurnEndBanner('');
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
