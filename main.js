import {
  SEASONS,
  LIFE_STAGES,
  STAGE_BY_NAME,
  SEASONAL_ACTIONS,
  PROGRESSIVE_ACTION_UNLOCKS,
  RELATIONSHIP_STATES,
  getRelationshipState,
  getNeighborStage,
} from './core/constants.js?rev=forest-cycle-v1';
import {
  SPECIES,
  getCurrentSpeciesSpec,
  getStageProgressIncrement,
  getSpeciesAdjustedCost,
  getAdjustedRelationshipDelta,
  getPollinatorChance,
  getDroughtResistance,
} from './core/species.js?rev=ally-reciprocity-v1';
import {
  computeCurrentLifeStage as computeCurrentLifeStageFromState,
  turnsForYears,
  currentStageRequirements as getCurrentStageRequirements,
  getNextStage as getNextStageFromState,
  resetStageProgressCounters as resetStageProgressCountersForState,
} from './core/stages.js?rev=life-stage-v1';
import { randomChoice, randomInt } from './core/random.js';
import { CATEGORY_NAMES, createActions, getActionAvailability, getActionUnlockAnnouncement, getActionUnlockExplanation, getActionUnlockReason, isActionAnnounceableInSeason, isActionUnlockedForState } from './core/actions.js?rev=ally-reciprocity-v1';
import {
  createMajorEvents,
  rollMajorEvent as rollMajorEventFromList,
  resolveFruitThreats as resolveFruitThreatsForState,
  processSeasonalReproduction as processSeasonalReproductionForState,
  resolveSeedFate as resolveSeedFateForCount,
  rollMinorEvents as rollMinorEventsForState,
  resolvePendingStartOfTurnEffects,
  buildChemicalDefenseDecision,
  buildHostileEncroachmentDecision,
  describeDecisionPrompt,
  resolveSharedDecision,
} from './core/events.js?rev=offspring-support-v1';
import {
  applyRelationshipDelta as applyRelationshipDeltaForState,
  updateAlliesCount as updateAlliesCountForState,
  compareConflictPower as compareConflictPowerForState,
  checkAllyBetrayal as checkAllyBetrayalForState,
  buildAggressionDecision,
  buildConnectionDecision,
  buildAidDecision,
  buildHelpRequestDecision,
  markNeighborDead,
  resolveDiplomacyDecision,
} from './core/diplomacy.js?rev=ally-reciprocity-v1';
import { recordDamageForState, healthWarningBandForState, getHealthWarningContent, deathFlavorForCause } from './core/survival.js?rev=protected-grove-v1';
import {
  advanceHumanSystem,
  advanceOffspringCrises,
  describeOffspring,
  growOffspringRecords,
  nurtureOffspring,
  resolveOffspringCrisisAid,
  resolveHumanDecision,
  updateProtectionProgress,
} from './core/humans.js?rev=offspring-support-v1';
import { createEngine, shouldSkipGathering, updateResourceShortageNudges } from './core/engine.js?rev=resource-guidance-v1';
import { advanceNeighborDeathCycle, createStartingNeighbors } from './core/neighbors.js?rev=forest-cycle-v1';
import { canNeighborShadePlayer, neighborGrowthFromLight, normalizePlayerShadeTarget, reconcileCanopyHeight } from './core/growth.js?rev=offspring-rivalry-v1';
import { renderActionPanels } from './ui/actions.js?rev=condensed-turn-v1';
import { renderEventPhaseBody } from './ui/events.js?rev=second-person-v1';
import { buildPopupLogMessage, modalPlainText, showStandardModal } from './ui/modal.js?rev=popup-log-v1';
import { showChoiceModalUI } from './ui/choice-modal.js?rev=seasonal-canopy-v1';
import { renderResourcePhaseBody } from './ui/resources.js?rev=resource-guidance-v1';
import { renderSpringSeedFateBody, renderFullGameOverBody, renderGameOverBody, renderSuccessionBody, renderVictoryBody } from './ui/outcomes.js?rev=forest-cycle-v1';
import { renderSpeciesSummary, initSpeciesSelectUI } from './ui/species.js';
import { renderForestScene } from './ui/canvas.js?rev=forest-cycle-v1';
import { showFeedbackUI, setTurnEndBannerUI, initTooltipsUI, initCollapsibleGroupsUI, updateHudUI } from './ui/hud.js?rev=condensed-turn-v1';
import { createInitialBrowserState, getBrowserElements, initPanelCollapseUI, initSpeciesSelectController, startBrowserGame, showGamePanelsUI } from './ui/browser-app.js?rev=forest-cycle-v1';

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
  if (stage !== 'Sapling' && stage !== 'Young Tree' && stage !== 'Mature Tree') return false;
  
  // Don't warn if already have enough allies
  if (state.allies >= 1) return false;
  
  // Don't warn too frequently
  if (state.growthNudgeCooldown > 0) return false;
  
  // Calculate urgency based on stage
  let urgency = 0;
  if (stage === 'Sapling') urgency = 1; // Early warning
  if (stage === 'Young Tree') urgency = 2; // Getting close
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
    const unlockedActions = next.unlocks
      .map(key => ACTIONS.find(action => action.key === key))
      .filter(Boolean)
      .filter(action => isActionUnlocked(action.key))
      .filter(isActionAnnounceableNow);
    state.announcedActionUnlocks ||= [];
    unlockedActions.forEach(action => {
      if (!state.announcedActionUnlocks.includes(action.key)) state.announcedActionUnlocks.push(action.key);
    });
    unlockedActions.forEach(action => addLog(`${getActionUnlockAnnouncement(action)} ${getActionUnlockExplanation(action)}`));
    const unlockHtml = unlockedActions.map(action => `<p class="action-unlock"><strong>${getActionUnlockAnnouncement(action)}</strong> ${getActionUnlockExplanation(action)}</p>`).join('');
    showFeedback(`You are now a ${next.name}!`, 'success');
    showModal(next.name, `<p><em>${next.popup}</em></p>${unlockHtml}`, () => {
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

function maybeAnnounceProgressiveActionUnlocks(onContinue) {
  state.announcedActionUnlocks ||= [];
  const newlyUnlocked = ACTIONS.filter(action => isActionUnlocked(action.key) && isActionAnnounceableNow(action) && !state.announcedActionUnlocks.includes(action.key));
  if (!newlyUnlocked.length) return false;
  newlyUnlocked.forEach(action => {
    state.announcedActionUnlocks.push(action.key);
    addLog(`${getActionUnlockAnnouncement(action)} ${getActionUnlockExplanation(action)}`);
  });
  const body = newlyUnlocked.map(action => `<p class="action-unlock"><strong>${getActionUnlockAnnouncement(action)}</strong> ${getActionUnlockExplanation(action)}</p>`).join('');
  showModal('New Growth Possibilities', body, onContinue);
  return true;
}

function isActionAnnounceableNow(action) {
  return isActionAnnounceableInSeason(action.key, currentSeason().name, SEASONAL_ACTIONS);
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

// Cost scaling: base costs multiply by stage rank (Sapling=×2, Young Tree=×3, etc.)
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
  nurtureOffspringAction,
  getRelationshipState,
  getNeighborStage,
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
    initPanelCollapse: () => initPanelCollapseUI(els),
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


function recordPopup(title, body) {
  if (!state.started) return;
  const text = modalPlainText(body);
  const excerpt = text.slice(0, 220);
  const recent = state.log.slice(0, 4).some(line =>
    line.includes(`${title}:`) || (excerpt.length >= 24 && line.includes(excerpt.slice(0, 80)))
  );
  if (!recent) addLog(buildPopupLogMessage(title, body));
}

function showModal(title, body, onContinue, { record = true } = {}) {
  if (record) recordPopup(title, body);
  return showStandardModal(els, title, body, onContinue);
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
  const successor = state.offspringRecords?.find(child => !child.dead);
  if (successor) successor.dead = true;
  state.health = choice.stats.health;
  state.maxHealth = choice.stats.maxHealth;
  state.branches = choice.stats.branches;
  state.rootZones = choice.stats.rootZones;
  state.leafClusters = choice.stats.leafClusters;
  state.trunk = choice.stats.trunk;
  state.heightGrowth = 0;
  state.spindlyGrowth = 0;
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
  recordPopup(title, body);
  return showChoiceModalUI(els, title, body, choices);
}

function showGameOverScreen(summary) {
  els.modal?.classList.add('hidden');
  els.mapExplorer?.classList.add('hidden');
  document.querySelectorAll('.game-panel, #species-panel').forEach(panel => panel.classList.add('hidden'));
  const app = document.getElementById('app');
  app.innerHTML = renderFullGameOverBody(summary);
  document.getElementById('try-again')?.addEventListener('click', () => window.location.reload());
}

function processPendingInteractions(onDone) {
  if (!state.pendingInteractions.length) return onDone?.();
  const interaction = state.pendingInteractions.shift();
  interaction(() => processPendingInteractions(onDone));
}

function showResourcePhase({ quiet = false } = {}) {
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
  if (!quiet && maybeAnnounceProgressiveActionUnlocks(() => showResourcePhase({ quiet }))) return;
  if (quiet && (state.turnsElapsed || 0) === 0) {
    renderActions();
    return;
  }
  if (shouldSkipGathering(state)) {
    state.actions = Math.max(1, state.actions || 0);
    updateUI();
    render();
    if (state.skipNextUngrownWarning) {
      state.skipNextUngrownWarning = false;
      renderActions();
      return;
    }
    addLog('You gathered no resources because you have not begun to grow.');
    showModal('Growth Must Begin', '<p><em>You remain folded within the seed, with no roots in the soil and no leaves in the light.</em></p><p><strong>Extend your first root</strong> so you can begin drawing water and nutrients. Leaves will follow, opening your tissues to sunlight.</p>', () => renderActions());
    return;
  }
  return engine.startTurn(state, {
    addLog,
    presentResources: (gains) => {
      if (quiet) {
        renderActions();
        return;
      }
      const nudge = updateResourceShortageNudges(state, gains);
      showModal('You Gather...', renderResourcePhaseBody({ state, gains }), () => {
        if (nudge) {
          addLog(nudge.log);
          showModal(nudge.title, `<p><em>${nudge.body}</em></p><p>${nudge.remedy}</p>`, () => renderActions());
        } else renderActions();
      }, { record: false });
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
  return createStartingNeighbors(Object.keys(SPECIES), LIFE_STAGES, Math.random);
}

function getNeighborAtSlot(idx) {
  return state.neighbors.find(n => n.slot === idx && !n.dead) || null;
}

function updateAlliesCount() {
  return updateAlliesCountForState(state, getRelationshipState);
}

function growNeighbors() {
  const activeShadeTarget = normalizePlayerShadeTarget(state);
  state.neighbors.forEach(n => {
    if (n.dead) {
      const transition = advanceNeighborDeathCycle(n, { speciesNames: Object.keys(SPECIES), seedlingThreshold: STAGE_BY_NAME.Seedling.threshold, random: Math.random });
      if (transition.phase === 'seedling') {
        addLog(`A new ${n.species} seedling rises where the fallen tree decayed.`);
      }
      return;
    }
    const baseGrowth = 20 + Math.floor(Math.random() * 35);
    n.stageScore += neighborGrowthFromLight(baseGrowth, n, activeShadeTarget);
    const heightChange = reconcileCanopyHeight(state, n, getNeighborStage, getRelationshipState);
    if (heightChange) state.pendingCanopyNotices = [...(state.pendingCanopyNotices || []), heightChange];
    if (getRelationshipState(n.relation).name === 'Hostile' && (n.slot === 1 || n.slot === 3) && canNeighborShadePlayer(state, n, getNeighborStage) && Math.random() < 0.25) {
      const newlyCrowding = !n.shadingPlayer;
      n.shadingPlayer = true;
      n.playerShading = false;
      if (newlyCrowding) state.pendingCanopyNotices = [...(state.pendingCanopyNotices || []), {
        kind: 'hostile-crowding',
        neighbor: n,
        message: `The hostile ${n.species} has grown tall enough to lean over you. Its crown begins stealing your light. Grow Taller to escape its shade, or use diplomacy to soften the hostility.`,
      }];
    }
  });
  growOffspringRecords(state);
}

function chooseNeighborModal(onPick, filterFn = () => true, title = 'Choose a neighboring tree', body = 'Your roots probe the soil for a possible connection.', includeBack = false, onBack = resumeTurnFlow, displayForNeighbor = null) {
  const choices = state.neighbors
    .filter(n => !n.dead)
    .filter(filterFn)
    .map(n => {
      const rel = getRelationshipState(n.relation).name.toLowerCase();
      const healthText = typeof n.health === 'number' && typeof n.maxHealth === 'number' ? ` · ${n.health}/${n.maxHealth} health` : '';
      const display = displayForNeighbor?.(n);
      const presentation = typeof display === 'string' ? { label: display } : (display || {});
      return {
        label: presentation.label || `${n.species} (${rel}${healthText})`,
        description: presentation.description,
        disabled: presentation.disabled,
        onChoose: () => onPick(n),
      };
    });
  if (includeBack) choices.push({ label: 'Back', onChoose: () => onBack?.() });
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

function refreshMainView({ actions = false } = {}) {
  updateAlliesCount();
  updateScore();
  updateUI();
  render();
  if (actions) renderActions();
}

function refreshRenderedView({ actions = false } = {}) {
  updateUI();
  render();
  if (actions) renderActions();
}

function continueWithRelationshipChange(species, oldState, newState, onDone, { actions = false } = {}) {
  showRelationshipChangeModal(species, oldState, newState, () => {
    refreshRenderedView({ actions });
    if (newState === 'Ally' && maybeAnnounceProgressiveActionUnlocks(onDone)) return;
    onDone?.();
  });
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



function updateNeighborAliveState(neighbor, cause = 'hardship') {
  const death = markNeighborDead(state, neighbor, cause, { getRelationshipState });
  if (!death.changed) return false;
  addLog(`The ${neighbor.species} dies from ${cause}.`);
  updateAlliesCount();
  neighbor.deathAge = 0;
  neighbor.deathStageScore = neighbor.stageScore;
  state.pendingInteractions.push(done => showModal(
    death.relationship === 'Ally' ? 'Ally Tree Dies' : 'Neighbor Tree Dies',
    `<p><em>The ${neighbor.species} falls silent in the grove.</em></p><p>Its health reached zero, and its roots no longer answer yours.</p><p><strong>Relationship at death:</strong> ${death.relationship}</p><p><strong>Cause:</strong> ${cause}</p>`,
    done,
  ));
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
  const allowMultiple = computeCurrentLifeStage().rank >= STAGE_BY_NAME['Young Tree'].rank;
  neighbor.activeCrises = neighbor.activeCrises || [];
  if (!allowMultiple && neighbor.activeCrises.length > 0) return null;
  const crisis = createAllyCrisis(neighbor);
  neighbor.activeCrises.push(crisis);
  return crisis;
}

function advanceAllyCrises(events) {
  for (const neighbor of state.neighbors) {
    if (neighbor.dead) continue;
    if (getRelationshipState(neighbor.relation).name !== 'Ally') continue;
    neighbor.activeCrises = neighbor.activeCrises || [];
    if (neighbor.activeCrises.length === 0 && Math.random() < (state.alliedNeighbors === 1 ? 0.22 : 0.3)) maybeAddAllyCrisis(neighbor);
    for (const crisis of [...neighbor.activeCrises]) {
      const flavor = crisis.flavors[Math.min(crisis.stage, crisis.flavors.length - 1)];
      events.push({ text: `${flavor} The crisis is deepening.`, effect: 'warning' });
      crisis.stage += 1;
      neighbor.health = Math.max(0, neighbor.health - crisis.healthLoss);
      if (neighbor.health <= 0) {
        events.push({ text: `The ${neighbor.species} finally gives way to ${crisis.title.toLowerCase()}. The crisis ends in silence.`, effect: 'damage' });
        updateNeighborAliveState(neighbor, crisis.title.toLowerCase());
        continue;
      }
      state.pendingInteractions.push((done) => showAllyAidRequest(neighbor, crisis, done));
    }
  }
}

function advanceChildCrises(events) {
  const outcomes = advanceOffspringCrises(state, Math.random);
  for (const outcome of outcomes) {
    const { child, crisis, flavor, died } = outcome;
    if (died) {
      state.offspringPool = Math.max(0, state.offspringPool - 1);
      events.push({ text: `${flavor} The ${child.species} offspring dies before more help can reach it.`, effect: 'offspring-loss' });
      continue;
    }
    events.push({ text: `${flavor} The crisis is deepening.`, effect: 'warning' });
    state.pendingInteractions.push(done => showOffspringAidRequest(child, crisis, done));
  }
}

function showOffspringAidRequest(child, crisis, done) {
  if (!child || child.dead) return done?.();
  const resIcon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
  showChoiceModal(
    `${child.species} offspring asks for help`,
    `<p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p>
     <p class="threat-status threat-growing">The crisis is deepening.</p>
     <p>It needs <strong>${crisis.amount} ${resIcon} ${crisis.kind}</strong>.</p>
     <p><strong>Health:</strong> ${child.health}/${child.maxHealth} · <strong>Growth:</strong> ${child.stageScore}</p>
     <p><em>Your current reserves: ☀️${state.sunlight} · 💧${state.water} · 🌱${state.nutrients}</em></p>`,
    [
      {
        label: 'Give what you can',
        onChoose: () => {
          const outcome = resolveOffspringCrisisAid(state, child.id, crisis.id);
          if (!outcome) return done?.();
          const body = outcome.resolved
            ? `You meet the full request with ${outcome.given} ${crisis.kind}. Your offspring steadies, and the crisis passes.`
            : outcome.given > 0
              ? `You send ${outcome.given} ${crisis.kind}. It helps, but your offspring will need more support before the crisis passes.`
              : `You have none of the needed ${crisis.kind} to send. The crisis worsens.`;
          showModal('Aid Given to Offspring', `<p>${body}</p><p><strong>Health:</strong> ${child.health}/${child.maxHealth} · <strong>Growth:</strong> ${child.stageScore}</p>`, () => {
            refreshMainView();
            done?.();
          });
        },
      },
      {
        label: 'Withhold your resources',
        onChoose: () => {
          resolveOffspringCrisisAid(state, child.id, crisis.id, { withhold: true });
          showModal('Aid Withheld from Offspring', `<p>You keep your reserves. Your ${child.species} offspring remains in danger, and its need grows.</p><p><strong>Health:</strong> ${child.health}/${child.maxHealth} · <strong>Growth:</strong> ${child.stageScore}</p>`, () => {
            refreshMainView();
            done?.();
          });
        },
      },
    ],
  );
}

function showAllyAidRequest(neighbor, crisis, done) {
  if (!neighbor || neighbor.dead) {
    done?.();
    return;
  }
  const resIcon = crisis.kind === 'nutrients' ? '🌱' : crisis.kind === 'water' ? '💧' : '☀️';
  const oldState = getRelationshipState(neighbor.relation).name;
  const available = state[crisis.kind];
  const title = `${neighbor.species} asks for help`;
  showChoiceModal(title, `<p><em>${crisis.flavors[Math.min(crisis.stage - 1, crisis.flavors.length - 1)]}</em></p><p class="threat-status threat-growing">The crisis is deepening.</p><p>It needs <strong>${crisis.amount} ${resIcon} ${crisis.kind}</strong>.</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p><p><em>Your current reserves: ☀️${state.sunlight} · 💧${state.water} · 🌱${state.nutrients}</em></p>`, [
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
          body = `You meet the full request. The ${neighbor.species} steadies and remembers your generosity. The crisis has passed.`;
        } else if (given > 0) {
          relationDelta = 2;
          neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + 1);
          crisis.amount = Math.max(1, crisis.amount - given);
          body = `You send ${given} ${crisis.kind}. It helps: the crisis eases, but has not yet passed.`;
        } else {
          relationDelta = -8;
          crisis.amount += 2;
          body = `You cannot send any of what it needs. The ${neighbor.species} feels the failure sharply, and the crisis worsens.`;
        }
        neighbor.helpGivenToThem += given > 0 ? 1 : 0;
        neighbor.helpRefusedToThem += given <= 0 ? 1 : 0;
        neighbor.lastAidMemory = given > 0 ? 'you-helped' : 'you-refused';
        applyRelationshipDelta(neighbor, relationDelta);
        const newState = getRelationshipState(neighbor.relation).name;
        showModal('Aid Given', `<p>${body}</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
          refreshMainView();
          continueWithRelationshipChange(neighbor.species, oldState, newState, done);
        });
      }
    },
    {
      label: 'Withhold your resources',
      onChoose: () => {
        neighbor.helpRefusedToThem += 1;
        neighbor.lastAidMemory = 'you-refused';
        crisis.amount += 2;
        neighbor.relation = Math.max(-100, neighbor.relation - 12);
        const newState = getRelationshipState(neighbor.relation).name;
        showModal('Aid Withheld', `<p>You keep your reserves. The ${neighbor.species} weakens and remembers the silence.</p><p>The crisis worsens.</p><p><strong>${neighbor.species} health:</strong> ${neighbor.health}/${neighbor.maxHealth}</p>`, () => {
          refreshMainView();
          continueWithRelationshipChange(neighbor.species, oldState, newState, done);
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
    getNeighborStage,
    random: Math.random,
    recordDamage,
    onRelationshipShift: (neighbor, oldState, newState) => {
      state.pendingInteractions.push((done) => {
        continueWithRelationshipChange(neighbor.species, oldState, newState, done);
      });
    },
  });
}

function resinReserveAction(s, context = {}) {
  const { transaction } = context;
  const finish = (applyChoice, title, body) => {
    transaction?.commit();
    applyChoice();
    showModal(title, body, () => transaction?.complete());
  };
  showChoiceModal('Resin Reserve', '<p>How will you spend this dense pulse of nutrients?</p>', [
    { label: 'Saturate bark with bitter resin (−12🌱)', onChoose: () => finish(() => { state.nutrients = Math.max(0, state.nutrients - 12); state.defense += 2; state.eventModifiers.disease = Math.max(state.eventModifiers.disease, 0.95); }, 'Resin Reserve', '<p>Your tissues run bitter and guarded. Insects and infection will have a harder time taking hold.</p>') },
    { label: 'Build emergency defensive stores (−16🌱)', onChoose: () => finish(() => { state.nutrients = Math.max(0, state.nutrients - 16); state.fruitDefense += 2; state.eventModifiers.shelter = (state.eventModifiers.shelter || 0) + 1; }, 'Resin Reserve', '<p>You bank dense reserves against the next hardship, thickening your defensive chemistry.</p>') },
    { label: 'Back', onChoose: () => transaction?.cancel() }
  ]);
  return { deferred: true };
}

function woodSurgeAction(s, context = {}) {
  const { transaction } = context;
  const finish = (applyChoice, body) => {
    transaction?.commit();
    applyChoice();
    showModal('Wood Surge', body, () => transaction?.complete());
  };
  showChoiceModal('Wood Surge', '<p>How will you spend this growth surge?</p>', [
    { label: 'Drive down and outward (−12🌱)', onChoose: () => finish(() => { state.nutrients = Math.max(0, state.nutrients - 12); state.rootZones += 1; state.taprootDepth += 1; }, '<p>You invest heavily belowground. Your roots thicken and your taproot pushes toward deeper water.</p>') },
    { label: 'Lay on wood and crown (−16🌱)', onChoose: () => finish(() => { state.nutrients = Math.max(0, state.nutrients - 16); state.trunk += 1; state.canopySpread += 1; state.leafClusters += 1; state.maxHealth += 1; state.health = Math.min(state.maxHealth, state.health + 1); }, '<p>You turn surplus nutrients into wood, crown, and living strength.</p>') },
    { label: 'Back', onChoose: () => transaction?.cancel() }
  ]);
  return { deferred: true };
}

function showResolvedDiplomacyDecision(decision, resolved, onDone = resumeTurnFlow) {
  const neighbor = resolved.targetIndex == null ? null : state.neighbors[resolved.targetIndex];
  const neighborName = neighbor?.species || resolved.option?.meta?.species || 'neighbor';
  const outcome = resolved.outcome;

  if (decision.kind === 'connection') {
    addLog(outcome.message);
    showFeedback(outcome.feedback.text, outcome.feedback.type);
    refreshMainView({ actions: true });

    showModal(`Root Contact: ${neighborName}`, `<p>${outcome.message}</p><p><strong>Current relationship:</strong> ${outcome.newState}</p>`, () => {
      refreshRenderedView({ actions: true });
      continueWithRelationshipChange(neighborName, outcome.oldState, outcome.newState, onDone, { actions: true });
    });
    return;
  }

  if (decision.kind === 'ally-aid') {
    if (!outcome.ok) {
      if (outcome.reason === 'not-an-ally') {
        showModal('Aid Cancelled', `<p>The ${neighborName} is not currently an ally, so you cannot send ally aid to it.</p><p><strong>Current relationship:</strong> ${outcome.oldState}</p>`, onDone);
        return;
      }
      if (outcome.reason === 'full-health') {
        showModal('Aid Not Needed', `<p>The ${neighborName} has returned to full health and no longer needs aid.</p>`, onDone);
        return;
      }
      showModal('Aid Cancelled', `<p>The ${neighborName} can no longer receive ally aid.</p><p><strong>${neighborName} health:</strong> ${neighbor?.health}/${neighbor?.maxHealth}</p>`, onDone);
      return;
    }
    const crisisLine = resolved.option.meta?.crisis ? `<p>Your aid ends the ${neighborName}'s ${resolved.option.meta.crisis.title.toLowerCase()}. The crisis has passed.</p>` : '';
    const paid = outcome.paidCost || { sunlight: 0, water: 0, nutrients: 0 };
    showModal('Aid Sent', `<p>You send water and nutrients through the fungal dark to the ${neighborName}. It feels the gift, strengthens its growth, and grows warmer toward you.</p>${crisisLine}<p><strong>Spent:</strong> ☀️${paid.sunlight || 0} · 💧${paid.water || 0} · 🌱${paid.nutrients || 0}</p><p><strong>${neighborName} health:</strong> ${neighbor?.health}/${neighbor?.maxHealth}</p>`, () => {
      refreshMainView();
      continueWithRelationshipChange(neighborName, outcome.oldState, outcome.newState, onDone);
    });
    return;
  }

  if (decision.kind === 'ally-help-request') {
    const threatConclusion = outcome.clearedThreat ? ` The ${outcome.clearedThreat.title.toLowerCase()} is cleared, and the danger has passed.` : '';
    const unit = outcome.requestKind === 'health' ? 'health' : outcome.requestKind;
    addLog(`${outcome.tone} You receive ${outcome.actualAmount} ${unit} from ${neighborName}.${threatConclusion}`);
    const threatBody = outcome.clearedThreat ? `<p>The ${outcome.clearedThreat.title.toLowerCase()} is cleared by the allied response.</p><p class="threat-status threat-solved">The danger has passed.</p>` : '';
    showModal('Allied Aid', `<p>${outcome.tone}</p><p><strong>${neighborName}</strong> gives you <strong>${outcome.actualAmount} ${unit}</strong>.</p>${threatBody}`, () => {
      refreshMainView({ actions: true });
      continueWithRelationshipChange(neighborName, outcome.oldState, outcome.newState, onDone, { actions: true });
    });
    return;
  }

  if (decision.kind === 'aggression:shade') {
    const released = outcome.releasedShadeTarget ? `<p>Your crown withdraws from the ${outcome.releasedShadeTarget.species}; only one neighboring tree can remain beneath your shade.</p>` : '';
    const offspringWarning = outcome.shadedOffspringCount ? `<p class="threat-status threat-growing"><strong>${outcome.shadedOffspringCount} of your offspring ${outcome.shadedOffspringCount === 1 ? 'is' : 'are'} also on this side.</strong> ${outcome.shadedOffspringCount === 1 ? 'Its' : 'Their'} growth will slow under your shade until you lean in the other direction.</p>` : '';
    showModal('Shade Cast', `<p>You bend your growing crown toward the ${neighborName}, casting a broad shadow across its leaves.</p>${released}<p>While this arrangement lasts, you gain <strong>+${outcome.sunlightPerTurn} sunlight every turn</strong> and the ${neighborName} grows more slowly${outcome.alreadyContested ? '.' : ', but the act hardens the relationship into open rivalry.'}</p>${offspringWarning}`, onDone);
    return;
  }

  if (decision.kind === 'aggression:dominion') {
    const { sunlight, water, nutrients } = outcome.gains;
    showModal('Root Dominion', `<p>Your roots seize the contested soil beneath the ${neighborName}. You choke its access to water, nutrients, and light, and steal some of that strength for yourself.</p><p>You gain <strong>${sunlight} sunlight</strong>, <strong>${water} water</strong>, and <strong>${nutrients} nutrient</strong>${nutrients !== 1 ? 's' : ''}${outcome.alreadyContested ? '' : '. Starting this fight costs you the easier light you would have gained from an already-weakened rival'}.</p>`, onDone);
  }
}

function runDiplomacyDecision(decision, { emptyMessage = null, transaction = null } = {}) {
  const cancel = () => transaction?.cancel();
  const complete = () => transaction?.complete();
  if (!decision.options.length) {
    if (emptyMessage) showFeedback(emptyMessage, 'warning');
    cancel();
    return { deferred: true };
  }

  const execute = (option) => {
    if (option.meta?.blockedReason === 'too-short') {
      const neighbor = state.neighbors[option.targetIndex];
      showModal('Not Tall Enough', `<p>The ${neighbor?.species || 'neighboring tree'} is not shorter than you. Lasting shade requires your crown to rise above its crown.</p><p><strong>Grow Taller</strong>, then try again.</p>`, cancel);
      return;
    }
    const proceed = () => {
      transaction?.commit();
      const resolved = resolveDiplomacyDecision(state, decision, option.id, {
        getRelationshipState,
        getAdjustedRelationshipDelta,
        getNeighborStage,
        recordDamage,
        random: Math.random,
      });
      showResolvedDiplomacyDecision(decision, resolved, complete);
    };

    if (option.requiresConfirmation && option.confirmation) {
      showChoiceModal(option.confirmation.title, option.confirmation.body, [
        { label: option.meta?.shadedOffspringCount ? 'Yes, cast the shade' : 'Yes, turn this relationship hostile', className: 'btn warning', onChoose: () => proceed() },
        { label: 'No, keep the peace', className: 'btn', onChoose: cancel },
      ]);
      return;
    }

    proceed();
  };

  if (decision.options.length === 1 && !decision.options[0].disabled) {
    execute(decision.options[0]);
    return { deferred: true };
  }

  chooseNeighborModal(
    (neighbor) => {
      const option = decision.options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
      if (!option) return cancel();
      execute(option);
    },
    n => decision.options.some(option => option.targetIndex === state.neighbors.indexOf(n)),
    decision.title,
    decision.body,
    true,
    cancel,
    neighbor => {
      const option = decision.options.find(entry => entry.targetIndex === state.neighbors.indexOf(neighbor));
      return option ? { label: option.label, description: option.description, disabled: option.disabled } : null;
    },
  );
  return { deferred: true };
}

function offerAidToAlly(s, context = {}) {
  return runDiplomacyDecision(buildAidDecision(state, {
    getRelationshipState,
    paidCost: context.scaledCost,
  }), {
    emptyMessage: 'No allied trees are available to receive aid',
    transaction: context.transaction,
  });
}

function runAggressionFlow(kind, context = {}) {
  return runDiplomacyDecision(buildAggressionDecision(state, kind, { getRelationshipState, getNeighborStage }), {
    transaction: context.transaction,
  });
}

function shadeRivalAction(s, context) {
  return runAggressionFlow('shade', context);
}

function rootDominionAction(s, context) {
  return runAggressionFlow('dominion', context);
}

function requestHelpFromAllies(s, context = {}) {
  showChoiceModal('What do you need?', '<p>Choose what your tissues need most. The ally will decide how much it can spare.</p>', [
    { label: 'Health', description: 'Ask for restorative support through the fungal network.', onChoose: () => runDiplomacyDecision(buildHelpRequestDecision(state, { getRelationshipState, getNeighborStage, requestKind: 'health' }), { emptyMessage: 'No allies are close enough to help', transaction: context.transaction }) },
    { label: 'Water', description: 'Ask for water drawn from the ally’s root zone.', onChoose: () => runDiplomacyDecision(buildHelpRequestDecision(state, { getRelationshipState, getNeighborStage, requestKind: 'water' }), { emptyMessage: 'No allies are close enough to help', transaction: context.transaction }) },
    { label: 'Nutrients', description: 'Ask for mineral support carried through fungal threads.', onChoose: () => runDiplomacyDecision(buildHelpRequestDecision(state, { getRelationshipState, getNeighborStage, requestKind: 'nutrients' }), { emptyMessage: 'No allies are close enough to help', transaction: context.transaction }) },
    { label: 'Back', onChoose: () => context.transaction?.cancel() },
  ]);
  return { deferred: true };
}

function nurtureOffspringAction(s, context = {}) {
  const children = describeOffspring(state, LIFE_STAGES);
  if (!children.length) {
    context.transaction?.cancel();
    return { deferred: true };
  }
  const choices = children.map(child => ({
    label: `${child.species} — ${child.stageName}`,
    description: `${child.groveSide === 'left' ? 'Left' : 'Right'} side · ${child.health}/${child.maxHealth} health · ${child.stageScore} growth · nurtured ${child.nurtureCount} time${child.nurtureCount === 1 ? '' : 's'}`,
    onChoose: () => {
      const before = { ...child };
      context.transaction?.commit();
      const nurtured = nurtureOffspring(state, child.id);
      if (!nurtured) {
        context.transaction?.cancel();
        return;
      }
      const afterStage = getNeighborStage(nurtured.stageScore);
      showModal('Offspring Nurtured', `
        <p>You direct water, nutrients, and stored energy to your ${nurtured.species} offspring.</p>
        <p><strong>Growth:</strong> ${before.stageScore} → ${nurtured.stageScore} (+${nurtured.stageScore - before.stageScore}) · ${afterStage.name}</p>
        <p><strong>Health:</strong> ${before.health}/${before.maxHealth} → ${nurtured.health}/${nurtured.maxHealth}</p>
        <p><strong>Nurture investments:</strong> ${before.nurtureCount} → ${nurtured.nurtureCount}</p>
      `, () => context.transaction?.complete());
    },
  }));
  choices.push({ label: 'Back', onChoose: () => context.transaction?.cancel() });
  showChoiceModal(
    'Choose an Offspring Tree',
    '<p>Compare each child’s current health, growth, life stage, and past nurture before choosing where to invest.</p>',
    choices,
  );
  return { deferred: true };
}

function attemptConnection(s, context = {}) {
  return runDiplomacyDecision(buildConnectionDecision(state, { getRelationshipState, getNeighborStage }), {
    transaction: context.transaction,
  });
}

function getNeighborTree(idx) {
  if (idx === 2) return null;
  const base = state.neighbors.find(n => n.slot === idx) || null;
  if (!base) return null;
  const stage = getNeighborStage(base.dead ? (base.deathStageScore ?? base.stageScore) : base.stageScore);
  const isSeed = stage.name === 'Seed';
  return {
    species: base.species,
    age: Math.max(0.25, stage.threshold / 2000),
    health: base.health,
    maxHealth: base.maxHealth,
    healthRatio: base.maxHealth > 0 ? base.health / base.maxHealth : 0,
    branches: isSeed ? 0 : Math.max(1, Math.min(5, Math.floor(stage.threshold / 300) + 1)),
    roots: isSeed ? 0 : Math.max(2, Math.min(6, Math.floor(stage.threshold / 300) + 2)),
    trunk: isSeed ? 0 : Math.max(1, Math.min(4, Math.floor(stage.threshold / 700) + 1)),
    heightGrowth: base.heightGrowth || 0,
    ally: getRelationshipState(base.relation).name === 'Ally',
    relation: base.relation,
    relationName: getRelationshipState(base.relation).name,
    stageName: stage.name,
    slot: base.slot,
    playerShading: Boolean(base.playerShading),
    shadingPlayer: Boolean(base.shadingPlayer),
    dead: Boolean(base.dead),
    deathAge: base.deathAge || 0,
    deathCause: base.deathCause || null,
  };
}

function isActionUnlocked(actionKey) {
  return isActionUnlockedForState(actionKey, state, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS);
}

function actionUnlockReason(actionKey) {
  return getActionUnlockReason(actionKey, state, LIFE_STAGES, PROGRESSIVE_ACTION_UNLOCKS);
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
  const unavailableActions = [];
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
      getUnlockReason: actionUnlockReason,
    });
    if (availability.hidden) return;

    const { scaledCost, usable, unlocked, reason } = availability;

    const sunRequired = scaledCost.sunlight || 0;
    const waterRequired = scaledCost.water || 0;
    const nutRequired = scaledCost.nutrients || 0;
    const sunEnough = state.sunlight >= sunRequired;
    const waterEnough = state.water >= waterRequired;
    const nutEnough = state.nutrients >= nutRequired;
    const sunClass = sunEnough ? 'res-sun' : 'res-sun res-low';
    const waterClass = waterEnough ? 'res-water' : 'res-water res-low';
    const nutClass = nutEnough ? 'res-nutrient' : 'res-nutrient res-low';

    const resourceCost = (icon, name, required, className) => `
      <span class="cost ${className}" aria-label="${required} ${name} cost">
        <span class="cost-icon" aria-hidden="true">${icon}</span>
        <span class="cost-number"><strong>${required}</strong><small>cost</small></span>
      </span>`;

    let costsHtml = '<div class="action-costs" aria-label="Action cost">';
    if (sunRequired > 0) costsHtml += resourceCost('☀️', 'sunlight', sunRequired, sunClass);
    if (waterRequired > 0) costsHtml += resourceCost('💧', 'water', waterRequired, waterClass);
    if (nutRequired > 0) costsHtml += resourceCost('🌱', 'nutrients', nutRequired, nutClass);
    costsHtml += '</div>';

    const actionData = { action, scaledCost, costsHtml, statusText: action.status?.(state) || '', sunRequired, waterRequired, nutRequired };

    if (usable) {
      if (categories[action.category]) {
        categories[action.category].push(actionData);
      }
    } else if (unlocked) {
      unavailableActions.push({ ...actionData, reason });
    } else {
      futureActions.push({ ...actionData, reason });
    }
  });

  const noUsableActions = state.actions > 0 && Object.values(categories).every(arr => arr.length === 0);

  renderActionPanels({
    els,
    categories,
    unavailableActions,
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
      if ((state.turnsElapsed || 0) === 0 && shouldSkipGathering(state)) {
        state.actions = 0;
        addLog('You ended the first turn without growing, so no resources were gathered.');
        showModal('The Seed Waits', '<p><em>Night passes over the soil, but you have not yet opened yourself to it. Without roots or leaves, there is nothing to gather.</em></p><p><strong>Begin growing next turn.</strong> Extend a root to reach water and nutrients; then unfurl leaves to receive sunlight.</p>', () => {
          state.skipNextUngrownWarning = true;
          advanceTurn();
        });
        return;
      }
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
  deathFlavor,
  generateSuccessionChoices,
  continueAsSuccessor,
  showChoiceModal,
  renderSpringSeedFateBody,
  renderGameOverBody,
  renderSuccessionBody,
  showGameOverScreen,
  renderVictoryBody,
  getRelationshipState,
  getNeighborStage,
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

function queueSharedDecisionInteraction(decision, done) {
  let currentDecision = decision;
  if (decision.kind === 'chemical-defense') {
    currentDecision = buildChemicalDefenseDecision(state, {
      computeCurrentLifeStage,
      threat: decision.meta?.threat,
    });
  } else if (decision.kind === 'hostile-encroachment') {
    const neighbor = decision.meta?.neighbor;
    if (!neighbor || neighbor.dead) {
      addLog(`The hostile encounter ends because the ${neighbor?.species || 'neighboring tree'} is dead.`);
      done?.();
      return;
    }
    currentDecision = buildHostileEncroachmentDecision(state, neighbor, {
      getRelationshipState,
      compareConflictPower,
      getNeighborStage,
    });
  }
  showChoiceModal(
    currentDecision.title,
    currentDecision.body,
    currentDecision.options.map(option => ({
      label: option.label,
      disabled: option.affordable === false,
      onChoose: () => {
        const outcome = resolveSharedDecision(state, currentDecision, option.id, {
          getRelationshipState,
          compareConflictPower,
          applyRelationshipDelta,
          getNeighborStage,
          recordDamage,
          random: Math.random,
        });
        showModal(outcome.title, outcome.body, () => {
          refreshMainView();
          const neighborName = currentDecision.meta?.neighbor?.species;
          if (neighborName && outcome.oldState && outcome.newState) {
            continueWithRelationshipChange(neighborName, outcome.oldState, outcome.newState, done);
            return;
          }
          done?.();
        });
      },
    }))
  );
}

function queueHostileTreeThreat(neighbor, events) {
  if (!neighbor || neighbor.dead) return;
  const decision = buildHostileEncroachmentDecision(state, neighbor, {
    getRelationshipState,
    compareConflictPower,
    getNeighborStage,
  });

  const prompt = describeDecisionPrompt(decision);
  if (prompt) events.push(prompt);
  state.pendingInteractions.push((done) => queueSharedDecisionInteraction(decision, done));
}

function queueChemicalDefenseThreat(events) {
  const decision = buildChemicalDefenseDecision(state, {
    computeCurrentLifeStage,
  });
  const prompt = describeDecisionPrompt(decision);
  if (prompt) events.push(prompt);
  state.pendingInteractions.push((done) => queueSharedDecisionInteraction(decision, done));
}

function rollMajorEvent() {
  return rollMajorEventFromList(MAJOR_EVENTS, currentSeason().name);
}

function rollMinorEvents() {
  return rollMinorEventsForState(state, {
    currentSeasonName: currentSeason().name,
    getPollinatorChance: getPollinatorChanceForState,
    species: SPECIES,
    recordDamage,
    STAGE_BY_NAME,
    getRelationshipState,
    getNeighborStage,
    random: Math.random,
    advanceAllyCrises: (events) => advanceAllyCrises(events),
    advanceOffspringCrises: (events) => advanceChildCrises(events),
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
  const humanUpdate = state.health > 0 ? advanceHumanSystem(state, {
    getRelationshipState,
    getNeighborStage,
    random: Math.random,
  }) : {};
  if (humanUpdate.event) minors.push(humanUpdate.event);
  if (humanUpdate.rumor) {
    addLog(`Fungal rumor: ${humanUpdate.rumor.body}`);
    state.pendingInteractions.push(done => showModal(humanUpdate.rumor.title, `<p><em>${humanUpdate.rumor.body}</em></p>`, done));
  }
  if (humanUpdate.decision) state.pendingInteractions.push(done => queueHumanDecision(humanUpdate.decision, done));
  if (major?.title) addLog(`Major event: ${major.title}.`);
  minors.forEach(event => event?.text && addLog(event.text));
  consequences.forEach(text => text && addLog(text));
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
  }, { record: false });
}

function queueHumanDecision(decision, done) {
  const choices = decision.options
    .filter(option => option.affordable !== false)
    .map(option => ({
      label: option.label,
      onChoose: () => {
        const outcome = resolveHumanDecision(state, decision, option.id, { random: Math.random });
        const logBody = outcome.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        addLog(`${outcome.title}: ${logBody}`);
        updateAlliesCount();
        updateProtectionProgress(state, { getRelationshipState, getNeighborStage });
        updateScore();
        updateUI();
        render();
        const body = outcome.victory ? renderVictoryBody({ score: state.score }) : outcome.body;
        showModal(outcome.title, body, () => {
          if (outcome.fatal || state.health <= 0) {
            handleDeath();
            return;
          }
          done?.();
        });
      },
    }));
  showChoiceModal(decision.title, decision.body, choices);
}

function handleSpringViability(onContinue) {
  return engine.handleSpringViability(state, (fate, prevSeeds) => {
    addLog(`${fate.sprouted} of ${prevSeeds} seeds successfully established this spring.`);
    if (fate.sprouted > 0) addLog(`${fate.sprouted} ${state.selectedSpecies} offspring tree${fate.sprouted !== 1 ? 's' : ''} took root nearby as allies.`);
    if (fate.sprouted > 0) showFeedback(`${fate.sprouted} offspring sprouted!`, 'success');
    onContinue?.();
  });
}

function advanceTurn() {
  return engine.advanceTurn(state, {
    onDeath: () => handleDeath(),
    onAfterSpringViability: (fate, prevSeeds) => {
      addLog(`${fate.sprouted} of ${prevSeeds} seeds successfully established this spring.`);
      if (fate.sprouted > 0) addLog(`${fate.sprouted} ${state.selectedSpecies} offspring tree${fate.sprouted !== 1 ? 's' : ''} took root nearby as allies.`);
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
  updateProtectionProgress(state, { getRelationshipState, getNeighborStage });
  return updateHudUI({
    els,
    state,
    currentSeasonName: currentSeason().name,
    currentStage: computeCurrentLifeStage(),
    seasons: SEASONS,
    currentStageRequirements: currentStageRequirements(),
    affordableActions: getAffordableActions(),
    offspringStats: describeOffspring(state, LIFE_STAGES),
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
    topInset: 92,
  });
  if (!els.mapExplorer?.classList.contains('hidden')) renderMapExplorer();
}

let mapExplorerZoom=1,mapExplorerPreviewZoom=null,mapExplorerPreviewAnchor=null,mapExplorerWheelTimer=null;

function renderMapExplorer() {
  if (!els.mapExplorerCanvas) return;
  renderForestScene({
    ctx: els.mapExplorerCanvas.getContext('2d'),
    canvas: els.mapExplorerCanvas,
    state,
    currentSeason: currentSeason(),
    playerStageName: computeCurrentLifeStage().name,
    getNeighborTree,
    getRelationshipState,
    zoomMultiplier: mapExplorerZoom,
    centerHorizon: true,
  });
}

function centerMapExplorer() {
  const viewport=els.mapExplorerViewport,canvas=els.mapExplorerCanvas;
  if(!viewport||!canvas)return;
  viewport.scrollLeft=(canvas.width-viewport.clientWidth)/2;
  viewport.scrollTop=(canvas.height-viewport.clientHeight)/2;
}

function clearMapExplorerPreview() {
  const canvas=els.mapExplorerCanvas;
  if(canvas){canvas.style.transform='';canvas.style.transformOrigin='';canvas.classList.remove('zoom-preview')}
  if(mapExplorerWheelTimer){clearTimeout(mapExplorerWheelTimer);mapExplorerWheelTimer=null}
  mapExplorerPreviewZoom=null;mapExplorerPreviewAnchor=null;
}

function previewMapExplorerZoom(next,{clientX,clientY}={}) {
  const viewport=els.mapExplorerViewport,canvas=els.mapExplorerCanvas;
  if(!viewport||!canvas)return;
  const zoom=Math.max(.03,Math.min(3,next)),rect=viewport.getBoundingClientRect(),anchorX=clientX==null?viewport.clientWidth/2:clientX-rect.left,anchorY=clientY==null?viewport.clientHeight/2:clientY-rect.top,canvasX=viewport.scrollLeft+anchorX,canvasY=viewport.scrollTop+anchorY;
  mapExplorerPreviewZoom=zoom;mapExplorerPreviewAnchor={clientX:rect.left+anchorX,clientY:rect.top+anchorY};
  canvas.style.transformOrigin=`${canvasX}px ${canvasY}px`;canvas.style.transform=`scale(${zoom/mapExplorerZoom})`;canvas.classList.add('zoom-preview');
  if(els.mapExplorerZoomLabel)els.mapExplorerZoomLabel.textContent=`${Math.round(zoom*100)}%`;
}

function commitMapExplorerPreview() {
  if(mapExplorerPreviewZoom==null)return;
  const zoom=mapExplorerPreviewZoom,anchor=mapExplorerPreviewAnchor;
  clearMapExplorerPreview();setMapExplorerZoom(zoom,anchor||{});
}

function setMapExplorerZoom(next,{clientX,clientY}={}) {
  const viewport=els.mapExplorerViewport,canvas=els.mapExplorerCanvas;
  if(!viewport||!canvas)return;
  const previous=mapExplorerZoom,zoom=Math.max(.03,Math.min(3,next));
  if(Math.abs(zoom-previous)<.0001)return;
  const rect=viewport.getBoundingClientRect(),anchorX=clientX==null?viewport.clientWidth/2:clientX-rect.left,anchorY=clientY==null?viewport.clientHeight/2:clientY-rect.top;
  const canvasX=viewport.scrollLeft+anchorX,canvasY=viewport.scrollTop+anchorY,ratio=zoom/previous;
  mapExplorerZoom=zoom;renderMapExplorer();
  viewport.scrollLeft=canvas.width/2+(canvasX-canvas.width/2)*ratio-anchorX;
  viewport.scrollTop=canvas.height/2+(canvasY-canvas.height/2)*ratio-anchorY;
  if(els.mapExplorerZoomLabel)els.mapExplorerZoomLabel.textContent=`${Math.round(zoom*100)}%`;
}

function resetMapExplorer() {
  clearMapExplorerPreview();mapExplorerZoom=1;renderMapExplorer();
  if(els.mapExplorerZoomLabel)els.mapExplorerZoomLabel.textContent='100%';
  centerMapExplorer();
}

function openMapExplorer() {
  if (!state.started || !els.mapExplorer || !els.mapExplorerViewport) return;
  els.mapExplorer.classList.remove('hidden');
  document.body.classList.add('map-explorer-open');
  clearMapExplorerPreview();mapExplorerZoom=1;renderMapExplorer();
  if(els.mapExplorerZoomLabel)els.mapExplorerZoomLabel.textContent='100%';
  requestAnimationFrame(() => {
    const viewport=els.mapExplorerViewport;
    centerMapExplorer();
    viewport.focus();
  });
}

function closeMapExplorer() {
  clearMapExplorerPreview();
  els.mapExplorer?.classList.add('hidden');
  document.body.classList.remove('map-explorer-open');
  els.canvas?.focus();
}

function initMapExplorer() {
  const viewport=els.mapExplorerViewport;
  if (!viewport) return;
  const panSpeed=2.75,wheelSpeed=4;
  els.canvas.addEventListener('click',openMapExplorer);
  els.canvas.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openMapExplorer()}});
  els.mapExplorerClose?.addEventListener('click',closeMapExplorer);
  els.mapExplorerZoomIn?.addEventListener('click',()=>{const zoom=mapExplorerPreviewZoom??mapExplorerZoom;clearMapExplorerPreview();setMapExplorerZoom(zoom*1.4)});
  els.mapExplorerZoomOut?.addEventListener('click',()=>{const zoom=mapExplorerPreviewZoom??mapExplorerZoom;clearMapExplorerPreview();setMapExplorerZoom(zoom/1.4)});
  els.mapExplorerReset?.addEventListener('click',resetMapExplorer);
  els.mapExplorer?.addEventListener('click',event=>{if(event.target===els.mapExplorer)closeMapExplorer()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!els.mapExplorer.classList.contains('hidden'))closeMapExplorer()});
  const pointers=new Map();let drag=null,pinch=null;
  const pointerDistance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
  const pointerMidpoint=()=>{const [a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.classList.add('dragging');if(pointers.size===1)drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};else if(pointers.size===2){commitMapExplorerPreview();pinch={distance:pointerDistance(),zoom:mapExplorerZoom};drag=null}});
  window.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pinch&&pointers.size>=2){const midpoint=pointerMidpoint();previewMapExplorerZoom(pinch.zoom*pointerDistance()/Math.max(1,pinch.distance),{clientX:midpoint.x,clientY:midpoint.y});return}if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>7)drag.moved=true;viewport.scrollLeft=drag.left-dx*panSpeed;viewport.scrollTop=drag.top-dy*panSpeed});
  const endPointer=event=>{if(!pointers.has(event.pointerId))return;const wasTap=drag?.id===event.pointerId&&!drag.moved&&!pinch,wasPinching=Boolean(pinch&&pointers.size>=2);if(wasPinching){commitMapExplorerPreview();pinch=null}pointers.delete(event.pointerId);if(pointers.size===0){drag=null;pinch=null;viewport.classList.remove('dragging');if(wasTap)closeMapExplorer()}else if(pointers.size===1){const [id,point]=[...pointers.entries()][0];pinch=null;drag={id,x:point.x,y:point.y,left:viewport.scrollLeft,top:viewport.scrollTop,moved:true}}};
  window.addEventListener('pointerup',endPointer);
  window.addEventListener('pointercancel',endPointer);
  viewport.addEventListener('wheel',event=>{event.preventDefault();if(event.ctrlKey||event.metaKey){const current=mapExplorerPreviewZoom??mapExplorerZoom;previewMapExplorerZoom(current*Math.exp(-event.deltaY*.002),{clientX:event.clientX,clientY:event.clientY});if(mapExplorerWheelTimer)clearTimeout(mapExplorerWheelTimer);mapExplorerWheelTimer=setTimeout(commitMapExplorerPreview,90);return}viewport.scrollLeft+=event.deltaX*wheelSpeed;viewport.scrollTop+=event.deltaY*wheelSpeed},{passive:false});
  viewport.addEventListener('keydown',event=>{if(event.key==='+'||event.key==='='){event.preventDefault();const zoom=mapExplorerPreviewZoom??mapExplorerZoom;clearMapExplorerPreview();setMapExplorerZoom(zoom*1.4)}else if(event.key==='-'){event.preventDefault();const zoom=mapExplorerPreviewZoom??mapExplorerZoom;clearMapExplorerPreview();setMapExplorerZoom(zoom/1.4)}else if(event.key==='0'){event.preventDefault();resetMapExplorer()}});
}

els.startGame.addEventListener('click', startGame);
initMapExplorer();
initSpeciesSelect();
render();
