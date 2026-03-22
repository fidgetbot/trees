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
    mapToggle: documentRef.getElementById('map-toggle'),
    mapDrawer: documentRef.getElementById('map-drawer'),
    mapClose: documentRef.getElementById('map-close'),
    resourcesToggle: documentRef.getElementById('resources-toggle'),
    resourcesDrawer: documentRef.getElementById('resources-drawer'),
    resourcesClose: documentRef.getElementById('resources-close'),
  };
}

export function initFloatingPanelsUI(els) {
  const bindDrawer = (toggle, drawer, close, expandedLabel, collapsedLabel) => {
    if (!toggle || !drawer || !close) return;
    const setOpen = (open) => {
      drawer.classList.toggle('minimized', !open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? collapsedLabel : expandedLabel;
    };
    toggle.onclick = () => setOpen(drawer.classList.contains('minimized'));
    close.onclick = () => setOpen(false);
    setOpen(false);
  };

  bindDrawer(els.mapToggle, els.mapDrawer, els.mapClose, '🗺️ Show Map', '🗺️ Hide Map');
  bindDrawer(els.resourcesToggle, els.resourcesDrawer, els.resourcesClose, '📊 Show Status', '📊 Hide Status');
}

export function initSpeciesSelectController({ state, speciesNames, chooseRandomIndex, renderSpeciesSelect }) {
  const chosen = speciesNames[chooseRandomIndex(speciesNames.length)];
  state.selectedSpecies = chosen;
  renderSpeciesSelect(chosen);
  return chosen;
}

export function startBrowserGame({
  state,
  els,
  selectedSpecies,
  species,
  initialLifeStage,
  makeStartingNeighbors,
  initTooltips,
  initCollapsibleGroups,
  initFloatingPanels,
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
  initFloatingPanels?.(els);
  addLog('You begin as a seed, buried in the dark soil.');
  updateUI();
  showResourcePhase();
}

export function showGamePanelsUI(els) {
  els.speciesPanel.classList.add('hidden');
  els.gamePanel.classList.remove('hidden');
  els.hudPanel.classList.remove('hidden');
}
