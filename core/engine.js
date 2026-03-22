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
    saveCurrentRunToLeaderboard,
    deathFlavor,
    generateSuccessionChoices,
    continueAsSuccessor,
    showChoiceModal,
    renderSpringSeedFateBody,
    renderGameOverBody,
    renderSuccessionBody,
    renderVictoryBody,
  } = deps;

  function currentSeason(state) {
    return SEASONS[state.seasonIndex];
  }

  function exposureFactor(state) {
    const hostileShade = state.eventModifiers.shade || 0;
    return Math.max(0.15, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - hostileShade);
  }

  function collectResources(state) {
    const season = currentSeason(state);
    const canopyBonus = state.canopySpread * 2;
    const taprootBonus = state.taprootDepth * 2;
    const sunlightBase = state.leafClusters + canopyBonus;
    const sunlightGain = Math.max(1, Math.floor(sunlightBase * exposureFactor(state) * season.factorSun * state.eventModifiers.disease));
    const waterStorage = Math.max(1, state.trunk + Math.floor(state.rootZones / 2) + taprootBonus);
    const waterGain = Math.max(1, Math.floor(waterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));

    const rootNutrients = state.rootZones * 0.7;
    const allyNutrients = Math.min(2, state.allies * 0.35);
    const soilBonus = state.eventModifiers.soilBonus || 0;
    const maintenanceCost = Math.floor((state.trunk + state.leafClusters + state.branches + state.flowers + state.developing + state.seeds) / 6);
    const grossNutrients = Math.max(1, Math.floor((rootNutrients + allyNutrients + soilBonus) * state.eventModifiers.disease));
    const nutrientGain = Math.max(1, grossNutrients - maintenanceCost);

    state.sunlight += sunlightGain;
    state.water += waterGain;
    state.nutrients += nutrientGain;
    state.actions = 3 + Math.floor((sunlightGain + waterGain + nutrientGain) / 5);

    return {
      sunlightGain,
      waterGain,
      nutrientGain,
      waterStorage,
      canopyBonus,
      taprootBonus,
      sunlightBase,
      rootNutrients,
      allyNutrients,
      soilBonus,
      maintenanceCost,
      grossNutrients,
      exposure: exposureFactor(state),
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

    if (state.lifeStage.name === 'Ancient' && !state.victoryAchieved) {
      state.victoryAchieved = true;
      if (!state.recordsSavedThisRun) saveCurrentRunToLeaderboard('reached Ancient');
      showModal('Victory!', renderVictoryBody({ score: state.score }), () => {});
    }

    return state.score;
  }

  function applyEventEffects(state, major, minors) {
    state.eventModifiers.drought = 1;
    state.eventModifiers.disease = 1;
    state.eventModifiers.shade = Math.max(0, (state.eventModifiers.shade || 0) * 0.7);
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
    state.offspringTrees += fate.sprouted;
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

    spend(scaledCost);
    action.effect(state);
    if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed') state.firstRootActionTaken = true;
    showFeedback?.(`${action.name} succeeded!`, 'success');
    addLog?.(`Action: ${action.name}.`);
    if (action.key === 'growBranch') addLog?.('A new branch pushes outward.');
    if (action.key === 'extendRoot') addLog?.('Your roots spread into new soil.');
    if (action.key === 'growLeaves') addLog?.('Fresh leaves unfurl to gather more light.');
    if (action.key === 'thicken') addLog?.('Your trunk thickens and your body grows sturdier.');
    if (action.key === 'flower') addLog?.(`You bloom with ${state.flowers} flower${state.flowers !== 1 ? 's' : ''}.`);
    if (action.key === 'massFlower') addLog?.(`You drive a heavy bloom: ${state.flowers} flower${state.flowers !== 1 ? 's' : ''} now open.`);
    if (action.key === 'nurtureOffspring') addLog?.(`You invest in offspring. Pool: ${state.offspringPool}, established: ${state.offspringTrees}.`);
    updateScoreState(state);
    updateUI();
    render();
    if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed' && state.firstRootActionTaken) {
      if (tryAdvanceLifeStage(() => { resumeTurnFlow?.(); })) return true;
    }
    if (maybeTriggerActionMilestone?.(action.key)) return true;
    if (tryAdvanceLifeStage(() => { resumeTurnFlow?.(); })) return true;
    renderActions?.();
    if (state.actions <= 0) {
      showEventPhase?.();
      return true;
    }
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
      if (!state.recordsSavedThisRun) saveCurrentRunToLeaderboard('lineage ended');
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
