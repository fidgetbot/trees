import { createOffspringRecords } from './humans.js?rev=life-stage-v1';
import { allyResourceWeight, getShadedOffspring, normalizePlayerShadeTarget, SHADE_NUTRIENT_BONUS, SHADE_SUNLIGHT_BONUS } from './growth.js?rev=shared-rhizosphere-v1';

export const BASE_ACTIONS_PER_TURN = 3;
export const MAX_BONUS_ACTIONS_PER_TURN = 3;

export function diminishingStructureYield(value, fullYield = 8, reducedYield = 12) {
  const amount = Math.max(0, Number(value) || 0);
  const full = Math.min(amount, fullYield);
  const reduced = Math.min(Math.max(0, amount - fullYield), reducedYield) * 0.5;
  const mature = Math.max(0, amount - fullYield - reducedYield) * 0.2;
  return full + reduced + mature;
}

export function getResourceCapacities(state) {
  const rank = state.lifeStage?.rank ?? 3;
  return {
    sunlight: Math.floor(20 + (rank * 10) + (Math.min(state.trunk || 0, 10) * 3) + (Math.min(state.branches || 0, 12) * 3)),
    water: Math.floor(16 + (rank * 7) + (Math.min(state.trunk || 0, 10) * 3) + (Math.min(state.rootZones || 0, 16) * 2) + (Math.min(state.taprootDepth || 0, 8) * 4)),
    nutrients: Math.floor(12 + (rank * 5) + (Math.min(state.rootZones || 0, 16) * 1.5) + (Math.min(state.eventModifiers?.soilBonus || 0, 5) * 5)),
  };
}

export function getResourceMaintenance(state, seasonName) {
  const rank = state.lifeStage?.rank ?? 3;
  const crown = (state.trunk || 0) + (state.branches || 0) + (state.leafClusters || 0) + ((state.canopySpread || 0) * 2);
  const transpiringTissue = (state.leafClusters || 0) + (state.flowers || 0) + (state.developing || 0) + (state.seeds || 0) + ((state.canopySpread || 0) * 2);
  const livingTissue = crown + (state.flowers || 0) + (state.developing || 0) + (state.seeds || 0);
  const sunlightBase = rank < 3 ? 0 : Math.floor(crown / (rank >= 4 ? 18 : 20));
  const waterBase = rank < 3 ? 0 : Math.floor(transpiringTissue / 11);
  const nutrientBase = Math.floor(livingTissue / 9);
  const sunlightFactor = seasonName === 'Winter' ? 0.5 : 1;
  const waterFactor = seasonName === 'Summer' ? 1.25 : seasonName === 'Winter' ? 0.25 : seasonName === 'Autumn' ? 0.75 : 1;
  const nutrientFactor = seasonName === 'Winter' ? 0.5 : 1;
  return {
    sunlight: Math.floor(sunlightBase * sunlightFactor),
    water: Math.floor(waterBase * waterFactor),
    nutrients: Math.floor(nutrientBase * nutrientFactor),
    base: { sunlight: sunlightBase, water: waterBase, nutrients: nutrientBase },
  };
}

export function actionsForGathering(totalGathered) {
  const bonusActions = Math.min(
    MAX_BONUS_ACTIONS_PER_TURN,
    Math.floor(Math.max(0, totalGathered) / 5),
  );
  return BASE_ACTIONS_PER_TURN + bonusActions;
}

export function shouldSkipGathering(state) {
  return (state.rootZones || 0) === 0;
}

export function updateResourceShortageNudges(state, gains) {
  state.resourceShortageStreaks ||= { sunlight: 0, water: 0, nutrients: 0 };
  state.resourceNudgeLevels ||= { sunlight: 0, water: 0, nutrients: 0 };
  const values = { sunlight: gains.sunlightGain, water: gains.waterGain, nutrients: gains.nutrientGain };
  const rank = state.lifeStage?.rank || 0;
  const turnsInStage = state.turnsInStage || 0;
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'][state.seasonIndex || 0];
  const possibleRemedies = {
    sunlight: [
      rank >= 1 && rank < 4 && season !== 'Winter' ? 'Grow Leaf' : null,
      rank >= 2 && (state.spindlyGrowth || 0) < 3 ? 'Grow Taller' : null,
      rank >= 3 ? 'Grow Branch' : null,
      rank >= 3 && turnsInStage >= 9 ? 'Expand Canopy' : null,
    ],
    water: [
      'Extend Root',
      rank >= 3 && turnsInStage >= 6 ? 'Deepen Taproot' : null,
    ],
    nutrients: [
      'Extend Root',
      rank >= 3 && turnsInStage >= 6 ? 'Deepen Taproot' : null,
      rank >= 3 && turnsInStage >= 15 ? 'Enrich Rhizosphere' : null,
    ],
  };
  const formatRemedies = (actions, fallback) => {
    const available = actions.filter(Boolean);
    if (!available.length) return fallback;
    const names = available.map(name => `<strong>${name}</strong>`);
    if (names.length === 1) return `${names[0]} can help.`;
    return `${names.slice(0, -1).join(', ')} or ${names.at(-1)} can help.`;
  };
  const guidance = {
    sunlight: ['Your crown is bringing in too little light. Young leaves turn toward every opening in the canopy.', formatRemedies(possibleRemedies.sunlight, 'No current action can add green tissue during winter dormancy; hold your reserves until spring returns.')],
    water: ['A persistent thirst tightens through your living wood. Your roots keep searching for cooler, wetter soil.', formatRemedies(possibleRemedies.water, 'Keep enough reserves to extend your roots when growth resumes.')],
    nutrients: ['Your new tissues are running lean. Fine roots probe the soil for the minerals growth requires.', formatRemedies(possibleRemedies.nutrients, 'Keep enough reserves to extend your roots when growth resumes.')],
  };
  for (const kind of ['sunlight', 'water', 'nutrients']) {
    if (values[kind] <= 1) state.resourceShortageStreaks[kind] = (state.resourceShortageStreaks[kind] || 0) + 1;
    else { state.resourceShortageStreaks[kind] = 0; state.resourceNudgeLevels[kind] = 0; }
  }
  const kind = ['sunlight', 'water', 'nutrients'].find(resource => {
    const streak = state.resourceShortageStreaks[resource] || 0;
    const level = state.resourceNudgeLevels[resource] || 0;
    return (streak >= 6 && level < 2) || (streak >= 3 && level < 1);
  });
  if (!kind) return null;
  const urgent = state.resourceShortageStreaks[kind] >= 6;
  state.resourceNudgeLevels[kind] = urgent ? 2 : 1;
  const [body, remedy] = guidance[kind];
  return {
    title: urgent ? `Persistent ${kind[0].toUpperCase()}${kind.slice(1)} Shortage` : `A Need for More ${kind[0].toUpperCase()}${kind.slice(1)}`,
    body: urgent ? `${body} The strain has continued for many turns, and your growth cannot ignore it much longer.` : body,
    remedy,
    log: `${urgent ? 'Persistent' : 'Developing'} ${kind} shortage: your tissues urge you toward corrective growth.`,
  };
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
    showGameOverScreen,
    getRelationshipState = () => ({ name: 'Neutral' }),
    getNeighborStage = () => ({ rank: 3 }),
  } = deps;

  function currentSeason(state) {
    return SEASONS[state.seasonIndex];
  }

  function groveRelations(state) {
    const livingNeighbors = (state.neighbors || []).filter(neighbor => !neighbor.dead);
    const alliedNeighbors = livingNeighbors.filter(neighbor => getRelationshipState(neighbor.relation).name === 'Ally');
    const adjacentContested = livingNeighbors.filter(neighbor => {
      const relationship = getRelationshipState(neighbor.relation).name;
      return (neighbor.slot === 1 || neighbor.slot === 3) && (relationship === 'Rival' || relationship === 'Hostile');
    });
    const rivalNeighbors = adjacentContested.filter(neighbor => getRelationshipState(neighbor.relation).name === 'Rival').length;
    const hostileNeighbors = adjacentContested.filter(neighbor => getRelationshipState(neighbor.relation).name === 'Hostile').length;
    return {
      shadedNeighbors: normalizePlayerShadeTarget(state) ? 1 : 0,
      crowdingNeighbors: livingNeighbors.filter(neighbor => neighbor.shadingPlayer).length,
      connectedAllies: alliedNeighbors.length,
      connectedAllyStrength: alliedNeighbors.reduce((sum, neighbor) => sum + allyResourceWeight(neighbor, getNeighborStage), 0),
      rivalNeighbors,
      hostileNeighbors,
    };
  }

  function exposureFactor(state, crowdingNeighbors = groveRelations(state).crowdingNeighbors) {
    return Math.max(0.15, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - (crowdingNeighbors * 0.12));
  }

  function collectResources(state) {
    const season = currentSeason(state);
    const relations = groveRelations(state);
    const effectiveLeaves = diminishingStructureYield(state.leafClusters);
    const effectiveCanopy = diminishingStructureYield(state.canopySpread, 4, 4);
    const effectiveRoots = diminishingStructureYield(state.rootZones);
    const effectiveTaproot = diminishingStructureYield(state.taprootDepth, 6, 4);
    const canopyBonus = effectiveCanopy * 2;
    const taprootBonus = effectiveTaproot * 2;
    const canopyAdvantage = relations.shadedNeighbors ? SHADE_SUNLIGHT_BONUS : 0;
    const shadeNutrientBonus = relations.shadedNeighbors ? SHADE_NUTRIENT_BONUS : 0;
    const heightSunlightBonus = Math.max(0, state.heightGrowth || 0);
    const sunlightBase = effectiveLeaves + canopyBonus + heightSunlightBonus;
    const neutralSunlightBase = sunlightBase;
    const crowdedSunlightGain = Math.max(1, Math.floor(sunlightBase * exposureFactor(state, relations.crowdingNeighbors) * season.factorSun * state.eventModifiers.disease));
    const sunlightGain = Math.max(1, crowdedSunlightGain + canopyAdvantage);
    const neutralSunlightGain = Math.max(1, Math.floor(neutralSunlightBase * exposureFactor(state, 0) * season.factorSun * state.eventModifiers.disease));
    const allyWater = relations.connectedAllyStrength * 0.35;
    const hostileWaterPenalty = Math.min(2, relations.hostileNeighbors);
    const waterStorage = Math.max(1, state.trunk + Math.floor(effectiveRoots / 2) + taprootBonus + allyWater);
    const neutralWaterStorage = Math.max(1, state.trunk + Math.floor(effectiveRoots / 2) + taprootBonus);
    const unpressuredWaterGain = Math.max(1, Math.floor(waterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));
    const waterGain = Math.max(0, unpressuredWaterGain - hostileWaterPenalty);
    const neutralWaterGain = Math.max(1, Math.floor(neutralWaterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));

    const taprootNutrients = effectiveTaproot * 0.5;
    const rootNutrients = (effectiveRoots * 0.7) + taprootNutrients;
    const allyNutrients = Math.min(5, relations.connectedAllyStrength);
    const rootCompetitionPenalty = Math.min(3, relations.rivalNeighbors + relations.hostileNeighbors);
    const soilBonus = state.eventModifiers.soilBonus || 0;
    const maintenance = getResourceMaintenance(state, season.name);
    const baseMaintenanceCost = maintenance.base.nutrients;
    const maintenanceCost = maintenance.nutrients;
    const dormancySavings = Object.values(maintenance.base).reduce((sum, value) => sum + value, 0)
      - (maintenance.sunlight + maintenance.water + maintenance.nutrients);
    const grossNutrients = Math.max(1, Math.floor((rootNutrients + allyNutrients + soilBonus) * state.eventModifiers.disease));
    const neutralGrossNutrients = Math.max(1, Math.floor((rootNutrients + soilBonus) * state.eventModifiers.disease));
    const nutrientGain = Math.max(0, grossNutrients - rootCompetitionPenalty) + shadeNutrientBonus;
    const neutralNutrientGain = neutralGrossNutrients;
    const capacities = getResourceCapacities(state);
    const previous = { sunlight: state.sunlight || 0, water: state.water || 0, nutrients: state.nutrients || 0 };
    const beforeCapacity = {
      sunlight: Math.max(0, previous.sunlight + sunlightGain - maintenance.sunlight),
      water: Math.max(0, previous.water + waterGain - maintenance.water),
      nutrients: Math.max(0, previous.nutrients + nutrientGain - maintenance.nutrients),
    };
    const overflow = {
      sunlight: Math.max(0, beforeCapacity.sunlight - capacities.sunlight),
      water: Math.max(0, beforeCapacity.water - capacities.water),
      nutrients: Math.max(0, beforeCapacity.nutrients - capacities.nutrients),
    };
    state.sunlight = Math.min(capacities.sunlight, beforeCapacity.sunlight);
    state.water = Math.min(capacities.water, beforeCapacity.water);
    state.nutrients = Math.min(capacities.nutrients, beforeCapacity.nutrients);
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
      effectiveLeaves,
      effectiveCanopy,
      effectiveRoots,
      effectiveTaproot,
      rootNutrients,
      taprootNutrients,
      allyNutrients,
      allyWater,
      hostileWaterPenalty,
      rootCompetitionPenalty,
      canopyAdvantage,
      shadeNutrientBonus,
      soilBonus,
      maintenanceCost,
      baseMaintenanceCost,
      maintenance,
      capacities,
      overflow,
      storedDelta: {
        sunlight: state.sunlight - previous.sunlight,
        water: state.water - previous.water,
        nutrients: state.nutrients - previous.nutrients,
      },
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
    const upkeep = gains.maintenance.sunlight + gains.maintenance.water + gains.maintenance.nutrients;
    const returned = gains.overflow.sunlight + gains.overflow.water + gains.overflow.nutrients;
    addLog?.(`Gathered +${gains.sunlightGain} sunlight, +${gains.waterGain} water, +${gains.nutrientGain} nutrients.${upkeep ? ` Living tissue used ${upkeep} in upkeep.` : ''}${returned ? ` ${returned} beyond your storage capacity returned to the grove.` : ''}`);
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
    const createdOffspring = createOffspringRecords(state, fate.sprouted);
    const shadedIds = new Set(getShadedOffspring(state).map(child => child.id));
    fate.shadedSprouts = createdOffspring.filter(child => shadedIds.has(child.id)).length;
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
    state.turnsElapsed = (state.turnsElapsed || 0) + 1;

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
      if (action.key === 'rhizosphere') {
        const supportedAllies = (state.neighbors || []).filter(neighbor => !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally').length;
        addLog?.(supportedAllies
          ? `You enrich the shared soil. Your nutrient uptake improves, and ${supportedAllies} connected ${supportedAllies === 1 ? 'ally receives' : 'allies receive'} lasting growth support.`
          : 'You enrich the soil community around your roots, improving future nutrient uptake.');
      }
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
    state.gameOver = true;
    const flavor = deathFlavor(state.lastDamageCause);
    const lifetimeTurns = Math.max(1, (state.turnsElapsed || 0) + 1);
    showGameOverScreen?.({
      flavor,
      score: state.score,
      lifetimeTurns,
      years: Math.max(0, state.year - 1),
      cause: state.lastDamageCause || 'decline',
      species: state.selectedSpecies || 'tree',
    });
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
