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
  } = deps;

  function currentSeason(state) {
    return SEASONS[state.seasonIndex];
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
    showModal('Spring Seed Fate', `
      <p>${prevSeeds} seed${prevSeeds !== 1 ? 's' : ''} faced the hazards of dispersal and germination.</p>
      <ul>${fate.results.map(r => `<li>${r}</li>`).join('')}</ul>
      <p><strong>${fate.sprouted}</strong> offspring successfully sprouted.</p>
    `, () => onContinue?.(fate, prevSeeds));
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
        updateScore(); updateUI(); render();
        if (handleSpringViability(state, (fate, prevSeeds) => onAfterSpringViability?.(fate, prevSeeds))) return true;
      }
    }

    growNeighbors();
    updateAlliesCount();
    updateScore();
    updateUI();
    render();
    if (tryAdvanceLifeStage(() => { updateScore(); updateUI(); render(); showResourcePhase(); })) return true;
    if (maybeShowGrowthNudge()) return true;
    if (maybeShowAllyWarning()) return true;
    onAfterAdvance?.();
    showResourcePhase();
    return true;
  }

  function showEventPhase(state) {
    const major = state.turnInSeason === 3 ? rollMajorEvent() : null;
    const minors = rollMinorEvents();
    const consequences = applyEventEffects(state, major, minors);
    updateScore();
    updateUI();
    render();
    return { major, minors, consequences };
  }

  function handleDeath(state) {
    if (state.offspringPool > 0) {
      const generated = generateSuccessionChoices(Math.min(3, state.offspringPool));
      const choices = generated.map(choice => ({
        label: choice.label,
        onChoose: () => continueAsSuccessor(choice),
      }));
      showChoiceModal('Succession', `
        <p>Your current tree has died, but living offspring remain.</p>
        <p>Choose which surviving line will carry the grove forward:</p>
        <ul>
          ${generated.map(choice => `<li><strong>${choice.label}</strong> — ${choice.summary}</li>`).join('')}
        </ul>
      `, choices);
    } else {
      state.gameOver = true;
      const flavor = deathFlavor(state.lastDamageCause);
      if (!state.recordsSavedThisRun) saveCurrentRunToLeaderboard('lineage ended');
      showModal('Game Over', `<p><em>${flavor}</em></p><p>Your lineage has ended.</p><p>Final score: <strong>${state.score}</strong></p><p>Your run has been added to the grove records.</p>`, () => {});
    }
  }

  return {
    currentSeason,
    applyEventEffects,
    handleSpringViability,
    advanceTurn,
    showEventPhase,
    handleDeath,
    computeCurrentLifeStage,
  };
}
