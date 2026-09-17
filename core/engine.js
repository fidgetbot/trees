import { createOffspringRecords } from './humans.js';
import { allyResourceWeight, normalizePlayerShadeTarget, SHADE_SUNLIGHT_BONUS } from './growth.js?rev=directional-shade-v1';

export const BASE_ACTIONS_PER_TURN = 3;
export const MAX_BONUS_ACTIONS_PER_TURN = 3;

export function actionsForGathering(totalGathered) {
  const bonusActions = Math.min(
    MAX_BONUS_ACTIONS_PER_TURN,
    Math.floor(Math.max(0, totalGathered) / 5),
  );
  return BASE_ACTIONS_PER_TURN + bonusActions;
}

export function createEngine(deps) {
  const {
    SEASONS,
    computeCurrentLifeStage,
    getStageProgressIncrement,
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
    getRelationshipState = () => ({ name: 'Neutral' }),
    getNeighborStage = () => ({ rank: 3 }),
  } = deps;

  function currentSeason(state) {
    return SEASONS[state.seasonIndex];
  }

  function groveRelations(state) {
    const livingNeighbors = (state.neighbors || []).filter(neighbor => !neighbor.dead);
    const alliedNeighbors = livingNeighbors.filter(neighbor => getRelationshipState(neighbor.relation).name === 'Ally');
    return {
      shadedNeighbors: normalizePlayerShadeTarget(state) ? 1 : 0,
      crowdingNeighbors: livingNeighbors.filter(neighbor => neighbor.shadingPlayer).length,
      connectedAllies: alliedNeighbors.length,
      connectedAllyStrength: alliedNeighbors.reduce((sum, neighbor) => sum + allyResourceWeight(neighbor, getNeighborStage), 0),
    };
  }

  function exposureFactor(state, crowdingNeighbors = groveRelations(state).crowdingNeighbors) {
    return Math.max(0.15, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - (crowdingNeighbors * 0.12));
  }

  function collectResources(state) {
    const season = currentSeason(state);
    const relations = groveRelations(state);
    const canopyBonus = state.canopySpread * 2;
    const taprootBonus = state.taprootDepth * 2;
    const canopyAdvantage = relations.shadedNeighbors ? SHADE_SUNLIGHT_BONUS : 0;
    const heightSunlightBonus = Math.max(0, state.heightGrowth || 0);
    const sunlightBase = state.leafClusters + canopyBonus + heightSunlightBonus;
    const neutralSunlightBase = sunlightBase;
    const crowdedSunlightGain = Math.max(1, Math.floor(sunlightBase * exposureFactor(state, relations.crowdingNeighbors) * season.factorSun * state.eventModifiers.disease));
    const sunlightGain = Math.max(1, crowdedSunlightGain + canopyAdvantage);
    const neutralSunlightGain = Math.max(1, Math.floor(neutralSunlightBase * exposureFactor(state, 0) * season.factorSun * state.eventModifiers.disease));
    const allyWater = relations.connectedAllyStrength * 0.35;
    const waterStorage = Math.max(1, state.trunk + Math.floor(state.rootZones / 2) + taprootBonus + allyWater);
    const neutralWaterStorage = Math.max(1, state.trunk + Math.floor(state.rootZones / 2) + taprootBonus);
    const waterGain = Math.max(1, Math.floor(waterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));
    const neutralWaterGain = Math.max(1, Math.floor(neutralWaterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));

    const taprootNutrients = state.taprootDepth * 0.35;
    const rootNutrients = (state.rootZones * 0.7) + taprootNutrients;
    const allyNutrients = Math.min(5, relations.connectedAllyStrength);
    const soilBonus = state.eventModifiers.soilBonus || 0;
    const baseMaintenanceCost = Math.floor((state.trunk + state.leafClusters + state.branches + state.flowers + state.developing + state.seeds) / 6);
    const maintenanceCost = season.name === 'Winter' ? Math.floor(baseMaintenanceCost / 2) : baseMaintenanceCost;
    const dormancySavings = baseMaintenanceCost - maintenanceCost;
    const grossNutrients = Math.max(1, Math.floor((rootNutrients + allyNutrients + soilBonus) * state.eventModifiers.disease));
    const neutralGrossNutrients = Math.max(1, Math.floor((rootNutrients + soilBonus) * state.eventModifiers.disease));
    const nutrientGain = Math.max(1, grossNutrients - maintenanceCost);
    const neutralNutrientGain = Math.max(1, neutralGrossNutrients - maintenanceCost);

    state.sunlight += sunlightGain;
    state.water += waterGain;
    state.nutrients += nutrientGain;
    state.actions = actionsForGathering(sunlightGain + waterGain + nutrientGain);

    return {
      sunlightGain,
      waterGain,
      nutrientGain,
      waterStorage,
      canopyBonus,
      heightSunlightBonus,
      taprootBonus,
      sunlightBase,
      rootNutrients,
      taprootNutrients,
      allyNutrients,
      allyWater,
      canopyAdvantage,
      soilBonus,
      maintenanceCost,
      baseMaintenanceCost,
      dormancySavings,
      grossNutrients,
      exposure: exposureFactor(state, relations.crowdingNeighbors),
      neutralGains: {
        sunlight: neutralSunlightGain,
        water: neutralWaterGain,
        nutrients: neutralNutrientGain,
      },
      relationDeltas: {
        sunlight: sunlightGain - neutralSunlightGain,
        water: waterGain - neutralWaterGain,
        nutrients: nutrientGain - neutralNutrientGain,
      },
      relations,
      season,
    };
  }

  function startTurn(state, hooks = {}) {
    const {
      addLog,
      presentResources,
    } = hooks;

    const gains = collectResources(state);
    addLog?.(`Gathered +${gains.sunlightGain} sunlight, +${gains.waterGain} water, +${gains.nutrientGain} nutrients.`);
    updateUI();
    render();
    presentResources?.(gains);
    return gains;
  }

  function calculateScore(state) {
    return (state.year * 10) + (state.branches + state.rootZones + state.trunk) + (state.viableSeeds * 55) + (state.allies * 22) + (state.offspringPool * 5);
  }

  function updateScoreState(state) {
    state.score = calculateScore(state);

    return state.score;
  }

  function applyEventEffects(state, major, minors) {
    state.eventModifiers.drought = 1;
    state.eventModifiers.disease = 1;
    state.eventModifiers.shelter = Math.max(0, (state.eventModifiers.shelter || 0) - 0.25);

    const consequences = [];

    if (major) {
      const majorEffects = major.apply(state);
      consequences.push(...majorEffects);
      if (state.health > 0) state.majorEventsSurvivedInStage += 1;
    }

    minors.forEach(event => {
      if (event.effect === 'pollinated') state.score += 5;
    });

    state.health = Math.min(state.maxHealth, Math.max(0, state.health));
    return consequences;
  }

  function handleSpringViability(state, onContinue) {
    if (state.seeds <= 0) return false;
    const prevSeeds = state.seeds;
    const fate = resolveSeedFate(state.seeds);
    state.viableSeeds += fate.sprouted;
    state.offspringPool += fate.sprouted;
    createOffspringRecords(state, fate.sprouted);
    state.seeds = 0;
    showModal('Spring Seed Fate', renderSpringSeedFateBody({ prevSeeds, fate }), () => onContinue?.(fate, prevSeeds));
    return true;
  }

  function afterSpringAdvance(state, hooks = {}) {
    const {
      onAfterSpringViability,
      onAfterAdvance,
    } = hooks;

    growNeighbors();
    updateAlliesCount();
    updateScoreState(state);
    updateUI();
    render();
    if (tryAdvanceLifeStage(() => { updateScoreState(state); updateUI(); render(); showResourcePhase(); })) return true;
    if (maybeShowGrowthNudge()) return true;
    if (maybeShowAllyWarning()) return true;
    onAfterSpringViability?.();
    onAfterAdvance?.();
    showResourcePhase();
    return true;
  }

  function advanceTurn(state, hooks = {}) {
    const { onDeath, onAfterSpringViability, onAfterAdvance } = hooks;
    if (state.health <= 0) return onDeath?.() ?? false;

    state.turnsInStage += getStageProgressIncrement();
    if (state.growthNudgeCooldown > 0) state.growthNudgeCooldown -= 1;

    if (state.turnInSeason < 3) {
      state.turnInSeason += 1;
    } else {
      state.turnInSeason = 1;
      state.seasonIndex += 1;
      if (state.seasonIndex > 3) {
        state.seasonIndex = 0;
        state.year += 1;
      }
      if (currentSeason(state).name === 'Spring') {
        updateScoreState(state); updateUI(); render();
        if (handleSpringViability(state, (fate, prevSeeds) => {
          onAfterSpringViability?.(fate, prevSeeds);
          afterSpringAdvance(state, hooks);
        })) return true;
      }
    }

    return afterSpringAdvance(state, {
      onAfterAdvance,
    });
  }

  function showEventPhase(state) {
    const major = state.turnInSeason === 3 ? rollMajorEvent() : null;
    const minors = rollMinorEvents();
    const consequences = applyEventEffects(state, major, minors);
    updateScoreState(state);
    updateUI();
    render();
    return { major, minors, consequences };
  }

  function executeAction(state, action, scaledCost, hooks = {}) {
    const {
      spend,
      showFeedback,
      addLog,
      maybeTriggerActionMilestone,
      resumeTurnFlow,
      renderActions,
      showEventPhase,
    } = hooks;

    let status = 'pending';
    let completed = false;

    const commit = () => {
      if (status !== 'pending') return status === 'committed';
      spend(scaledCost);
      status = 'committed';
      return true;
    };

    const cancel = () => {
      if (status !== 'pending') return false;
      status = 'cancelled';
      showFeedback?.(`${action.name} cancelled — nothing spent.`, 'info');
      updateUI();
      render();
      renderActions?.();
      return true;
    };

    const complete = () => {
      if (completed || status === 'cancelled') return false;
      commit();
      completed = true;
      if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed') state.firstRootActionTaken = true;
      showFeedback?.(`${action.name} succeeded!`, 'success');
      addLog?.(`Action: ${action.name}.`);
      if (action.key === 'growBranch') addLog?.('A new branch pushes outward.');
      if (action.key === 'extendRoot') addLog?.('Your roots spread into new soil.');
      if (action.key === 'growLeaves') addLog?.('A fresh leaf unfurls to gather more light.');
      if (action.key === 'growTaller') addLog?.('Your trunk reaches upward for more light, leaving the new height slender in the wind.');
      if (action.key === 'bark') addLog?.('Your bark and trunk thicken, bracing slender growth against the wind.');
      if (action.key === 'flower') addLog?.(`You bloom with ${state.flowers} flower${state.flowers !== 1 ? 's' : ''}.`);
      if (action.key === 'massFlower') addLog?.(`You drive a heavy bloom: ${state.flowers} flower${state.flowers !== 1 ? 's' : ''} now open.`);
      if (action.key === 'nurtureOffspring') addLog?.(`You send water, nutrients, and stored energy to one of your child trees.`);
      updateScoreState(state);
      updateUI();
      render();
      if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed' && state.firstRootActionTaken) {
        if (tryAdvanceLifeStage(() => { resumeTurnFlow?.(); })) return true;
      }
      if (maybeTriggerActionMilestone?.(action.key)) return true;
      if (tryAdvanceLifeStage(() => { resumeTurnFlow?.(); })) return true;
      renderActions?.();
      if (state.actions <= 0) showEventPhase?.();
      return true;
    };

    const transaction = { commit, cancel, complete };
    const result = action.effect(state, { scaledCost, transaction });
    if (action.key === 'growTaller' && state.pendingCanopyNotices?.length) {
      const notices = state.pendingCanopyNotices.splice(0);
      notices.forEach(notice => addLog?.(notice.message));
      const latest = notices[notices.length - 1];
      showFeedback?.(latest.message, 'info');
    }
    if (result?.deferred) return true;
    complete();
    return true;
  }

  function continueAfterEvent(state, hooks = {}) {
    const {
      processPendingInteractions: processPendingInteractionsHook,
      maybeShowHealthWarning: maybeShowHealthWarningHook,
      advanceTurn: advanceTurnHook,
      showTaprootResilience,
    } = hooks;

    const continueFlow = () => {
      processPendingInteractionsHook?.(() => {
        if (maybeShowHealthWarningHook?.(advanceTurnHook)) return;
        advanceTurnHook?.();
      });
    };

    if (state.majorEvent?.key === 'Drought' && state.taprootDepth > 0) {
      showTaprootResilience?.(continueFlow);
      return true;
    }

    continueFlow();
    return true;
  }

  function handleDeath(state) {
    if (state.offspringPool > 0) {
      const generated = generateSuccessionChoices(Math.min(3, state.offspringPool));
      const choices = generated.map(choice => ({
        label: choice.label,
        onChoose: () => continueAsSuccessor(choice),
      }));
      showChoiceModal('Succession', renderSuccessionBody({ generated }), choices);
    } else {
      state.gameOver = true;
      const flavor = deathFlavor(state.lastDamageCause);
      showModal('Game Over', renderGameOverBody({ flavor, score: state.score }), () => {});
    }
  }

  return {
    currentSeason,
    exposureFactor,
    collectResources,
    startTurn,
    applyEventEffects,
    handleSpringViability,
    afterSpringAdvance,
    advanceTurn,
    showEventPhase,
    executeAction,
    continueAfterEvent,
    handleDeath,
    updateScoreState,
    calculateScore,
    computeCurrentLifeStage,
  };
}
