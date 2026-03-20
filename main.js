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
  { name: 'Sprout', rank: 1, threshold: 100, unlocks: ['growLeaves'], damageMult: 1.5, popup: 'Your shell cracks. You push outward into the unknown.' },
  { name: 'Seedling', rank: 2, threshold: 300, unlocks: ['defense', 'connect', 'requestHelp'], damageMult: 1.5, popup: 'Your taproot finds rich soil. You feel sturdy.' },
  { name: 'Sapling', rank: 3, threshold: 600, unlocks: ['growBranch', 'taproot', 'canopy', 'aidAlly'], damageMult: 1.2, popup: 'Your woody fibers harden. You have become a Sapling!' },
  { name: 'Small Tree', rank: 4, threshold: 1000, unlocks: ['flower', 'bark', 'shadeRival', 'rhizosphere'], damageMult: 1, popup: 'You yearn skyward. Your canopy reaches for the light.' },
  { name: 'Mature Tree', rank: 5, threshold: 2000, unlocks: ['thicken', 'massFlower', 'nurtureOffspring', 'shelterGrove'], damageMult: 0.8, popup: 'Fruits of your own hang heavy. The cycle turns.' },
  { name: 'Ancient', rank: 6, threshold: 5000, unlocks: ['victory', 'rootDominion', 'mastYear'], damageMult: 0.5, popup: 'Lightning scar and fire ash — you endure. Ancient patience fills you.' },
];

const STAGE_BY_NAME = Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, stage]));

// Seasonal action locks
const SEASONAL_ACTIONS = {
  flower: ['Spring'],
  massFlower: ['Spring'],
  mastYear: ['Spring'],
};

const LEADERBOARD_KEY = 'trees-grove-records-v1';

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
        { key: 'time', label: 'Live through 1 season', met: state.turnsInStage >= 3 },
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
        { key: 'time', label: 'Live 2 years', met: state.turnsInStage >= turnsForYears(2) },
        { key: 'branches', label: 'Grow 2 branches', met: state.branches >= 2 },
      ];
    case 'Small Tree':
      return [
        { key: 'time', label: 'Live 3 years', met: state.turnsInStage >= turnsForYears(3) },
        { key: 'fruit', label: 'Produce your first fruit', met: state.hasProducedFruit },
      ];
    case 'Mature Tree':
      return [
        { key: 'time', label: 'Live 3 years', met: state.turnsInStage >= turnsForYears(3) },
        { key: 'major', label: 'Survive 2 major events', met: state.majorEventsSurvivedInStage >= 2 },
        { key: 'allies', label: 'Have 1 ally', met: state.allies >= 1 },
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
  const message = options[Math.floor(Math.random() * options.length)];
  
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


const SPECIES = {
  Plum: {
    icon: '🟣',
    description: 'Fast-growing plum tree with abundant blossoms and soft fruit.',
    bonusTitle: 'Fast growth',
    bonusText: '+20% stage progress',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.2, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'hoverflies'],
  },
  Peach: {
    icon: '🍑',
    description: 'Tender peach tree with rich fruit and moderate resilience.',
    bonusTitle: 'Resilient',
    bonusText: '+1 starting max health',
    branches: 1, rootZones: 2, trunk: 1, health: 11,
    growthRate: 1.1, droughtResist: 0.4, pollinators: ['honeybees', 'bumblebees', 'butterflies'],
  },
  Apricot: {
    icon: '🟠',
    description: 'Early-blooming apricot tree, productive but frost-sensitive.',
    bonusTitle: 'Early bloomer',
    bonusText: 'Flowering actions cost -1 sunlight',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.3, pollinators: ['mason bees', 'honeybees', 'beetles'],
  },
  Pear: {
    icon: '🍐',
    description: 'Steady pear tree with durable wood and dependable fruit.',
    bonusTitle: 'Durable wood',
    bonusText: 'Starts with +1 trunk',
    branches: 1, rootZones: 2, trunk: 2, health: 12,
    growthRate: 1.0, droughtResist: 0.45, pollinators: ['hoverflies', 'honeybees', 'solitary bees'],
  },
  Citrus: {
    icon: '🍋',
    description: 'Glossy-leaved citrus tree with fragrant blossoms and thirsty roots.',
    bonusTitle: 'Fragrant',
    bonusText: '2× pollinator attraction',
    branches: 1, rootZones: 2, trunk: 1, health: 11,
    growthRate: 1.05, droughtResist: 0.25, pollinators: ['honeybees', 'small native bees', 'hoverflies'],
  },
  Cherry: {
    icon: '🍒',
    description: 'Graceful cherry tree with showy flowers and bird-loved fruit.',
    bonusTitle: 'Alluring',
    bonusText: '+25% positive relationship gain',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.15, droughtResist: 0.35, pollinators: ['bumblebees', 'mason bees', 'butterflies'],
  },
};

function getCurrentSpeciesSpec() {
  return SPECIES[state.selectedSpecies] || null;
}

function getStageProgressIncrement() {
  const growthRate = getCurrentSpeciesSpec()?.growthRate || 1;
  const baseIncrement = state.year >= 15 ? 1.5 : 1;
  return baseIncrement * growthRate;
}

function getSpeciesAdjustedCost(actionKey, baseCost) {
  const stage = computeCurrentLifeStage();
  const multiplier = Math.max(1, stage.rank);
  const cost = {
    sunlight: Math.floor((baseCost.sunlight || 0) * multiplier),
    water: Math.floor((baseCost.water || 0) * multiplier),
    nutrients: Math.floor((baseCost.nutrients || 0) * multiplier),
  };

  if (state.selectedSpecies === 'Apricot' && ['flower', 'massFlower', 'mastYear'].includes(actionKey)) {
    cost.sunlight = Math.max(0, cost.sunlight - 1);
  }

  return cost;
}

function applyRelationshipDelta(neighbor, delta) {
  const adjustedDelta = delta > 0 && state.selectedSpecies === 'Cherry'
    ? Math.max(1, Math.ceil(delta * 1.25))
    : delta;
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjustedDelta));
  return adjustedDelta;
}

function getPollinatorChance(baseChance) {
  const multiplier = state.selectedSpecies === 'Citrus' ? 2 : 1;
  return Math.min(0.95, baseChance * multiplier);
}

function getDroughtResistance() {
  return getCurrentSpeciesSpec()?.droughtResist || 0;
}

// Cost scaling: base costs multiply by stage rank (Sapling=×2, Small Tree=×3, etc.)
function getScaledCost(baseCost, actionKey = null) {
  return getSpeciesAdjustedCost(actionKey, baseCost);
}

// Updated actions with categories, icons, and base costs (scaled by stage)
const ACTIONS = [
  // GROWTH - Basic structural growth
  { key: 'growBranch', name: 'Grow Branch', icon: '🌿', category: 'growth', help: 'Adds woody structure and supports future leaves and flowers.', baseCost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 1; } },
  { key: 'extendRoot', name: 'Extend Root', icon: '🥕', category: 'growth', help: 'Expands nutrient access, storm stability, and fungal networking reach.', baseCost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
  { key: 'growLeaves', name: 'Grow Leaves', icon: '🍃', category: 'growth', help: 'Increases sunlight collection.', baseCost: { sunlight: 1, water: 1, nutrients: 1 }, hideAt: 'Small Tree', effect: s => { s.leafClusters += 1; } },
  { key: 'thicken', name: 'Thicken Trunk', icon: '🪵', category: 'growth', help: 'Stores more water, improves health, and helps survive drought and storms.', baseCost: { sunlight: 5, water: 2, nutrients: 3 }, effect: s => { s.trunk += 1; s.health += 1; s.maxHealth += 1; } },
  { key: 'taproot', name: 'Deepen Taproot', icon: '⬇️', category: 'growth', help: 'Drive a deeper anchor into the soil, greatly boosting water collection and drought resilience.', baseCost: { sunlight: 3, water: 1, nutrients: 3 }, effect: s => { s.rootZones += 1; s.taprootDepth += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
  { key: 'canopy', name: 'Expand Canopy', icon: '🌳', category: 'growth', help: 'Spread a broader crown for more sunlight than ordinary leaf growth.', baseCost: { sunlight: 4, water: 2, nutrients: 3 }, effect: s => { s.leafClusters += 2; s.branches += 1; s.canopySpread += 1; } },

  // DEFENSE - Protection and resilience
  { key: 'bark', name: 'Fortify Bark', icon: '🛡️', category: 'defense', help: 'Lay down denser protective tissue to resist insects, fire, and woodpeckers.', baseCost: { sunlight: 4, water: 1, nutrients: 3 }, effect: s => { s.trunk += 1; s.defense += 1; s.maxHealth += 1; s.health = Math.min(s.maxHealth, s.health + 1); } },
  { key: 'rhizosphere', name: 'Enrich Rhizosphere', icon: '🍄', category: 'defense', help: 'Invest in the soil food web for future nutrient gain.', baseCost: { sunlight: 2, water: 1, nutrients: 4 }, effect: s => { s.eventModifiers.soilBonus = (s.eventModifiers.soilBonus || 0) + 0.25; } },
  { key: 'shelterGrove', name: 'Shelter the Grove', icon: '⛺', category: 'defense', help: 'Spend resources to brace yourself and your allies against the next hardship.', baseCost: { sunlight: 4, water: 3, nutrients: 6 }, effect: s => { s.eventModifiers.shelter = 1; } },
  { key: 'resinReserve', name: 'Resin Reserve', icon: '🧪', category: 'defense', help: 'Choose a nutrient-heavy defensive investment for the next hardship.', baseCost: { sunlight: 2, water: 1, nutrients: 8 }, effect: s => resinReserveAction(s) },
  { key: 'woodSurge', name: 'Wood Surge', icon: '🏗️', category: 'growth', help: 'Choose a nutrient-heavy growth push for trunk, roots, or crown.', baseCost: { sunlight: 2, water: 2, nutrients: 8 }, effect: s => woodSurgeAction(s) },

  // DIPLOMACY - Interactions with other trees
  { key: 'connect', name: 'Seek Root Connection', icon: '🤝', category: 'diplomacy', help: 'Attempt underground friendship with a chosen neighboring tree.', baseCost: { sunlight: 1, water: 0, nutrients: 1 }, prereq: s => s.rootZones >= 3, effect: s => attemptConnection(s) },
  { key: 'aidAlly', name: 'Offer Aid to Ally', icon: '🎁', category: 'diplomacy', help: 'Send substantial reserves to support an ally and improve its health.', baseCost: { sunlight: 0, water: 1, nutrients: 6 }, prereq: s => s.allies >= 1, effect: s => offerAidToAlly(s) },
  { key: 'requestHelp', name: 'Request Help from Allies', icon: '🆘', category: 'diplomacy', help: 'Call on allied trees to send resources and resilience.', baseCost: { sunlight: 0, water: 0, nutrients: 1 }, prereq: s => s.allies >= 1 && s.health < s.maxHealth, effect: s => requestHelpFromAllies(s) },
  { key: 'shadeRival', name: 'Shade Rival', icon: '☂️', category: 'diplomacy', help: 'Lean into contested light and suppress a hostile neighbor.', baseCost: { sunlight: 3, water: 1, nutrients: 2 }, prereq: s => s.neighbors.some(n => getRelationshipState(n.relation).name === 'Hostile'), effect: s => shadeRivalAction(s) },
  { key: 'rootDominion', name: 'Root Dominion', icon: '👑', category: 'diplomacy', help: 'Assert overwhelming territorial pressure on all hostile trees nearby.', baseCost: { sunlight: 7, water: 4, nutrients: 5 }, prereq: s => s.neighbors.some(n => getRelationshipState(n.relation).name === 'Hostile'), effect: s => rootDominionAction(s) },

  // REPRODUCTION - Flowers, fruit, and offspring
  { key: 'flower', name: 'Produce Flower', icon: '🌸', category: 'reproduction', help: 'Creates blossoms that can be pollinated into fruit in spring.', baseCost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
  { key: 'massFlower', name: 'Mass Flowering', icon: '💐', category: 'reproduction', help: 'Pour resources into a burst of blossoms for a risky reproductive surge.', baseCost: { sunlight: 6, water: 3, nutrients: 4 }, effect: s => { s.flowers += 3; } },
  { key: 'nurtureOffspring', name: 'Nurture Offspring', icon: '👶', category: 'reproduction', help: 'Send reserves toward seedlings and improve lineage survival.', baseCost: { sunlight: 2, water: 2, nutrients: 6 }, prereq: s => s.offspringTrees >= 1 || s.seeds >= 1, effect: s => { s.offspringPool += 1; s.offspringTrees += 1; } },
  { key: 'mastYear', name: 'Mast Year', icon: '🌰', category: 'reproduction', help: 'An immense reproductive push that floods the canopy with flowers and future seed.', baseCost: { sunlight: 8, water: 4, nutrients: 8 }, effect: s => { s.flowers += 5; s.pollinated += 1; } },
];

const CATEGORY_NAMES = {
  growth: '🌱 Growth',
  defense: '🛡️ Defense',
  diplomacy: '🤝 Diplomacy',
  reproduction: '🌸 Reproduction',
};

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
function showFeedback(message, type = 'success') {
  const feedback = document.createElement('div');
  feedback.className = `feedback ${type}`;
  feedback.textContent = message;
  els.feedbackContainer.appendChild(feedback);
  
  setTimeout(() => {
    feedback.remove();
  }, 3000);
}

function setTurnEndBanner(message = '') {
  if (!els.turnEndBanner) return;
  if (!message) {
    els.turnEndBanner.textContent = '';
    els.turnEndBanner.classList.add('hidden');
    return;
  }
  els.turnEndBanner.innerHTML = `<strong>Turn ending:</strong> ${message}`;
  els.turnEndBanner.classList.remove('hidden');
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
  }, () => true, 'Choose a neighboring tree', 'Your roots probe the soil for a possible connection.', true);
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

function renderSpeciesSummary(speciesName, options = {}) {
  const spec = SPECIES[speciesName];
  if (!spec) return '';

  const {
    title = speciesName,
    intro = '',
    compact = false,
  } = options;

  const startingEdge = [];
  if (spec.health > 10) startingEdge.push(`Health ${spec.health}`);
  if (spec.trunk > 1) startingEdge.push(`Trunk ${spec.trunk}`);

  return `
    <div class="species-summary ${compact ? 'compact' : ''}">
      <div class="species-summary-head">
        <div class="species-summary-title-row">
          <span class="species-summary-icon">${spec.icon || '🌳'}</span>
          <div>
            <div class="species-summary-kicker">${intro}</div>
            <h3>${title}</h3>
          </div>
        </div>
        <p class="species-summary-description">${spec.description}</p>
      </div>
      <div class="species-summary-bonus"><strong>Bonus:</strong> ${spec.bonusTitle} — ${spec.bonusText}</div>
      <div class="species-summary-meta">
        <div><strong>Pollinators:</strong> ${spec.pollinators.join(', ')}</div>
        <div><strong>Starting edge:</strong> ${startingEdge.length ? startingEdge.join(' · ') : 'Balanced baseline'}</div>
      </div>
    </div>`;
}

function initSpeciesSelect() {
  const names = Object.keys(SPECIES);
  const chosen = names[Math.floor(Math.random() * names.length)];
  state.selectedSpecies = chosen;
  els.speciesList.innerHTML = `
    <div class="species-card selected species-card-detail">
      ${renderSpeciesSummary(chosen, { title: `${chosen} tree`, intro: 'You are a' })}
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

function currentSeason() { return SEASONS[state.seasonIndex]; }

function exposureFactor() {
  const hostileShade = state.eventModifiers.shade || 0;
  return Math.max(0.15, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - hostileShade);
}

function collectResources() {
  const season = currentSeason();
  const canopyBonus = state.canopySpread * 2;
  const taprootBonus = state.taprootDepth * 2;
  const sunlightBase = state.leafClusters + canopyBonus;
  const sunlightGain = Math.max(1, Math.floor(sunlightBase * exposureFactor() * season.factorSun * state.eventModifiers.disease));
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
  return { sunlightGain, waterGain, nutrientGain, waterStorage, canopyBonus, taprootBonus, sunlightBase, rootNutrients, allyNutrients, soilBonus, maintenanceCost, grossNutrients };
}

function showModal(title, body, onContinue) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.remove('hidden');
  els.modalButton.style.display = '';
  els.modalButton.onclick = () => {
    els.modal.classList.add('hidden');
    onContinue?.();
  };
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 10)));
}

function currentRunRecord(reason = 'game over') {
  return {
    species: state.selectedSpecies || 'Unknown',
    score: state.score,
    year: state.year,
    stage: state.lifeStage.name,
    allies: state.allies,
    viableSeeds: state.viableSeeds,
    offspring: state.offspringPool,
    reason,
    savedAt: new Date().toISOString(),
  };
}

function saveCurrentRunToLeaderboard(reason = 'game over') {
  const entry = currentRunRecord(reason);
  const entries = loadLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score || b.year - a.year);
  saveLeaderboard(entries);
  state.recordsSavedThisRun = true;
  return entry;
}

function leaderboardHtml() {
  const entries = loadLeaderboard();
  if (!entries.length) {
    return '<p>No grove records yet. Finish a run to plant the first one.</p>';
  }

  return `
    <ol class="leaderboard-list">
      ${entries.map((entry, idx) => `
        <li>
          <strong>#${idx + 1} — ${entry.species}</strong><br>
          Score <strong>${entry.score}</strong> · Year ${entry.year} · ${entry.stage}<br>
          Seeds ${entry.viableSeeds} · Allies ${entry.allies} · ${entry.reason}
        </li>
      `).join('')}
    </ol>
  `;
}

function showLeaderboardModal() {
  showModal('Grove Records', leaderboardHtml(), () => {});
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
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.remove('hidden');
  els.modalButton.style.display = 'none';
  els.modalButton.onclick = null;
  const wrap = document.createElement('div');
  wrap.className = 'neighbor-choices';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'neighbor-choice';
    btn.textContent = choice.label;
    btn.onclick = () => {
      els.modal.classList.add('hidden');
      els.modalButton.style.display = '';
      choice.onChoose?.();
    };
    wrap.appendChild(btn);
  });
  els.modalBody.appendChild(wrap);
}

function processPendingInteractions(onDone) {
  if (!state.pendingInteractions.length) return onDone?.();
  const interaction = state.pendingInteractions.shift();
  interaction(() => processPendingInteractions(onDone));
}

function showResourcePhase() {
  if (state.gameOver) return;
  setTurnEndBanner('');
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
        <span class="res-detail">${state.leafClusters} leaves + canopy bonus ${gains.canopyBonus} × ${exposure}% exposure × ${season.factorSun} season</span>
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="res-detail">trunk ${state.trunk} + roots ${state.rootZones} + taproot bonus ${gains.taprootBonus} support water storage</span>
      </div>
      <div class="res-line">
        <span class="res-icon">🌱</span>
        <span class="res-name">Nutrients</span>
        <span class="res-value">+${gains.nutrientGain}</span>
        <span class="res-detail">roots ${gains.rootNutrients.toFixed(1)} + allies ${gains.allyNutrients.toFixed(1)} + soil ${gains.soilBonus.toFixed(2)} − upkeep ${gains.maintenanceCost}</span>
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
  state.allies = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally').length + state.offspringTrees;
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

// Sapling-and-later ally threats - neglected alliances can sour once the tree is established enough to rely on them
function checkAllyBetrayal(events) {
  const currentStage = computeCurrentLifeStage();
  if (currentStage.rank < STAGE_BY_NAME['Sapling'].rank) return;

  const capAllyThreats = currentStage.rank < STAGE_BY_NAME['Mature Tree'].rank;
  let allyThreatTriggered = false;

  for (const neighbor of state.neighbors) {
    if (getRelationshipState(neighbor.relation).name !== 'Ally') continue;
    if (capAllyThreats && allyThreatTriggered) break;
    
    // Track neglect: if help refused more than given, risk betrayal
    const neglectScore = (neighbor.helpRefusedToThem || 0) - (neighbor.helpGivenToThem || 0);
    
    // 15% chance of betrayal event if neglected
    if (neglectScore >= 2 && Math.random() < 0.15) {
      const oldState = getRelationshipState(neighbor.relation).name;
      neighbor.relation = Math.max(-100, neighbor.relation - 25);
      const newState = getRelationshipState(neighbor.relation).name;
      
      events.push({ 
        text: `Your ally ${neighbor.species} feels abandoned. The fungal bond between you weakens into something bitter.`, 
        effect: 'warning' 
      });
      
      state.pendingInteractions.push((done) => {
        showRelationshipChangeModal(neighbor.species, oldState, newState, () => {
          updateAlliesCount(); updateScore(); updateUI(); render(); done();
        });
      });
      allyThreatTriggered = true;
      continue;
    }
    
    // Fungal Network Collapse - blight spreads through ally connections later in the run
    if (state.year >= 8 && Math.random() < 0.08) {
      events.push({ 
        text: `Blight travels the fungal network from your ally ${neighbor.species}. Your shared connection becomes a channel for disease.`, 
        effect: 'warning' 
      });
      state.eventModifiers.disease = 0.7; // -30% resources
      state.health -= 2;
      recordDamage(2, 'blight');
      events.push({ text: 'Health -2 from network blight. Resource collection reduced.', effect: 'damage' });
      allyThreatTriggered = true;
    }
  }
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
    // Check if action should be hidden at current stage
    if (action.hideAt) {
      const hideStage = LIFE_STAGES.find(s => s.name === action.hideAt);
      if (hideStage && currentStageRank >= hideStage.rank) return;
    }

    const scaledCost = getScaledCost(action.baseCost, action.key);
    const prereqOk = action.prereq ? action.prereq(state) : true;
    const affordable = canAfford(scaledCost);
    const unlocked = isActionUnlocked(action.key);
    const currentSeasonName = currentSeason().name;
    const allowedSeasons = SEASONAL_ACTIONS[action.key];
    const seasonLocked = allowedSeasons && !allowedSeasons.includes(currentSeasonName);
    const usable = prereqOk && affordable && state.actions > 0 && !seasonLocked && unlocked;

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
      let reason = 'Unavailable';
      if (!unlocked) reason = `Awakens at the ${LIFE_STAGES.find(stage => stage.unlocks.includes(action.key))?.name || 'next stage'}`;
      else if (seasonLocked) reason = `Best attempted in ${allowedSeasons.join('/')}`;
      else if (!prereqOk) {
        if (action.key === 'connect') reason = 'Your roots must reach deeper first';
        else if (action.key === 'requestHelp') reason = state.allies < 1 ? 'You need an ally to call on' : 'You would only ask for help when wounded';
        else reason = 'The moment is not right yet';
      } else if (!affordable || state.actions <= 0) reason = 'You lack the resources right now';
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

  // Render categories
  Object.entries(categories).forEach(([catKey, catActions]) => {
    if (catActions.length === 0) return;

    const details = document.createElement('details');
    details.className = 'action-category';
    details.open = true;
    details.innerHTML = `<summary class="category-header">${CATEGORY_NAMES[catKey]} (${catActions.length})</summary>`;

    const wrap = document.createElement('div');
    wrap.className = 'category-actions';

    catActions.forEach(({ action, scaledCost, costsHtml }) => {
      const card = document.createElement('div');
      card.className = 'action-card';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <p class="action-help">${action.help}</p>
        ${costsHtml}`;

      const btn = document.createElement('button');
      btn.textContent = 'Use Action';
      btn.onclick = () => {
        spend(scaledCost);
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
      wrap.appendChild(card);
    });

    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  });

  // Future actions (collapsed)
  if (futureActions.length > 0) {
    const details = document.createElement('details');
    details.className = 'future-actions';
    details.innerHTML = `<summary>🔒 Future Growth (${futureActions.length})</summary>`;
    const wrap = document.createElement('div');
    wrap.className = 'future-actions-list';
    futureActions.forEach(({ action, costsHtml, reason }) => {
      const card = document.createElement('div');
      card.className = 'action-card disabled';
      card.innerHTML = `
        <div class="action-header">
          <h4 class="action-title">${action.name}</h4>
          <span class="action-icon">${action.icon}</span>
        </div>
        <span class="prereq-missing">Locked</span>
        <p class="action-help">${action.help}</p>
        ${costsHtml}
        <p class="future-reason">${reason}</p>`;
      wrap.appendChild(card);
    });
    details.appendChild(wrap);
    els.actionsList.appendChild(details);
  }

  // Finish turn button
  if (state.actions > 0 && Object.values(categories).some(arr => arr.length > 0)) {
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
// Escalating threats: damage increases after year 10
function getThreatMultiplier() {
  if (state.year < 10) return 1;
  return 1 + ((state.year - 10) * 0.1); // +10% per year after 10
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
      const droughtResist = getDroughtResistance();
      const baseDroughtModifier = Math.max(0.15, 0.55 - (s.trunk * 0.08));
      s.eventModifiers.drought = Math.min(1, baseDroughtModifier + (droughtResist * 0.35));
      const baseThirst = Math.max(1, 2 - s.trunk - Math.floor(s.eventModifiers.shelter || 0));
      const thirst = Math.max(1, Math.floor(baseThirst * getThreatMultiplier() * (1 - droughtResist * 0.5)));
      s.health -= thirst;
      recordDamage(thirst, 'drought');
      const effects = [`Water collection reduced sharply`, `Health -${thirst} from thirst and water stress`];
      if (droughtResist >= 0.4) effects.push(`Your species' natural drought tolerance helps you hold on to moisture.`);
      if (s.taprootDepth > 0) effects.push(`Your deep taproot finds lower moisture and softens the drought's bite.`);
      return effects;
    }
  },
  {
    key: 'InsectSwarm',
    name: 'Insect Swarm',
    icon: '🐛',
    desc: 'A wave of herbivores descends on the canopy, hungry for tender leaves.',
    severity: 'bad',
    apply: (s) => {
      const baseDamage = Math.max(1, 1 - s.defense);
      const damage = Math.floor(baseDamage * getThreatMultiplier());
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
      const damage = Math.max(0, 3 - s.trunk - Math.floor(s.rootZones / 2) - Math.floor(s.eventModifiers.shelter || 0));
      s.health -= damage;
      recordDamage(damage, 'storm');
      const effects = [];
      if (s.branches > 0) {
        const prevBranches = s.branches;
        s.branches = Math.max(1, s.branches - 1);
        const lost = prevBranches - s.branches;
        effects.push(`${lost} branch snapped by wind`);
      } else if (s.leafClusters > 0) {
        s.leafClusters = Math.max(0, s.leafClusters - 1);
        effects.push('Wind shreds your tender top growth before any true branch can form');
      } else {
        effects.push('The storm bends your young stem and scours the soil around your base');
      }
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
      const damage = Math.max(1, 2 - barkProtection - Math.floor(s.eventModifiers.shelter || 0));
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
      const alliedNeighbors = s.neighbors.filter(n => !n.dead && getRelationshipState(n.relation).name === 'Ally');
      if (alliedNeighbors.length > 0) {
        const target = alliedNeighbors[Math.floor(Math.random() * alliedNeighbors.length)];
        const blightDamage = 4;
        target.health = Math.max(0, target.health - blightDamage);
        effects.push(`The blight spreads to your allied ${target.species}. (${target.health}/${target.maxHealth} health remains)`);
        if (target.health <= 0) {
          effects.push(`The ${target.species} is overwhelmed by blight.`);
          s.pendingInteractions.push((done) => {
            updateNeighborAliveState(target, 'fungal blight');
            done?.();
          });
        }
        updateAlliesCount();
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


function compareConflictPower(neighbor) {
  const yourPower = state.defense + state.rootZones + state.branches + state.trunk + Math.floor(state.leafClusters / 2);
  const neighborStage = getNeighborStage(neighbor.stageScore).rank + 1;
  const theirPower = neighborStage * 2 + Math.max(0, Math.floor(-neighbor.relation / 20));
  return { yourPower, theirPower };
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
  
  if (state.pendingChemicalThreat) {
    const delayed = state.pendingChemicalThreat;
    state.pendingChemicalThreat = null;
    events.push({ text: delayed.warning, effect: 'warning' });
    events.push({ text: delayed.ignore(), effect: 'damage' });
  }

  // Pollination chance based on flowers and season
  if (state.flowers > 0) {
    const basePollinatorChance = currentSeason().name === 'Spring' ? 0.55 : 
                                currentSeason().name === 'Summer' ? 0.4 : 0.1;
    const pollinatorChance = getPollinatorChance(basePollinatorChance);
    if (Math.random() < pollinatorChance) {
      const pollinated = Math.min(state.flowers, Math.floor(Math.random() * 2) + 1);
      state.pollinated += pollinated;
      state.flowers -= pollinated;
      const visitor = SPECIES[state.selectedSpecies].pollinators[Math.floor(Math.random() * SPECIES[state.selectedSpecies].pollinators.length)];
      const citrusBonusText = state.selectedSpecies === 'Citrus' ? ' Its fragrant blossoms drew them in.' : '';
      events.push({
        text: `${visitor} visited! ${pollinated} flower${pollinated !== 1 ? 's' : ''} were successfully pollinated. (+${pollinated} flowers pollinated)${citrusBonusText}`,
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

  if (alliedNeighbors.length > 0) {
    advanceAllyCrises(events);
    checkAllyBetrayal(events); // NEW: Late-game ally threats
  }
  if (hostileNeighbors.length > 0 && Math.random() < 0.35) {
    const target = hostileNeighbors[Math.floor(Math.random() * hostileNeighbors.length)];
    queueHostileTreeThreat(target, events);
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Seedling'].rank && Math.random() < 0.18) {
    queueChemicalDefenseThreat(events);
  }
  if (Math.random() < 0.12) {
    const currentStage = computeCurrentLifeStage().name;
    let flavor;
    if (currentStage === 'Seed' || currentStage === 'Sprout' || currentStage === 'Seedling') {
      // Early stage flavor (underground/surface focus)
      const earlyFlavor = [
        'A beetle trundles past your seed, unaware of the life within.',
        'Earthworms turn the soil nearby, aerating the ground you will soon reach for.',
        'A gentle rain soaks the earth above you, promising moisture to come.',
        'Ants march in lines across the soil surface, busy with their own purposes.',
        'The soil shifts slightly as a mole tunnels past, deep below.',
      ];
      flavor = earlyFlavor[Math.floor(Math.random() * earlyFlavor.length)];
    } else if (currentStage === 'Sapling' || currentStage === 'Small Tree') {
      // Mid stage flavor (growing canopy, no flowers yet for Sapling)
      const midFlavor = [
        'Two hopeful crows have chosen your branches to make a nest for their young.',
        'A squirrel vanishes along your bark with one of your seeds, perhaps to lose it somewhere generous.',
        'A fox sleeps for an afternoon in the small shade you cast.',
        'Robins tug worms from the damp soil near your roots.',
        'A gentle breeze rustles your new leaves.',
      ];
      flavor = midFlavor[Math.floor(Math.random() * midFlavor.length)];
    } else {
      // Late stage flavor (full canopy, flowers, fruit)
      const lateFlavor = [
        'Two hopeful crows have chosen your branches to make a nest for their young.',
        'A squirrel vanishes along your bark with one of your seeds, perhaps to lose it somewhere generous.',
        'Bees drift lazily through your flowers, dusted gold with pollen.',
        'A fox sleeps for an afternoon in the shade you cast.',
        'Robins tug worms from the damp soil near your roots.',
      ];
      flavor = lateFlavor[Math.floor(Math.random() * lateFlavor.length)];
    }
    events.push({ text: flavor, effect: 'flavor' });
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.12) {
    events.push({ text: 'Squirrels dart through your canopy. If you already carry seed, some may be buried in lucky ground.', effect: 'helper' });
    if (state.seeds > 0 && Math.random() < 0.5) state.seeds += 1;
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Sapling'].rank && Math.random() < 0.1) {
    events.push({ text: 'A woodpecker drums at your bark, probing for insects in weakened places.', effect: 'warning' });
    if (state.defense + state.trunk >= 3) {
      events.push({ text: 'Your bark holds. The pecking dislodges pests before they can spread. (+1 nutrient)', effect: 'good' });
      state.nutrients += 1;
    } else {
      state.health = Math.max(0, state.health - 1); recordDamage(1, 'insects');
      events.push({ text: 'The pecking opens small wounds in your bark. (-1 health)', effect: 'damage' });
    }
  }
  if (state.lifeStage.rank >= STAGE_BY_NAME['Small Tree'].rank && Math.random() < 0.08) {
    events.push({ text: 'Beavers work the nearby watercourse, changing the moisture around your roots.', effect: 'warning' });
    if (state.trunk >= 3) {
      state.water += 2;
      events.push({ text: 'You are large enough to escape their teeth, and the altered watershed leaves you with wetter soil. (+2 water)', effect: 'good' });
    } else {
      state.health = Math.max(0, state.health - 2); recordDamage(2, 'storm');
      events.push({ text: 'The altered flow and gnawing pressure leave you stressed. (-2 health)', effect: 'damage' });
    }
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
  state.eventModifiers.shelter = Math.max(0, (state.eventModifiers.shelter || 0) - 0.25);
  
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
  if (!els.turnEndBanner?.classList.contains('hidden')) {
    els.turnEndBanner.innerHTML = `<strong>Turn ended:</strong> ${els.turnEndBanner.textContent.replace(/^Turn ending:\s*/, '')}`;
  }
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
    const continueFlow = () => {
      processPendingInteractions(() => {
        if (maybeShowHealthWarning(advanceTurn)) return;
        advanceTurn();
      });
    };
    if (state.majorEvent?.key === 'Drought' && state.taprootDepth > 0) {
      showModal('Taproot Resilience', '<p>Your deep taproot reaches moisture far below the drying surface. The drought still hurts, but not as much as it would have.</p>', continueFlow);
    } else {
      continueFlow();
    }
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

  // Species growth rate affects stage progression; very old trees still accelerate further.
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
        if (maybeShowAllyWarning()) return;
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
  if (maybeShowAllyWarning()) return;
  showResourcePhase();
}

function handleDeath() {
  if (state.offspringPool > 0) {
    const choices = generateSuccessionChoices(Math.min(3, state.offspringPool)).map(choice => ({
      label: choice.label,
      onChoose: () => continueAsSuccessor(choice),
    }));
    showChoiceModal('Succession', `
      <p>Your current tree has died, but living offspring remain.</p>
      <p>Choose which surviving line will carry the grove forward:</p>
      <ul>
        ${generateSuccessionChoices(Math.min(3, state.offspringPool)).map(choice => `<li><strong>${choice.label}</strong> — ${choice.summary}</li>`).join('')}
      </ul>
    `, choices);
  } else {
    state.gameOver = true;
    const flavor = deathFlavor(state.lastDamageCause);
    if (!state.recordsSavedThisRun) saveCurrentRunToLeaderboard('lineage ended');
    showModal('Game Over', `<p><em>${flavor}</em></p><p>Your lineage has ended.</p><p>Final score: <strong>${state.score}</strong></p><p>Your run has been added to the grove records.</p>`, () => {});
  }
}

function updateScore() {
  state.score = (state.year * 10) + (state.branches + state.rootZones + state.trunk) + (state.viableSeeds * 50) + (state.allies * 20);

  if (state.lifeStage.name === 'Ancient' && !state.victoryAchieved) {
    state.victoryAchieved = true;
    if (!state.recordsSavedThisRun) saveCurrentRunToLeaderboard('reached Ancient');
    showModal('Victory!', `
      <h2>🌳 You have become Ancient! 🌳</h2>
      <p>Your roots run deep. Your canopy towers above the forest.</p>
      <p>You have successfully established yourself in the ecosystem.</p>
      <p><em>Your offspring will flourish here and provide shade for generations to come.</em></p>
      <p>Current Score: <strong>${state.score}</strong></p>
      <p>Your milestone has been added to the grove records.</p>
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
      els.actionsRemaining.textContent = state.actions > 0 ? 'No actions available' : 'No actions remaining';
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
    speciesBadge.innerHTML = renderSpeciesSummary(state.selectedSpecies, {
      title: state.selectedSpecies,
      intro: 'Species',
      compact: true,
    });
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
  } else if (stageName === 'Sapling') {
    // Sapling: taller thin trunk, small proportional canopy
    const trunkH = 55 * scale;
    const trunkW = 6 * scale;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);
    // Small canopy - leaves add less bulk
    const saplingCanopyR = (10 + Math.max(0, leafClusters) * 0.8) * scale;
    ctx.beginPath();
    ctx.ellipse(x, groundY - trunkH - saplingCanopyR * 0.3, saplingCanopyR, saplingCanopyR * 0.75, 0, 0, Math.PI * 2);
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
      // Slower canopy growth - leaves add less radius
      const slowCanopyR = (12 + Math.max(0, leafClusters) * 1.2) * scale;
      ctx.beginPath();
      ctx.ellipse(x, groundY - trunkH - slowCanopyR * 0.25, slowCanopyR, slowCanopyR * 0.85, 0, 0, Math.PI * 2);
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
    if (!neighbor.offspring && typeof neighbor.health === 'number' && typeof neighbor.maxHealth === 'number') {
      const healthColor = getRelationshipState(neighbor.relation).name === 'Ally' ? 'rgba(187, 247, 208, 0.9)' : 'rgba(255,255,255,0.55)';
      ctx.fillStyle = healthColor;
      ctx.font = '10px sans-serif';
      ctx.fillText(`Health ${neighbor.health}/${neighbor.maxHealth}`, x, groundY + 124);
    }
  }
}

els.startGame.addEventListener('click', startGame);
els.viewLeaderboard?.addEventListener('click', showLeaderboardModal);
initSpeciesSelect();
render();
