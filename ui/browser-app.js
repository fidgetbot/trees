export function createInitialBrowserState({ initialLifeStage }) {
  return {
    started: false,
    selectedSpecies: null,
    year: 1,
    seasonIndex: 0,
    turnInSeason: 1,
    score: 0,
    lifeStage: initialLifeStage,
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
}

export function getBrowserElements(documentRef = document) {
  return {
    speciesList: documentRef.getElementById('species-list'),
    startGame: documentRef.getElementById('start-game'),
    speciesPanel: documentRef.getElementById('species-panel'),
    gamePanel: documentRef.getElementById('game-panel'),
    hudPanel: documentRef.getElementById('hud-panel'),
    canvas: documentRef.getElementById('game-canvas'),
    modal: documentRef.getElementById('modal'),
    modalTitle: documentRef.getElementById('modal-title'),
    modalBody: documentRef.getElementById('modal-body'),
    modalButton: documentRef.getElementById('modal-button'),
    actionsList: documentRef.getElementById('actions-list'),
    viewLeaderboard: documentRef.getElementById('view-leaderboard'),
    log: documentRef.getElementById('log'),
    feedbackContainer: documentRef.getElementById('feedback-container'),
    tooltip: documentRef.getElementById('tooltip'),
    actionsBanner: documentRef.getElementById('actions-banner'),
    actionsRemaining: documentRef.getElementById('actions-remaining'),
    turnEndBanner: documentRef.getElementById('turn-end-banner'),
    mapMinimize: documentRef.getElementById('map-minimize'),
    mapRestore: documentRef.getElementById('map-restore'),
    mapContent: documentRef.getElementById('map-content'),
    hudMinimize: documentRef.getElementById('hud-minimize'),
    hudRestore: documentRef.getElementById('hud-restore'),
    hudContent: documentRef.getElementById('hud-content'),
  };
}

export function initPanelCollapseUI(els) {
  const bindPanel = ({ panel, content, minimize, restore, chipLabel, buttonLabel }) => {
    if (!panel || !content || !minimize || !restore) return;
    const setCollapsed = (collapsed) => {
      panel.classList.toggle('panel-collapsed', collapsed);
      content.classList.toggle('hidden', collapsed);
      restore.classList.toggle('hidden', !collapsed);
      minimize.classList.toggle('hidden', collapsed);
      minimize.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      restore.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      restore.textContent = chipLabel;
      minimize.setAttribute('aria-label', collapsed ? `Restore ${buttonLabel}` : `Minimize ${buttonLabel}`);
    };
    minimize.onclick = () => setCollapsed(true);
    restore.onclick = () => setCollapsed(false);
    setCollapsed(false);
  };

  bindPanel({ panel: els.gamePanel, content: els.mapContent, minimize: els.mapMinimize, restore: els.mapRestore, chipLabel: '🗺 Map', buttonLabel: 'map' });
  bindPanel({ panel: els.hudPanel, content: els.hudContent, minimize: els.hudMinimize, restore: els.hudRestore, chipLabel: '📊 Status', buttonLabel: 'status' });
}

export function initSpeciesSelectController({ state, speciesNames, chooseRandomIndex, renderSpeciesSelect }) {
  const chosen = speciesNames[chooseRandomIndex(speciesNames.length)];
  state.selectedSpecies = chosen;
  renderSpeciesSelect(chosen);
  return chosen;
}

export function startBrowserGame({
  state,
  initPanelCollapse,
  selectedSpecies,
  species,
  initialLifeStage,
  makeStartingNeighbors,
  initTooltips,
  initCollapsibleGroups,
  addLog,
  updateUI,
  showResourcePhase,
  showGamePanels,
  random,
}) {
  Object.assign(state, {
    started: true,
    year: 1,
    seasonIndex: 0,
    turnInSeason: 1,
    score: 0,
    lifeStage: initialLifeStage,
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
    health: species.health + 3,
    maxHealth: species.health + 3,
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
    growthNudgeCooldown: 3 + Math.floor(random() * 2),
    hasProducedFruit: false,
    milestones: {},
    healthWarningLevel: 0,
    lastDamageCause: 'decline',
    pendingInteractions: [],
    recordsSavedThisRun: false,
  });

  state.selectedSpecies = selectedSpecies;
  showGamePanels();
  initTooltips();
  initCollapsibleGroups();
  initPanelCollapse?.();
  addLog('You begin as a seed, buried in the dark soil.');
  updateUI();
  showResourcePhase();
}

export function showGamePanelsUI(els) {
  els.speciesPanel.classList.add('hidden');
  els.gamePanel.classList.remove('hidden');
  els.hudPanel.classList.remove('hidden');
}
