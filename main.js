const SEASONS = [
  { name: 'Spring', factorSun: 0.8, factorWater: 1.0, top: '#FFE4E1', bottom: '#E6F3FF' },
  { name: 'Summer', factorSun: 1.2, factorWater: 0.6, top: '#FFD700', bottom: '#90EE90' },
  { name: 'Autumn', factorSun: 0.6, factorWater: 0.8, top: '#FF8C00', bottom: '#8B4513' },
  { name: 'Winter', factorSun: 0.2, factorWater: 0.4, top: '#D3D3D3', bottom: '#F0F8FF' },
];

// Life stages use automatic growth requirements for the player.
// Legacy threshold values remain only for neighbor visualization/scaling.
const LIFE_STAGES = [
  { name: 'Seed', rank: 0, threshold: 0, unlocks: ['extendRoot'], damageMult: 3, popup: '' },
  { name: 'Sprout', rank: 1, threshold: 100, unlocks: ['growLeaves'], damageMult: 2, popup: 'Your shell cracks. You push outward into the unknown.' },
  { name: 'Seedling', rank: 2, threshold: 300, unlocks: ['defense', 'connect', 'requestHelp'], damageMult: 1.5, popup: 'Your taproot finds rich soil. You feel sturdy.' },
  { name: 'Sapling', rank: 3, threshold: 600, unlocks: ['growBranch'], damageMult: 1.2, popup: 'Your woody fibers harden. You have become a Sapling!' },
  { name: 'Small Tree', rank: 4, threshold: 1000, unlocks: ['flower'], damageMult: 1, popup: 'You yearn skyward. Your canopy reaches for the light.' },
  { name: 'Mature Tree', rank: 5, threshold: 2000, unlocks: ['thicken'], damageMult: 0.8, popup: 'Fruits of your own hang heavy. The cycle turns.' },
  { name: 'Ancient', rank: 6, threshold: 5000, unlocks: ['victory'], damageMult: 0.5, popup: 'Lightning scar and fire ash — you endure. Ancient patience fills you.' },
];

const STAGE_BY_NAME = Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, stage]));

// Seasonal action locks
const SEASONAL_ACTIONS = {
  flower: ['Spring'],
};

// Diplomacy system
const RELATIONSHIP_STATES = {
  ALLY: { min: 50, name: 'Ally', color: '#4CAF50' },
  FRIENDLY: { min: 10, name: 'Friendly', color: '#8BC34A' },
  NEUTRAL: { min: -10, name: 'Neutral', color: '#9E9E9E' },
  RIVAL: { min: -50, name: 'Rival', color: '#FF9800' },
  HOSTILE: { min: -100, name: 'Hostile', color: '#F44336' },
};

function getRelationshipState(score) {
  if (score >= 50) return RELATIONSHIP_STATES.ALLY;
  if (score >= 10) return RELATIONSHIP_STATES.FRIENDLY;
  if (score >= -10) return RELATIONSHIP_STATES.NEUTRAL;
  if (score >= -50) return RELATIONSHIP_STATES.RIVAL;
  return RELATIONSHIP_STATES.HOSTILE;
}

function getLifeStage(score) {
  for (let i = LIFE_STAGES.length - 1; i >= 0; i--) {
    if (score >= LIFE_STAGES[i].threshold) {
      return LIFE_STAGES[i];
    }
  }
  return LIFE_STAGES[0];
}

function getNeighborStage(score) {
  return getLifeStage(score);
}

function computeCurrentLifeStage() {
  return state.lifeStage || LIFE_STAGES[0];
}

function turnsForYears(years) {
  return years * 12;
}

function currentStageRequirements() {
  const stage = computeCurrentLifeStage().name;
  switch (stage) {
    case 'Seed':
      return [
        { key: 'firstRoot', label: 'Take your first action: grow roots', met: state.firstRootActionTaken },
      ];
    case 'Sprout':
      return [
        { key: 'time', label: 'Live through 1 turn as a sprout', met: state.turnsInStage >= 1 },
        { key: 'roots', label: 'Reach 2 root zones', met: state.rootZones >= 2 },
        { key: 'leaves', label: 'Grow 2 leaf clusters', met: state.leafClusters >= 2 },
      ];
    case 'Seedling':
      return [
        { key: 'time', label: 'Live through 4 seasons', met: state.turnsInStage >= 12 },
        { key: 'major', label: 'Survive 1 major event', met: state.majorEventsSurvivedInStage >= 1 },
      ];
    case 'Sapling':
      return [
        { key: 'time', label: 'Live 4 years', met: state.turnsInStage >= turnsForYears(4) },
        { key: 'branches', label: 'Grow 2 branches', met: state.branches >= 2 },
      ];
    case 'Small Tree':
      return [
        { key: 'time', label: 'Live 5 years', met: state.turnsInStage >= turnsForYears(5) },
        { key: 'fruit', label: 'Produce your first fruit', met: state.hasProducedFruit },
      ];
    case 'Mature Tree':
      return [
        { key: 'time', label: 'Live 10 years', met: state.turnsInStage >= turnsForYears(10) },
        { key: 'major', label: 'Survive 3 major events', met: state.majorEventsSurvivedInStage >= 3 },
        { key: 'allies', label: 'Have 2 allies', met: state.allies >= 2 },
      ];
    default:
      return [];
  }
}

function getNextStage() {
  const current = computeCurrentLifeStage();
  return LIFE_STAGES.find(stage => stage.rank === current.rank + 1) || null;
}

function resetStageProgressCounters() {
  state.turnsInStage = 0;
  state.majorEventsSurvivedInStage = 0;
  state.growthNudgeCooldown = 3 + Math.floor(Math.random() * 2);
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
  const message = options[Math.floor(Math.random() * options.length)];
  state.growthNudgeCooldown = 3 + Math.floor(Math.random() * 2);
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


const SPECIES = {
  Plum: {
    description: 'Fast-growing plum tree with abundant blossoms and soft fruit.',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.2, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'hoverflies'],
  },
  Peach: {
    description: 'Tender peach tree with rich fruit and moderate resilience.',
    branches: 1, rootZones: 2, trunk: 1, health: 11,
    growthRate: 1.1, droughtResist: 0.4, pollinators: ['honeybees', 'bumblebees', 'butterflies'],
  },
  Apricot: {
    description: 'Early-blooming apricot tree, productive but frost-sensitive.',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.3, pollinators: ['mason bees', 'honeybees', 'beetles'],
  },
  Pear: {
    description: 'Steady pear tree with durable wood and dependable fruit.',
    branches: 1, rootZones: 2, trunk: 2, health: 12,
    growthRate: 1.0, droughtResist: 0.45, pollinators: ['hoverflies', 'honeybees', 'solitary bees'],
  },
  Citrus: {
    description: 'Glossy-leaved citrus tree with fragrant blossoms and thirsty roots.',
    branches: 1, rootZones: 2, trunk: 1, health: 11,
    growthRate: 1.05, droughtResist: 0.25, pollinators: ['honeybees', 'small native bees', 'hoverflies'],
  },
  Cherry: {
    description: 'Graceful cherry tree with showy flowers and bird-loved fruit.',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'butterflies'],
  },
};

// Updated actions - removed fruit/seeds as manual actions
const ACTIONS = [
  { key: 'growBranch', name: 'Grow Branch', help: 'Adds woody structure and supports future leaves and flowers.', cost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 1; } },
  { key: 'extendRoot', name: 'Extend Root', help: 'Expands nutrient access, storm stability, and fungal networking reach.', cost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
  { key: 'growLeaves', name: 'Grow Leaves', help: 'Increases sunlight collection and helps recover from leaf loss.', cost: { sunlight: 1, water: 1, nutrients: 1 }, effect: s => { s.leafClusters += 1; } },
  { key: 'flower', name: 'Produce Flower', help: 'Creates blossoms that can be pollinated into fruit in spring.', cost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
  { key: 'thicken', name: 'Thicken Trunk', help: 'Stores more water, improves health, and helps survive drought and storms.', cost: { sunlight: 5, water: 2, nutrients: 2 }, effect: s => { s.trunk += 1; s.health += 1; s.maxHealth += 1; } },
  { key: 'defense', name: 'Chemical Defense', help: 'Makes leaves and fruit less appealing to pests, animals, and rivals.', cost: { sunlight: 3, water: 1, nutrients: 2 }, effect: s => { s.defense += 1; s.fruitDefense += 1; } },
  { key: 'connect', name: 'Seek Root Connection', help: 'Attempt underground friendship with a chosen neighboring tree.', cost: { sunlight: 1, water: 0, nutrients: 1 }, prereq: s => s.rootZones >= 3, effect: s => attemptConnection(s) },
  { key: 'requestHelp', name: 'Request Help from Allies', help: 'Call on allied trees to send resources and resilience through the network.', cost: { sunlight: 0, water: 0, nutrients: 1 }, prereq: s => s.allies >= 1, effect: s => requestHelpFromAllies(s) },
];

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
  log: [],
  eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0 },
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
  log: document.getElementById('log'),
  feedbackContainer: document.getElementById('feedback-container'),
  tooltip: document.getElementById('tooltip'),
  actionsBanner: document.getElementById('actions-banner'),
  actionsRemaining: document.getElementById('actions-remaining'),
};

const ctx = els.canvas.getContext('2d');

// Floating feedback system
function showFeedback(message, type = 'success') {
  const feedback = document.createElement('div');
  feedback.className = `feedback ${type}`;
  feedback.textContent = message;
  els.feedbackContainer.appendChild(feedback);
  
  setTimeout(() => {
    feedback.remove();
  }, 3000);
}

// Tooltip system
function initTooltips() {
  const statRows = document.querySelectorAll('.stat-row[data-help]');
  
  statRows.forEach(row => {
    row.addEventListener('mouseenter', (e) => {
      const helpText = row.dataset.help;
      els.tooltip.textContent = helpText;
      els.tooltip.classList.remove('hidden');
      
      const rect = row.getBoundingClientRect();
      const tooltipRect = els.tooltip.getBoundingClientRect();
      
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 8;
      
      // Keep in viewport
      left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
      top = Math.max(10, top);
      
      els.tooltip.style.left = `${left}px`;
      els.tooltip.style.top = `${top}px`;
    });
    
    row.addEventListener('mouseleave', () => {
      els.tooltip.classList.add('hidden');
    });
  });
}

// Collapsible stat groups
function initCollapsibleGroups() {
  const groupTitles = document.querySelectorAll('.stat-group-title');
  
  groupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const group = title.closest('.stat-group');
      group.classList.toggle('collapsed');
    });
  });
}

function initSpeciesSelect() {
  const names = Object.keys(SPECIES);
  const chosen = names[Math.floor(Math.random() * names.length)];
  state.selectedSpecies = chosen;
  const spec = SPECIES[chosen];
  els.speciesList.innerHTML = `
    <div class="species-card selected">
      <h3>You are a ${chosen} tree.</h3>
      <p>${spec.description}</p>
    </div>`;
  els.startGame.disabled = false;
  els.startGame.textContent = 'Begin';
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
    sunlight: 3,
    water: 3,
    nutrients: 3,
    actions: 1,
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
    health: spec.health,
    maxHealth: spec.health,
    offspringPool: 0,
    defense: 0,
    fruitDefense: 0,
    offspringTrees: 0,
    pendingFruitThreat: null,
    pendingOffspringThreat: false,
    log: [],
    eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0 },
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

function currentSeason() { return SEASONS[state.seasonIndex]; }

function exposureFactor() {
  const hostileShade = state.eventModifiers.shade || 0;
  return Math.max(0.15, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - hostileShade);
}

function collectResources() {
  const season = currentSeason();
  const sunlightGain = Math.max(1, Math.floor(state.leafClusters * exposureFactor() * season.factorSun * state.eventModifiers.disease));
  const waterStorage = Math.max(1, state.trunk + Math.floor(state.rootZones / 2));
  const waterGain = Math.max(1, Math.floor(waterStorage * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));
  const nutrientGain = Math.max(1, Math.floor((state.rootZones + 0.2 * state.allies * Math.max(1, state.rootZones)) * state.eventModifiers.disease));
  state.sunlight += sunlightGain;
  state.water += waterGain;
  state.nutrients += nutrientGain;
  state.actions = 3 + Math.floor((sunlightGain + waterGain + nutrientGain) / 5);
  return { sunlightGain, waterGain, nutrientGain, waterStorage };
}

function showModal(title, body, onContinue) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.remove('hidden');
  els.modalButton.onclick = () => {
    els.modal.classList.add('hidden');
    onContinue?.();
  };
}

function showResourcePhase() {
  if (state.gameOver) return;
  const gains = collectResources();
  addLog(`Your tree awakens and gathers from the world around it...`);
  updateUI();
  render();

  const season = currentSeason();
  const exposure = Math.round(exposureFactor() * 100);

  // Themed resource phase description
  const seasonDescriptions = {
    'Spring': 'Spring rains awaken the soil. Buds swell with potential.',
    'Summer': 'The sun climbs high. Your leaves drink in the long light.',
    'Autumn': 'The air cools. Your tree prepares for the coming dormancy.',
    'Winter': 'The world sleeps. Your roots still reach for what they can find.',
  };

  showModal('Your Tree Gathers...', `
    <p style="color: var(--muted); margin-bottom: 16px; font-style: italic;">${seasonDescriptions[season.name]}</p>
    <div class="resource-summary">
      <div class="res-line">
        <span class="res-icon">☀️</span>
        <span class="res-name">Sunlight</span>
        <span class="res-value">+${gains.sunlightGain}</span>
        <span class="res-detail">${state.leafClusters} leaves × ${exposure}% exposure × ${season.factorSun} season</span>
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="res-detail">trunk ${state.trunk} + roots ${state.rootZones} support water storage</span>
      </div>
      <div class="res-line">
        <span class="res-icon">🌱</span>
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        <span class="res-detail">${state.rootZones} roots + ${state.allies} allies</span>
      </div>
      <div class="actions-earned">
        <strong>${state.actions} actions</strong> available this turn
        ${gains.sunlightGain + gains.waterGain + gains.nutrientGain >= 5 ? '<br><small>+1 bonus action from high resource yield</small>' : ''}
      </div>
    </div>
  `, () => {
    renderActions();
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
  const positions = [0, 1, 3, 4];
  return positions.map((slot, i) => {
    const species = speciesNames[Math.floor(Math.random() * speciesNames.length)];
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
    };
  });
}

function getNeighborAtSlot(idx) {
  return state.neighbors.find(n => n.slot === idx) || null;
}

function updateAlliesCount() {
  state.allies = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally').length + state.offspringTrees;
}

function growNeighbors() {
  state.neighbors.forEach(n => {
    n.stageScore += 20 + Math.floor(Math.random() * 35);
    if (getRelationshipState(n.relation).name === 'Hostile' && Math.random() < 0.25) {
      state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.08;
    }
  });
}

function chooseNeighborModal(onPick) {
  const options = state.neighbors.map((n, idx) => {
    const rel = getRelationshipState(n.relation).name.toLowerCase();
    return `<button class="neighbor-choice" data-neighbor-index="${idx}">${n.species} (${rel})</button>`;
  }).join('');
  showModal('Choose a neighboring tree', `<p>Your roots probe the soil for a possible connection.</p><div class="neighbor-choices">${options}</div>`, () => {});
  document.querySelectorAll('[data-neighbor-index]').forEach(btn => {
    btn.onclick = () => {
      els.modal.classList.add('hidden');
      onPick(state.neighbors[Number(btn.dataset.neighborIndex)]);
    };
  });
}

function relationshipFlavorChange(oldState, newState, species) {
  const key = `${oldState}->${newState}`;
  const lines = {
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

function requestHelpFromAllies(s) {
  const alliedNeighbors = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally');
  const allyStrength = alliedNeighbors.reduce((sum, n) => sum + (getNeighborStage(n.stageScore).rank + 1), 0) + state.offspringTrees;
  const heal = Math.max(1, Math.floor(Math.random() * Math.max(2, allyStrength)) + alliedNeighbors.length);
  const actualHeal = Math.max(0, Math.min(heal, state.maxHealth - state.health));
  state.health += actualHeal;
  const allyNames = alliedNeighbors.map(n => n.species).join(', ');
  const line = actualHeal > 0
    ? `Help comes through the fungal dark. ${allyNames || 'Your allies'} send strength into your roots, restoring ${actualHeal} health. They will remember the bond and expect friendship in return.`
    : `Your allies answer your call, steadying you with quiet support. You were already near full strength, but the favor is now owed.`;
  addLog(line);
  showModal('Allies Come to Your Aid', `<p>${line}</p>`, () => {
    updateScore();
    updateUI();
    render();
    renderActions();
  });
}

function attemptConnection(s) {
  chooseNeighborModal((neighbor) => {
    const rootBonus = Math.min(0.35, Math.max(0, state.rootZones - 2) * 0.08);
    const oldState = getRelationshipState(neighbor.relation).name;
    const roll = Math.random();
    let message = '';
    let feedback = { text: '', type: 'info' };

    if (oldState === 'Ally') {
      neighbor.relation = Math.min(100, neighbor.relation + 10);
      message = `Your roots find the familiar touch of the ${neighbor.species}. Resources and signals pass warmly between you.`;
      feedback = { text: `${neighbor.species} strengthens your alliance`, type: 'success' };
    } else if (oldState === 'Friendly') {
      if (roll < 0.7 + rootBonus) {
        neighbor.relation = Math.min(100, neighbor.relation + 20);
        message = `The ${neighbor.species} answers your overture with quiet warmth, opening more of its root network to you.`;
        feedback = { text: `${neighbor.species} welcomed your roots`, type: 'success' };
      } else {
        neighbor.relation = Math.max(-100, neighbor.relation - 5);
        message = `The ${neighbor.species} hesitates. It does not reject you, but keeps part of itself withheld.`;
        feedback = { text: `${neighbor.species} grew cautious`, type: 'info' };
      }
    } else if (oldState === 'Neutral') {
      if (roll < 0.35 + rootBonus) {
        neighbor.relation = Math.min(100, neighbor.relation + 20);
        message = `The ${neighbor.species} pauses, then accepts your tentative underground greeting.`;
        feedback = { text: `${neighbor.species} responded cautiously`, type: 'success' };
      } else if (roll < 0.75) {
        neighbor.relation = Math.min(100, neighbor.relation + 2);
        message = `The ${neighbor.species} senses you, but offers little in return. For now, the soil remains politely quiet.`;
        feedback = { text: `${neighbor.species} mostly ignored you`, type: 'info' };
      } else {
        neighbor.relation = Math.max(-100, neighbor.relation - 15);
        message = `The ${neighbor.species} interprets your reach as intrusion and releases a bitter pulse through the soil.`;
        state.health = Math.max(0, state.health - 1);
        recordDamage(1, 'chemicals');
        feedback = { text: `${neighbor.species} rebuffed you`, type: 'error' };
      }
    } else if (oldState === 'Rival') {
      if (roll < 0.18 + rootBonus) {
        neighbor.relation = Math.min(100, neighbor.relation + 18);
        message = `After a tense silence, the ${neighbor.species} relents. The rivalry softens, if only a little.`;
        feedback = { text: `${neighbor.species} softened`, type: 'success' };
      } else {
        neighbor.relation = Math.max(-100, neighbor.relation - 12);
        message = `The ${neighbor.species} answers with defensive chemistry, warning you that the rivalry is still alive.`;
        state.health = Math.max(0, state.health - 1);
        recordDamage(1, 'chemicals');
        state.nutrients = Math.max(0, state.nutrients - 1);
        feedback = { text: `${neighbor.species} retaliated`, type: 'error' };
      }
    } else if (oldState === 'Hostile') {
      if (roll < 0.08 + rootBonus) {
        neighbor.relation = Math.min(100, neighbor.relation + 30);
        message = `Against all expectation, the ${neighbor.species} does not strike. Its hatred cools, though distrust still lingers.`;
        feedback = { text: `${neighbor.species} cooled slightly`, type: 'success' };
      } else {
        neighbor.relation = Math.max(-100, neighbor.relation - 8);
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
    const prereqOk = action.prereq ? action.prereq(state) : true;
    const affordable = canAfford(action.cost);
    const unlocked = isActionUnlocked(action.key);
    return prereqOk && affordable && unlocked;
  });
}

function renderActions() {
  els.actionsList.innerHTML = '';

  const availableActions = [];
  const futureActions = [];

  ACTIONS.forEach(action => {
    const prereqOk = action.prereq ? action.prereq(state) : true;
    const affordable = canAfford(action.cost);
    const unlocked = isActionUnlocked(action.key);
    const currentSeasonName = currentSeason().name;
    const allowedSeasons = SEASONAL_ACTIONS[action.key];
    const seasonLocked = allowedSeasons && !allowedSeasons.includes(currentSeasonName);
    const usable = prereqOk && affordable && state.actions > 0 && !seasonLocked && unlocked;

    const sunRequired = action.cost.sunlight || 0;
    const waterRequired = action.cost.water || 0;
    const nutRequired = action.cost.nutrients || 0;
    const sunEnough = state.sunlight >= sunRequired;
    const waterEnough = state.water >= waterRequired;
    const nutEnough = state.nutrients >= nutRequired;
    const sunClass = sunEnough ? 'res-sun' : 'res-sun res-low';
    const waterClass = waterEnough ? 'res-water' : 'res-water res-low';
    const nutClass = nutEnough ? 'res-nutrient' : 'res-nutrient res-low';

    let costsHtml = '<div class="action-costs">';
    if (sunRequired > 0) costsHtml += `<span class="cost ${sunClass}">☀️${sunRequired} <span class="current">(${state.sunlight})</span></span>`;
    if (waterRequired > 0) costsHtml += `<span class="cost ${waterClass}">💧${waterRequired} <span class="current">(${state.water})</span></span>`;
    if (nutRequired > 0) costsHtml += `<span class="cost ${nutClass}">🌱${nutRequired} <span class="current">(${state.nutrients})</span></span>`;
    costsHtml += '</div>';

    if (usable) {
      availableActions.push({ action, costsHtml });
    } else {
      let reason = 'Unavailable';
      if (!unlocked) reason = `Unlocks at ${LIFE_STAGES.find(stage => stage.unlocks.includes(action.key))?.name || 'later stage'}`;
      else if (seasonLocked) reason = `Only available in ${allowedSeasons.join('/')}`;
      else if (!prereqOk) {
        if (action.key === 'connect') reason = 'Needs 3 root zones';
        else if (action.key === 'requestHelp') reason = 'Needs at least 1 ally';
        else reason = 'Prerequisites not met';
      } else if (!affordable || state.actions <= 0) reason = 'Not enough resources right now';
      futureActions.push({ action, costsHtml, reason });
    }
  });

  if (state.actions > 0 && availableActions.length === 0) {
    const warning = document.createElement('div');
    warning.className = 'nothing-affordable';
    warning.innerHTML = `<strong>⚠️ Nothing Usable</strong>No action is currently possible. The season will advance automatically.`;
    els.actionsList.appendChild(warning);
    setTimeout(() => {
      if (els.modal.classList.contains('hidden')) {
        showEventPhase();
      }
    }, 700);
  }

  availableActions.forEach(({ action, costsHtml }) => {
    const card = document.createElement('div');
    card.className = 'action-card';
    card.innerHTML = `
      <div class="action-header">
        <h4>${action.name}</h4>
      </div>
      <p class="action-help">${action.help}</p>
      ${costsHtml}`;
    const btn = document.createElement('button');
    btn.textContent = 'Use Action';
    btn.onclick = () => {
      spend(action.cost);
      action.effect(state);
      if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed') state.firstRootActionTaken = true;
      showFeedback(`${action.name} succeeded!`, 'success');
      addLog(`Action: ${action.name}`);
      updateScore();
      updateUI();
      render();
      if (action.key === 'extendRoot' && state.lifeStage.name === 'Seed' && state.firstRootActionTaken) {
        if (tryAdvanceLifeStage(() => { resumeTurnFlow(); })) return;
      }
      if (maybeTriggerActionMilestone(action.key)) return;
      if (tryAdvanceLifeStage(() => { resumeTurnFlow(); })) return;
      renderActions();
      if (state.actions <= 0) { showEventPhase(); return; }
    };
    card.appendChild(btn);
    els.actionsList.appendChild(card);
  });

  if (futureActions.length > 0) {
    const details = document.createElement('details');
    details.className = 'future-actions';
    details.innerHTML = `<summary>Future Growth (${futureActions.length})</summary>`;
    const wrap = document.createElement('div');
    wrap.className = 'future-actions-list';
    futureActions.forEach(({ action, costsHtml, reason }) => {
      const card = document.createElement('div');
      card.className = 'action-card disabled';
      card.innerHTML = `
        <div class="action-header">
          <h4>${action.name}</h4>
          <span class="prereq-missing">Locked</span>
        </div>
        <p class="action-help">${action.help}</p>
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  }

  if (state.actions > 0 && availableActions.length > 0) {
    const endBtn = document.createElement('button');
    endBtn.className = 'finish-turn-btn';
    endBtn.textContent = 'Finish Turn Early →';
    endBtn.onclick = () => {
      showFeedback('Turn ended early', 'info');
      showEventPhase();
    };
    els.actionsList.appendChild(endBtn);
  }
}
// Expanded event pool with real botany/ecology inspiration
const MAJOR_EVENTS = [
  {
    key: 'Drought',
    name: 'Drought',
    icon: '☀️',
    desc: 'The soil dries and cracks. Your roots must reach deeper for moisture.',
    severity: 'bad',
    apply: (s) => {
      s.eventModifiers.drought = Math.max(0.15, 0.55 - (s.trunk * 0.08));
      const thirst = Math.max(1, 3 - s.trunk);
      s.health -= thirst;
      recordDamage(thirst, 'drought');
      return [`Water collection reduced sharply`, `Health -${thirst} from thirst and water stress`];
    }
  },
  {
    key: 'InsectSwarm',
    name: 'Insect Swarm',
    icon: '🐛',
    desc: 'A wave of herbivores descends on the canopy, hungry for tender leaves.',
    severity: 'bad',
    apply: (s) => {
      const damage = Math.max(1, 2 - s.defense);
      const prevLeaves = s.leafClusters;
      s.leafClusters = Math.max(1, s.leafClusters - damage);
      s.health -= 1;
      const lost = prevLeaves - s.leafClusters;
      return [`${lost} leaf cluster${lost !== 1 ? 's' : ''} eaten by insects`, 'Health -1 from stress', s.defense > 0 ? 'Chemical defense reduced damage' : 'No chemical defense!'];
    }
  },
  {
    key: 'Storm',
    name: 'Autumn Storm',
    icon: '⛈️',
    desc: 'Fierce winds test your structure. Flexibility and strength determine survival.',
    severity: 'bad',
    apply: (s) => {
      const prevBranches = s.branches;
      s.branches = Math.max(1, s.branches - 1);
      const damage = Math.max(0, 3 - s.trunk - Math.floor(s.rootZones / 2));
      s.health -= damage;
      recordDamage(damage, 'storm');
      const lost = prevBranches - s.branches;
      const effects = [`${lost} branch snapped by wind`];
      if (damage > 0) effects.push(`Health -${damage} (roots and trunk were not strong enough)`);
      else effects.push('Deep roots and a strong trunk resisted damage');
      return effects;
    }
  },
  {
    key: 'Fire',
    name: 'Wildfire',
    icon: '🔥',
    desc: 'Flames sweep through the understory. Thick bark and fire adaptation are your only hope.',
    severity: 'critical',
    apply: (s) => {
      const barkProtection = Math.min(2, Math.floor(s.trunk / 2));
      const damage = Math.max(1, 4 - barkProtection);
      s.health -= damage;
      recordDamage(damage, 'storm');
      const effects = [];
      recordDamage(damage, 'fire');
      if (damage === 0) {
        effects.push('Thick bark completely protected you!');
      } else {
        effects.push(`Health -${damage} from fire damage`);
      }
      if (barkProtection > 0) {
        effects.push('Thicker trunk reduced some fire damage');
      }
      return effects;
    }
  },
  {
    key: 'LateFrost',
    name: 'Late Frost',
    icon: '❄️',
    desc: 'An unexpected freeze damages new growth and tender flowers.',
    severity: 'bad',
    apply: (s) => {
      const effects = [];
      if (s.flowers > 0) {
        const lost = Math.min(s.flowers, 1);
        s.flowers -= lost;
        effects.push(`${lost} flower${lost !== 1 ? 's' : ''} killed by frost`);
      }
      if (s.leafClusters > 3) {
        s.leafClusters -= 1;
        effects.push('1 leaf cluster damaged by frost');
      }
      s.health -= 1;
      recordDamage(1, 'frost');
      effects.push('Health -1 from cold stress');
      return effects;
    }
  },
  {
    key: 'FungalBlight',
    name: 'Fungal Blight',
    icon: '🍄',
    desc: 'A pathogen spreads through the fungal network, affecting connected trees.',
    severity: 'bad',
    apply: (s) => {
      s.eventModifiers.disease = 0.6;
      const effects = ['Resource collection reduced by 40%', 'Fungal allies may be affected'];
      if (s.allies > 0) {
        s.allies = Math.max(0, s.allies - 1);
        effects.push('Lost 1 ally to the blight');
      }
      return effects;
    }
  },
  {
    key: 'Beaver',
    name: 'Beaver Activity',
    icon: '🦫',
    desc: 'A beaver colony has moved into the watershed, changing water patterns.',
    severity: 'neutral',
    apply: (s) => {
      const effects = [];
      if (Math.random() < 0.5) {
        s.water += 3;
        effects.push('Dam raised water table: +3 water');
      } else {
        s.water = Math.max(0, s.water - 2);
        effects.push('Dam diverted water: -2 water');
      }
      return effects;
    }
  },
  {
    key: 'MycorrhizalBloom',
    name: 'Mycorrhizal Bloom',
    icon: '✨',
    desc: 'The fungal network flourishes, sharing nutrients generously.',
    severity: 'good',
    apply: (s) => {
      s.nutrients += 3;
      if (s.allies > 0) {
        s.nutrients += s.allies;
        return [`+${3 + s.allies} nutrients from fungal bloom`, 'Allies boosted the bonus!'];
      }
      return ['+3 nutrients from fungal bloom'];
    }
  },
  {
    key: 'BirdDispersal',
    name: 'Bird Dispersal',
    icon: '🐦',
    desc: 'Migratory birds arrive, carrying seeds and nutrients from distant forests.',
    severity: 'good',
    apply: (s) => {
      s.nutrients += 2;
      if (s.flowers > 0) {
        const pollinated = Math.min(s.flowers, Math.floor(Math.random() * 2) + 1);
        s.pollinated += pollinated;
        s.flowers -= pollinated;
        return [`+2 nutrients from bird droppings`, `${pollinated} flower${pollinated !== 1 ? 's' : ''} pollinated by visiting birds`];
      }
      return ['+2 nutrients from bird droppings'];
    }
  },
];

function resolveFruitThreats(events) {
  if (!state.pendingFruitThreat) return;

  const threat = state.pendingFruitThreat;
  const defensePower = state.defense + state.fruitDefense;
  let losses = 0;
  let saved = 0;

  for (let i = 0; i < state.developing; i++) {
    let lossChance = threat.baseLoss;
    if (threat.type === 'human') lossChance -= 0.12 * defensePower;
    if (threat.type === 'bird') lossChance -= 0.08 * defensePower;
    if (threat.type === 'chewer') lossChance -= 0.1 * defensePower;
    lossChance = Math.max(0.05, Math.min(0.95, lossChance));
    if (Math.random() < lossChance) losses += 1;
    else saved += 1;
  }

  state.developing = Math.max(0, state.developing - losses);
  if (losses > 0) {
    events.push({ text: threat.outcome(losses, saved, defensePower > 0), effect: 'fruit-loss' });
  } else {
    events.push({ text: threat.safeText, effect: 'fruit-safe' });
  }

  state.pendingFruitThreat = null;
  state.fruitDefense = Math.max(0, state.fruitDefense - 1);
}

function processSeasonalReproduction(events) {
  const season = currentSeason().name;

  if (season === 'Summer' && state.pollinated > 0) {
    const ripened = state.pollinated;
    state.developing += ripened;
    state.pollinated = 0;
    if (ripened > 0) state.hasProducedFruit = true;
    events.push({ text: `${ripened} pollinated flower${ripened !== 1 ? 's' : ''} swelled into fruit in the summer sun. (+${ripened} fruit)`, effect: 'growth' });
  }

  if (season === 'Summer' && state.developing > 0 && !state.pendingFruitThreat && Math.random() < 0.45) {
    const threats = [
      {
        type: 'human',
        warning: 'Lots of human activity stirs beneath your branches. They are eyeing your sweet fruits.',
        baseLoss: 0.45,
        outcome: (losses, saved, defended) => defended
          ? `Your bitter chemistry saved some fruit, but humans still took ${losses}. ${saved} remained.`
          : `Humans harvested ${losses} ripe fruit${losses !== 1 ? 's' : ''} from your branches.`,
        safeText: 'Your fruits ripened untouched despite the curious humans.'
      },
      {
        type: 'bird',
        warning: 'Bright birds gather near your canopy, watching the ripening fruit.',
        baseLoss: 0.35,
        outcome: (losses, saved, defended) => defended
          ? `Your defenses discouraged the birds from many fruits. ${losses} were lost, ${saved} survived.`
          : `Birds pecked through ${losses} fruit${losses !== 1 ? 's' : ''} before autumn.`,
        safeText: 'Most birds lost interest before doing any serious damage.'
      },
      {
        type: 'chewer',
        warning: 'Gnawing animals are scouting your branches for easy meals.',
        baseLoss: 0.4,
        outcome: (losses, saved, defended) => defended
          ? `Your bitter compounds protected part of the crop. ${losses} fruit lost, ${saved} saved.`
          : `${losses} fruit${losses !== 1 ? 's' : ''} were chewed apart before the seeds matured.`,
        safeText: 'The animals passed by without ruining your fruits.'
      },
    ];
    state.pendingFruitThreat = threats[Math.floor(Math.random() * threats.length)];
    events.push({ text: `${state.pendingFruitThreat.warning} You could invest in Chemical Defense before the danger peaks.`, effect: 'warning' });
  }

  if (season === 'Summer' && state.pendingFruitThreat) {
    resolveFruitThreats(events);
  }

  if (season === 'Autumn' && state.developing > 0) {
    const matured = state.developing;
    state.seeds += matured;
    state.developing = 0;
    events.push({ text: `${matured} surviving fruit${matured !== 1 ? 's' : ''} hardened into ${matured} seed${matured !== 1 ? 's' : ''}. (+${matured} seed${matured !== 1 ? 's' : ''})`, effect: 'growth' });
  }
}

function resolveSeedFate(seedCount) {
  const results = [];
  let sprouted = 0;

  for (let i = 0; i < seedCount; i++) {
    const r = Math.random();
    if (r < 0.22) results.push('A seed was eaten outright before it could travel.');
    else if (r < 0.42) results.push('A seed landed in deep shade and failed to establish.');
    else if (r < 0.62) results.push('A bird carried one of your seeds away, but dropped it on poor ground.');
    else if (r < 0.82) {
      sprouted += 1;
      results.push('A seed reached promising soil and sprouted into offspring.');
    } else {
      sprouted += 1;
      results.push('An animal carried a seed to open ground, where it sprouted successfully.');
    }
  }

  return { sprouted, results };
}

function rollMajorEvent() {
  const weights = MAJOR_EVENTS.map(e => {
    if (e.severity === 'critical') return 0.05;
    if (e.severity === 'bad') return 0.25;
    if (e.severity === 'neutral') return 0.2;
    return 0.15; // good
  });
  
  const total = weights.reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let sum = 0;
  for (let i = 0; i < MAJOR_EVENTS.length; i++) {
    sum += weights[i];
    if (r <= sum) return MAJOR_EVENTS[i];
  }
  return MAJOR_EVENTS[0];
}

function rollMinorEvents() {
  const events = [];
  
  // Pollination chance based on flowers and season
  if (state.flowers > 0) {
    const pollinatorChance = currentSeason().name === 'Spring' ? 0.55 : 
                            currentSeason().name === 'Summer' ? 0.4 : 0.1;
    if (Math.random() < pollinatorChance) {
      const pollinated = Math.min(state.flowers, Math.floor(Math.random() * 2) + 1);
      state.pollinated += pollinated;
      state.flowers -= pollinated;
      events.push({
        text: `${SPECIES[state.selectedSpecies].pollinators[Math.floor(Math.random() * SPECIES[state.selectedSpecies].pollinators.length)]} visited! ${pollinated} flower${pollinated !== 1 ? 's' : ''} were successfully pollinated. (+${pollinated} flowers pollinated)`,
        effect: 'pollinated'
      });
    }
  }

  processSeasonalReproduction(events);
  
  if (Math.random() < 0.25) {
    state.nutrients += 1;
    events.push({ text: 'Forest animals left nitrogen-rich gifts near your trunk. (+1 nutrient)', effect: 'nutrients' });
  }
  
  if (Math.random() < 0.25) {
    state.water += 2;
    state.eventModifiers.rainChain += 1;
    events.push({ text: 'A passing rain shower refreshed the soil. (+2 water)', effect: 'rain' });
    if (state.eventModifiers.rainChain >= 3) {
      state.health -= 1;
      recordDamage(1, 'blight');
      events.push({ text: 'Too much rain caused mild root rot. (-1 health)', effect: 'damage' });
    }
  } else {
    state.eventModifiers.rainChain = 0;
  }

  if (Math.random() < 0.15 && state.branches > 1 && state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank) {
    state.branches -= 1;
    events.push({ text: 'A sharp wind snapped a tender branch. (-1 branch)', effect: 'damage' });
  }

  const alliedNeighbors = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally');
  const hostileNeighbors = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Hostile');

  if (alliedNeighbors.length > 0 && Math.random() < 0.14) {
    const target = alliedNeighbors[Math.floor(Math.random() * alliedNeighbors.length)];
    events.push({ text: `Your ally the ${target.species} is struggling with seasonal stress. A future version should let you spend resources to help directly.`, effect: 'warning' });
  }
  if (hostileNeighbors.length > 0 && Math.random() < 0.14) {
    const target = hostileNeighbors[Math.floor(Math.random() * hostileNeighbors.length)];
    state.eventModifiers.shade = (state.eventModifiers.shade || 0) + 0.12;
    events.push({ text: `The hostile ${target.species} is crowding your light and worsening the shade around you.`, effect: 'warning' });
  }

  if (state.offspringTrees > 0 && !state.pendingOffspringThreat && Math.random() < 0.18) {
    state.pendingOffspringThreat = true;
    events.push({ text: 'Your young offspring is under aphid pressure. Chemical Defense this turn may save it.', effect: 'warning' });
  } else if (state.pendingOffspringThreat) {
    state.pendingOffspringThreat = false;
    if (state.defense > 0 || state.fruitDefense > 0) {
      events.push({ text: 'You shielded your offspring with defensive chemistry. It survives the aphid attack. (+offspring survives)', effect: 'offspring-safe' });
    } else if (Math.random() < 0.5) {
      state.offspringTrees = Math.max(0, state.offspringTrees - 1);
      state.offspringPool = Math.max(0, state.offspringPool - 1);
      events.push({ text: 'A young offspring succumbed to aphids before it could establish itself. (-1 offspring)', effect: 'offspring-loss' });
    } else {
      events.push({ text: 'Your offspring weathered the aphids on its own, but only barely. (+offspring survives)', effect: 'offspring-safe' });
    }
  }
  
  return events;
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
  // Reset modifiers
  state.eventModifiers.drought = 1;
  state.eventModifiers.disease = 1;
  state.eventModifiers.shade = Math.max(0, (state.eventModifiers.shade || 0) * 0.7);
  
  const consequences = [];
  
  if (major) {
    const majorEffects = major.apply(state);
    consequences.push(...majorEffects);
    if (state.health > 0) state.majorEventsSurvivedInStage += 1;
  }
  
  minors.forEach(event => {
    if (event.effect === 'pollinated') {
      state.score += 5;
    }
  });
  
  state.health = Math.min(state.maxHealth, Math.max(0, state.health));
  
  return consequences;
}

function showEventPhase() {
  const major = state.turnInSeason === 3 ? rollMajorEvent() : null;
  const minors = rollMinorEvents();
  const consequences = applyEventEffects(major, minors);
  updateScore();
  updateUI();
  render();

  let majorHtml = '';
  if (major) {
    const majorClass = major.severity === 'critical' ? 'event-critical' : 
                       major.severity === 'bad' ? 'event-bad' : 
                       major.severity === 'neutral' ? 'event-neutral' : 'event-good';
    
    majorHtml = `
      <div class="event-major ${majorClass}">
        <div class="event-icon">${major.icon}</div>
        <div class="event-content">
          <h3>${major.name}</h3>
          <p>${major.desc}</p>
          ${consequences.length ? `
            <div class="event-consequences">
              <strong>Effects:</strong>
              <ul>${consequences.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    majorHtml = `
      <div class="event-major event-good">
        <div class="event-icon">🌙</div>
        <div class="event-content">
          <h3>Quiet Night</h3>
          <p>The forest is still. Your tree rests.</p>
        </div>
      </div>
    `;
  }

  const minorHtml = minors.length
    ? `<div class="minor-events"><h4>Forest Whispers</h4><ul>${minors.map(e => `<li>${e.text}</li>`).join('')}</ul></div>`
    : '<p class="no-events">The forest sleeps quietly this turn.</p>';

  showModal('Night Falls...', `
    ${majorHtml}
    ${minorHtml}
  `, () => {
    if (maybeShowHealthWarning(advanceTurn)) return;
    advanceTurn();
  });
}

function handleSpringViability(onContinue) {
  if (state.seeds <= 0) return false;
  const prevSeeds = state.seeds;
  const fate = resolveSeedFate(state.seeds);
  state.viableSeeds += fate.sprouted;
  state.offspringPool += fate.sprouted;
  state.offspringTrees += fate.sprouted;
  state.seeds = 0;
  addLog(`${fate.sprouted} of ${prevSeeds} seeds successfully established this spring.`);
  if (fate.sprouted > 0) {
    showFeedback(`${fate.sprouted} offspring sprouted!`, 'success');
  }
  showModal('Spring Seed Fate', `
    <p>${prevSeeds} seed${prevSeeds !== 1 ? 's' : ''} faced the hazards of dispersal and germination.</p>
    <ul>${fate.results.map(r => `<li>${r}</li>`).join('')}</ul>
    <p><strong>${fate.sprouted}</strong> offspring successfully sprouted.</p>
  `, () => onContinue?.());
  return true;
}

function advanceTurn() {
  if (state.health <= 0) return handleDeath();

  state.turnsInStage += 1;
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
    if (currentSeason().name === 'Spring') {
      updateScore();
      updateUI();
      render();
      if (handleSpringViability(() => {
        updateScore();
        updateUI();
        render();
        updateAlliesCount();
        if (tryAdvanceLifeStage(() => { resumeTurnFlow(); })) return;
        if (maybeShowGrowthNudge()) return;
        showResourcePhase();
      })) return;
    }
  }
  growNeighbors();
  updateAlliesCount();
  updateScore();
  updateUI();
  render();
  if (tryAdvanceLifeStage(() => { updateScore(); updateUI(); render(); showResourcePhase(); })) return;
  if (maybeShowGrowthNudge()) return;
  showResourcePhase();
}

function handleDeath() {
  if (state.offspringPool > 0) {
    state.offspringPool -= 1;
    state.health = Math.max(6, Math.floor(state.maxHealth * 0.7));
    state.maxHealth = state.health;
    state.branches = Math.max(1, Math.floor(state.branches * 0.6));
    state.rootZones = Math.max(1, Math.floor(state.rootZones * 0.6));
    state.leafClusters = Math.max(1, Math.floor(state.leafClusters * 0.6));
    state.trunk = Math.max(1, Math.floor(state.trunk * 0.6));
    state.flowers = 0;
    state.pollinated = 0;
    state.developing = 0;
    addLog('Your current tree died, but a viable offspring continues the lineage.');
    showFeedback('Your tree died, but offspring continues...', 'warning');
    showModal('Succession', '<p>Your tree has died, but one offspring survives. You continue through the lineage.</p>', () => {
      updateScore(); updateUI(); render(); showResourcePhase();
    });
  } else {
    state.gameOver = true;
    const flavor = deathFlavor(state.lastDamageCause);
    showModal('Game Over', `<p><em>${flavor}</em></p><p>Your lineage has ended.</p><p>Final score: <strong>${state.score}</strong></p>`, () => {});
  }
}

function updateScore() {
  state.score = (state.year * 10) + (state.branches + state.rootZones + state.trunk) + (state.viableSeeds * 50) + (state.allies * 20);

  if (state.lifeStage.name === 'Ancient' && !state.victoryAchieved) {
    state.victoryAchieved = true;
    showModal('Victory!', `
      <h2>🌳 You have become Ancient! 🌳</h2>
      <p>Your roots run deep. Your canopy towers above the forest.</p>
      <p>You have successfully established yourself in the ecosystem.</p>
      <p><em>Your offspring will flourish here and provide shade for generations to come.</em></p>
      <p>Final Score: <strong>${state.score}</strong></p>
      <p><small>Continue playing to see how long your lineage lasts...</small></p>
    `, () => {});
  }
}

function updateUI() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('year').textContent = state.year;
  document.getElementById('season').textContent = currentSeason().name;
  
  // Update life stage display
  const stageEl = document.getElementById('life-stage');
  if (stageEl) {
    const currentStage = computeCurrentLifeStage();
    stageEl.textContent = currentStage.name;
    stageEl.style.color = currentStage.name === 'Ancient' ? '#FFD700' : '#4CAF50';
  }

  const growthHint = document.getElementById('growth-hint');
  if (growthHint) {
    const reqs = currentStageRequirements();
    const missing = reqs.filter(r => !r.met);
    if (!reqs.length || state.lifeStage.name === 'Ancient') {
      growthHint.textContent = 'Fully grown.';
    } else if (missing.length === 0) {
      growthHint.textContent = 'Growth is imminent.';
    } else {
      growthHint.textContent = `Next growth: ${missing.map(r => r.label).join(' · ')}`;
    }
  }
  document.getElementById('sunlight').textContent = state.sunlight;
  document.getElementById('water').textContent = state.water;
  document.getElementById('nutrients').textContent = state.nutrients;
  document.getElementById('leaf-clusters').textContent = state.leafClusters;
  document.getElementById('root-zones').textContent = state.rootZones;
  document.getElementById('branches').textContent = state.branches;
  document.getElementById('trunk').textContent = state.trunk;
  document.getElementById('flowers').textContent = state.flowers;
  document.getElementById('pollinated').textContent = state.pollinated;
  document.getElementById('developing').textContent = state.developing;
  document.getElementById('seeds').textContent = state.seeds;
  document.getElementById('allies').textContent = state.allies;
  document.getElementById('health').textContent = state.health;
  document.getElementById('max-health').textContent = `/ ${state.maxHealth}`;
  
  // Update actions banner
  if (els.actionsRemaining) {
    const affordableActions = getAffordableActions();
    if (state.actions > 0 && affordableActions.length > 0) {
      els.actionsRemaining.textContent = `${state.actions} action${state.actions !== 1 ? 's' : ''} remaining`;
      els.actionsBanner.classList.remove('no-actions');
    } else {
      els.actionsRemaining.textContent = state.actions > 0 ? 'No usable actions' : 'No actions remaining';
      els.actionsBanner.classList.add('no-actions');
    }
  }
  
  els.log.innerHTML = state.log.map(line => `<div class="log-entry">${line}</div>`).join('');

  const phasePill = document.getElementById('phase-indicator');
  if (phasePill) {
    phasePill.textContent = state.actions > 0 ? 'Action Phase' : 'Event Phase';
    phasePill.className = 'phase-pill ' + (state.actions > 0 ? 'phase-action' : 'phase-event');
  }

  const speciesBadge = document.getElementById('species-badge');
  if (speciesBadge && state.selectedSpecies) {
    const spec = SPECIES[state.selectedSpecies];
    const icons = { Plum: '🍑', Peach: '🍑', Apricot: '🍊', Pear: '🍐', Citrus: '🍋', Cherry: '🍒' };
    speciesBadge.textContent = `${icons[state.selectedSpecies] || '🌳'} ${state.selectedSpecies} — ${spec.description}`;
  }
}

function addLog(message) {
  state.log.unshift(`[Y${state.year} ${currentSeason().name} T${state.turnInSeason}] ${message}`);
  state.log = state.log.slice(0, 18);
}

function gradientBackground() {
  const season = currentSeason();
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, season.top);
  gradient.addColorStop(1, season.bottom);
  return gradient;
}

function render() {
  const w = els.canvas.width;
  const h = els.canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = gradientBackground();
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = '#4a3b2f';
  ctx.fillRect(0, h / 2, w, h / 2);
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  const positions = [120, 260, 450, 640, 780];
  positions.forEach((x, idx) => {
    const isPlayer = idx === 2;
    const neighbor = isPlayer ? null : getNeighborTree(idx);
    drawTree(x, h / 2, isPlayer, neighbor);
  });

  drawFungalNetwork(positions, h / 2);
}

function drawFungalNetwork(positions, groundY) {
  if (state.allies <= 0) return;

  const playerX = positions[2];
  const connectedIndices = [];

  if (state.allies >= 1) connectedIndices.push(0);
  if (state.allies >= 2) connectedIndices.push(1);
  if (state.allies >= 3) connectedIndices.push(3);
  if (state.allies >= 4) connectedIndices.push(4);

  ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  connectedIndices.forEach(idx => {
    const targetX = positions[idx];
    const startY = groundY + 30;
    const endY = groundY + 70 + (idx * 5);

    ctx.beginPath();
    ctx.moveTo(playerX, startY);
    ctx.bezierCurveTo(
      playerX - (playerX - targetX) * 0.3, startY + 40,
      targetX + (playerX - targetX) * 0.3, endY - 20,
      targetX, endY
    );
    ctx.stroke();

    ctx.fillStyle = 'rgba(180, 220, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(targetX, endY, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.setLineDash([]);
}

function drawTree(x, groundY, isPlayer, neighbor) {
  const stageName = isPlayer ? computeCurrentLifeStage().name : (neighbor?.stageName || 'Sapling');
  const stageScaleMap = { Seed: 0.18, Sprout: 0.28, Seedling: 0.45, Sapling: 0.7, 'Small Tree': 1.0, 'Mature Tree': 1.35, Ancient: 1.7 };
  const baseScale = stageScaleMap[stageName] || 0.8;
  const scale = isPlayer ? Math.max(baseScale, baseScale + state.trunk * 0.05) : baseScale;
  const leafClusters = isPlayer ? state.leafClusters : (neighbor ? neighbor.branches : 2);
  const trunk = isPlayer ? state.trunk : (neighbor ? neighbor.trunk : 1);
  const branches = isPlayer ? state.branches : (neighbor ? neighbor.branches : 2);
  const rootZones = isPlayer ? state.rootZones : (neighbor ? neighbor.roots : 2);

  const canopyR = (14 + Math.max(0, leafClusters) * 2) * scale;
  const treeColor = isPlayer ? '#2f8f46' : (neighbor && neighbor.ally ? '#2a2a2a' : '#151515');
  const rootColor = isPlayer ? '#256f39' : '#222';

  for (let i = 0; i < Math.max(1, Math.min(rootZones, 8)); i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + dir * (10 + i * 8) * scale, groundY + (14 + i * 10) * scale);
    ctx.strokeStyle = rootColor;
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.stroke();
  }

  ctx.fillStyle = treeColor;
  if (stageName === 'Seed') {
    ctx.beginPath();
    ctx.ellipse(x, groundY - 4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (stageName === 'Sprout') {
    const trunkH = 14;
    const trunkW = 6;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    ctx.strokeStyle = treeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, groundY - trunkH);
    ctx.quadraticCurveTo(x - 8, groundY - trunkH - 10, x - 14, groundY - trunkH - 6);
    ctx.moveTo(x, groundY - trunkH);
    ctx.quadraticCurveTo(x + 8, groundY - trunkH - 10, x + 14, groundY - trunkH - 6);
    ctx.stroke();
  } else if (stageName === 'Seedling') {
    const trunkH = 28;
    const trunkW = 7;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    ctx.beginPath();
    ctx.ellipse(x, groundY - trunkH - 6, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const trunkH = (48 + trunk * 14) * scale;
    const trunkW = (10 + trunk * 3) * scale;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    for (let i = 0; i < Math.max(1, Math.min(branches, 8)); i++) {
      const y = groundY - trunkH + 18 + i * 8 * scale;
      const dir = i % 2 === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * (18 + i * 5) * scale, y - (8 + i * 3) * scale);
      ctx.strokeStyle = treeColor;
      ctx.lineWidth = Math.max(2, 2.5 * scale);
      ctx.stroke();
    }
    if (leafClusters > 0) {
      ctx.beginPath();
      ctx.ellipse(x, groundY - trunkH - canopyR * 0.25, canopyR, canopyR * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isPlayer && state.flowers > 0 && stageName !== 'Seed' && stageName !== 'Sprout') {
    ctx.fillStyle = '#ffb6c1';
    for (let i = 0; i < Math.min(state.flowers, 5); i++) {
      const fx = x + (i - 2) * 8;
      const fy = groundY - trunkH - canopyR * 0.3 - 10;
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!isPlayer && neighbor) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const label = neighbor.offspring ? `${neighbor.species} offspring (${neighbor.stageName})` : `${neighbor.species} (${(neighbor.relationName || (neighbor.ally ? 'Ally' : 'Neutral')).toLowerCase()})`;
    ctx.fillText(label, x, groundY + 110);
  }
}

els.startGame.addEventListener('click', startGame);
initSpeciesSelect();
render();
