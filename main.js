const SEASONS = [
  { name: 'Spring', factorSun: 0.8, factorWater: 1.0, top: '#FFE4E1', bottom: '#E6F3FF' },
  { name: 'Summer', factorSun: 1.2, factorWater: 0.6, top: '#FFD700', bottom: '#90EE90' },
  { name: 'Autumn', factorSun: 0.6, factorWater: 0.8, top: '#FF8C00', bottom: '#8B4513' },
  { name: 'Winter', factorSun: 0.2, factorWater: 0.4, top: '#D3D3D3', bottom: '#F0F8FF' },
];

const SPECIES = {
  Redwood: {
    description: 'Slow, ancient, clonal, fire-adapted.',
    branches: 2, rootZones: 3, trunk: 2, health: 14,
    growthRate: 0.7, fireResist: 0.8, startAllies: 2, familyNetwork: false, persuade: false,
  },
  Plum: {
    description: 'Fast-growing fruit tree with quick family succession.',
    branches: 1, rootZones: 2, trunk: 1, health: 10,
    growthRate: 1.3, fireResist: 0.2, startAllies: 0, familyNetwork: true, persuade: false,
  },
  Oak: {
    description: 'Strong and stubborn, slow to trust, excellent at chemical defense.',
    branches: 1, rootZones: 2, trunk: 2, health: 12,
    growthRate: 1.0, fireResist: 0.5, startAllies: 0, familyNetwork: false, persuade: true,
  },
};

const ACTIONS = [
  { key: 'growBranch', name: 'Grow Branch', cost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.branches += 1; s.leafClusters += 1; } },
  { key: 'extendRoot', name: 'Extend Root', cost: { sunlight: 1, water: 0, nutrients: 0 }, effect: s => { s.rootZones += 1; } },
  { key: 'growLeaves', name: 'Grow Leaves', cost: { sunlight: 1, water: 1, nutrients: 1 }, effect: s => { s.leafClusters += 1; } },
  { key: 'flower', name: 'Produce Flower', cost: { sunlight: 3, water: 2, nutrients: 2 }, effect: s => { s.flowers += 1; } },
  { key: 'fruit', name: 'Produce Seed/Fruit', cost: { sunlight: 4, water: 2, nutrients: 2 }, prereq: s => s.flowers > 0, effect: s => { s.flowers -= 1; s.seeds += 1; } },
  { key: 'thicken', name: 'Thicken Trunk', cost: { sunlight: 5, water: 2, nutrients: 2 }, effect: s => { s.trunk += 1; s.health += 1; } },
  { key: 'defense', name: 'Chemical Defense', cost: { sunlight: 3, water: 1, nutrients: 2 }, effect: s => { s.defense += 1; } },
  { key: 'repair', name: 'Repair Damage', cost: { sunlight: 2, water: 1, nutrients: 1 }, effect: s => { s.health = Math.min(s.maxHealth, s.health + 2); } },
  { key: 'share', name: 'Share Resources With Allies', cost: { sunlight: 1, water: 1, nutrients: 1 }, prereq: s => s.allies > 0, effect: s => { s.sharedThisTurn = true; } },
  { key: 'connect', name: 'Seek Root Connection', cost: { sunlight: 1, water: 0, nutrients: 1 }, effect: s => attemptConnection(s) },
];

const state = {
  started: false,
  selectedSpecies: null,
  year: 1,
  seasonIndex: 0,
  turnInSeason: 1,
  score: 0,
  sunlight: 0,
  water: 0,
  nutrients: 0,
  actions: 0,
  branches: 0,
  rootZones: 0,
  leafClusters: 0,
  trunk: 0,
  flowers: 0,
  seeds: 0,
  viableSeeds: 0,
  allies: 0,
  health: 0,
  maxHealth: 0,
  offspringPool: 0,
  defense: 0,
  log: [],
  eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0 },
  majorEvent: null,
  minorEvent: null,
  sharedThisTurn: false,
  gameOver: false,
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
};

const ctx = els.canvas.getContext('2d');

function initSpeciesSelect() {
  Object.entries(SPECIES).forEach(([name, spec]) => {
    const card = document.createElement('div');
    card.className = 'species-card';
    card.innerHTML = `<h3>${name}</h3><p>${spec.description}</p>
      <small>Branches ${spec.branches} · Roots ${spec.rootZones} · Health ${spec.health}</small>`;
    card.onclick = () => {
      state.selectedSpecies = name;
      [...els.speciesList.children].forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      els.startGame.disabled = false;
    };
    els.speciesList.appendChild(card);
  });
}

function startGame() {
  const spec = SPECIES[state.selectedSpecies];
  Object.assign(state, {
    started: true,
    year: 1,
    seasonIndex: 0,
    turnInSeason: 1,
    score: 0,
    sunlight: 6,
    water: 6,
    nutrients: 6,
    actions: 3,
    branches: spec.branches,
    rootZones: spec.rootZones,
    leafClusters: spec.branches,
    trunk: spec.trunk,
    flowers: 0,
    seeds: 0,
    viableSeeds: 0,
    allies: spec.startAllies,
    health: spec.health,
    maxHealth: spec.health,
    offspringPool: 0,
    defense: 0,
    log: [],
    eventModifiers: { drought: 1, disease: 1, storms: 0, rainChain: 0 },
    gameOver: false,
  });
  els.speciesPanel.classList.add('hidden');
  els.gamePanel.classList.remove('hidden');
  els.hudPanel.classList.remove('hidden');
  updateUI();
  showResourcePhase();
}

function currentSeason() { return SEASONS[state.seasonIndex]; }

function exposureFactor() {
  return Math.max(0.35, 1 - (0.08 * Math.max(0, 4 - state.trunk)) - (0.05 * Math.max(0, 2 - state.allies)));
}

function collectResources() {
  const season = currentSeason();
  const sunlightGain = Math.max(1, Math.floor(state.leafClusters * exposureFactor() * season.factorSun * state.eventModifiers.disease));
  const waterGain = Math.max(1, Math.floor(state.rootZones * season.factorWater * state.eventModifiers.drought * state.eventModifiers.disease));
  const nutrientGain = Math.max(1, Math.floor((state.rootZones + 0.2 * state.allies * state.rootZones) * state.eventModifiers.disease));
  state.sunlight += sunlightGain;
  state.water += waterGain;
  state.nutrients += nutrientGain;
  state.actions = 3 + Math.floor((sunlightGain + waterGain + nutrientGain) / 5);
  return { sunlightGain, waterGain, nutrientGain };
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
  addLog(`Collected +${gains.sunlightGain} sunlight, +${gains.waterGain} water, +${gains.nutrientGain} nutrients.`);
  updateUI();
  render();

  const season = currentSeason();
  const exposure = Math.round(exposureFactor() * 100);

  showModal('Resource Phase', `
    <div class="resource-summary">
      <div class="res-line">
        <span class="res-icon">☀</span>
        <span class="res-name">Sunlight</span>
        <span class="res-value">+${gains.sunlightGain}</span>
        <span class="res-detail">${state.leafClusters} leaves × ${exposure}% exposure × ${season.factorSun} season</span>
      </div>
      <div class="res-line">
        <span class="res-icon">💧</span>
        <span class="res-name">Water</span>
        <span class="res-value">+${gains.waterGain}</span>
        <span class="res-detail">${state.rootZones} roots × ${season.factorWater} season</span>
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
  return state.sunlight >= cost.sunlight && state.water >= cost.water && state.nutrients >= cost.nutrients && state.actions > 0;
}

function spend(cost) {
  state.sunlight -= cost.sunlight;
  state.water -= cost.water;
  state.nutrients -= cost.nutrients;
  state.actions -= 1;
}

function attemptConnection(s) {
  if (state.selectedSpecies === 'Oak') {
    const roll = Math.random();
    if (roll < 0.4) { s.allies += 1; addLog('Another tree accepted your fungal approach.'); }
    else if (roll < 0.8) { addLog('Another tree ignored your fungal approach.'); }
    else { s.health -= 1; addLog('A neighboring tree rejected you and turned hostile.'); }
    return;
  }
  s.allies += 1;
  addLog('Your roots reached a new fungal ally.');
}

const neighborTrees = [
  { species: 'Redwood', age: 0.7, health: 0.8, branches: 3, roots: 4, trunk: 3, ally: true },
  { species: 'Oak', age: 0.5, health: 0.9, branches: 2, roots: 3, trunk: 2, ally: false },
  null,
  { species: 'Plum', age: 0.3, health: 0.7, branches: 2, roots: 2, trunk: 1, ally: false },
  { species: 'Redwood', age: 0.9, health: 0.6, branches: 4, roots: 5, trunk: 4, ally: true },
];

function getNeighborTree(idx) {
  if (idx === 2) return null;
  const base = neighborTrees[idx];
  if (!base) {
    return {
      species: ['Oak', 'Plum', 'Redwood'][idx % 3],
      age: 0.4 + (idx * 0.15),
      health: 0.6 + (idx * 0.08),
      branches: 1 + idx,
      roots: 2 + idx,
      trunk: 1 + Math.floor(idx / 2),
      ally: idx === 0 || idx === 4
    };
  }
  return base;
}

function renderActions() {
  els.actionsList.innerHTML = '';

  const phaseIndicator = document.createElement('div');
  phaseIndicator.className = 'phase-indicator';
  phaseIndicator.innerHTML = `<span class="phase-badge action-phase">ACTION PHASE</span> <span class="phase-hint">${state.actions} action${state.actions !== 1 ? 's' : ''} remaining</span>`;
  els.actionsList.appendChild(phaseIndicator);

  ACTIONS.forEach(action => {
    const card = document.createElement('div');
    const prereqOk = action.prereq ? action.prereq(state) : true;
    const affordable = canAfford(action.cost);
    const disabled = !prereqOk || !affordable || state.actions <= 0;

    const sunClass = state.sunlight >= action.cost.sunlight ? 'res-ok' : 'res-low';
    const waterClass = state.water >= action.cost.water ? 'res-ok' : 'res-low';
    const nutClass = state.nutrients >= action.cost.nutrients ? 'res-ok' : 'res-low';

    card.className = `action-card ${disabled ? 'disabled' : ''}`;
    card.innerHTML = `
      <div class="action-header">
        <h4>${action.name}</h4>
        ${prereqOk ? '' : '<span class="prereq-missing">Requires flower</span>'}
      </div>
      <div class="action-costs">
        <span class="cost ${sunClass}">☀ ${action.cost.sunlight}</span>
        <span class="cost ${waterClass}">💧 ${action.cost.water}</span>
        <span class="cost ${nutClass}">🌱 ${action.cost.nutrients}</span>
      </div>`;

    const btn = document.createElement('button');
    btn.textContent = disabled ? (prereqOk ? 'Insufficient Resources' : 'Locked') : 'Use Action';
    btn.disabled = disabled;
    btn.onclick = () => {
      spend(action.cost);
      action.effect(state);
      if (state.selectedSpecies === 'Plum' && action.key === 'fruit') {
        state.allies = Math.max(state.allies, Math.min(3, state.seeds));
      }
      addLog(`Action: ${action.name}`);
      updateScore();
      updateUI();
      render();
      renderActions();
      if (state.actions <= 0) showEventPhase();
    };
    card.appendChild(btn);
    els.actionsList.appendChild(card);
  });

  const endBtn = document.createElement('button');
  endBtn.className = 'finish-turn-btn';
  endBtn.textContent = 'Finish Turn Early →';
  endBtn.onclick = showEventPhase;
  els.actionsList.appendChild(endBtn);
}

function rollMajorEvent() {
  const pool = ['Drought', 'Insect Swarm', 'Storm', 'Fire'];
  const weights = [0.35, 0.3, 0.25, 0.1];
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < pool.length; i++) {
    sum += weights[i];
    if (r <= sum) return pool[i];
  }
  return 'Storm';
}

function rollMinorEvents() {
  const events = [];
  if (Math.random() < 0.35 && state.flowers > 0) events.push('Pollinators visited your flowers.');
  if (Math.random() < 0.25) events.push('Forest animals left nitrogen-rich gifts near your trunk.');
  if (Math.random() < 0.25) events.push('A passing rain shower refreshed the soil.');
  if (Math.random() < 0.2) events.push('A sharp wind snapped a tender branch.');
  return events;
}

function applyEventEffects(major, minors) {
  state.eventModifiers.drought = 1;
  state.eventModifiers.disease = 1;
  if (major === 'Drought') {
    state.eventModifiers.drought = 0.3;
    state.health -= 1;
  }
  if (major === 'Insect Swarm') {
    const damage = Math.max(1, 2 - state.defense);
    state.leafClusters = Math.max(1, state.leafClusters - damage);
    state.health -= 1;
  }
  if (major === 'Storm') {
    state.branches = Math.max(1, state.branches - 1);
    state.health -= Math.max(0, 2 - state.trunk);
  }
  if (major === 'Fire') {
    const damage = Math.max(0, 4 - Math.floor((SPECIES[state.selectedSpecies].fireResist || 0) * 4) - state.trunk);
    state.health -= damage;
  }
  minors.forEach(event => {
    if (event.includes('Pollinators')) {
      state.score += 10;
      state.viableSeeds += 1;
    }
    if (event.includes('nitrogen')) state.nutrients += 1;
    if (event.includes('rain')) {
      state.water += 2;
      state.eventModifiers.rainChain += 1;
      if (state.eventModifiers.rainChain >= 3) {
        state.health -= 1;
        addLog('Too much rain in a row caused mild root rot.');
      }
    } else {
      state.eventModifiers.rainChain = 0;
    }
    if (event.includes('wind')) state.branches = Math.max(1, state.branches - 1);
  });
  if (state.sharedThisTurn && state.allies > 0) {
    state.score += 5 * state.allies;
    state.sharedThisTurn = false;
  }
  state.health = Math.min(state.maxHealth, state.health);
}

const EVENT_DESCRIPTIONS = {
  'Drought': { icon: '☀️', desc: 'The soil dries out. Water collection reduced for the next season.', severity: 'bad' },
  'Insect Swarm': { icon: '🐛', desc: 'Pests attack your leaves! Leaf clusters damaged.', severity: 'bad' },
  'Storm': { icon: '⛈️', desc: 'High winds snap branches. Trunk strength helps resist damage.', severity: 'bad' },
  'Fire': { icon: '🔥', desc: 'A wildfire sweeps through! Fire resistance and thick bark determine survival.', severity: 'critical' },
  'No major event': { icon: '✓', desc: 'The forest is calm this turn.', severity: 'good' }
};

function showEventPhase() {
  const major = state.turnInSeason === 3 ? rollMajorEvent() : 'No major event';
  const minors = rollMinorEvents();
  applyEventEffects(major, minors);
  updateScore();
  updateUI();
  render();

  const majorInfo = EVENT_DESCRIPTIONS[major] || EVENT_DESCRIPTIONS['No major event'];
  const majorClass = majorInfo.severity === 'critical' ? 'event-critical' : majorInfo.severity === 'bad' ? 'event-bad' : 'event-good';

  const minorHtml = minors.length
    ? `<div class="minor-events"><h4>Minor Events</h4><ul>${minors.map(e => `<li>${e}</li>`).join('')}</ul></div>`
    : '<p class="no-events">No minor events this turn.</p>';

  showModal('Event Phase', `
    <div class="event-major ${majorClass}">
      <div class="event-icon">${majorInfo.icon}</div>
      <div class="event-content">
        <h3>${major}</h3>
        <p>${majorInfo.desc}</p>
      </div>
    </div>
    ${minorHtml}
  `, advanceTurn);
}

function handleSpringViability() {
  if (state.seeds <= 0) return;
  let viable = 0;
  for (let i = 0; i < state.seeds; i++) {
    const chance = state.selectedSpecies === 'Plum' ? 0.65 : state.selectedSpecies === 'Oak' ? 0.45 : 0.35;
    if (Math.random() < chance) viable += 1;
  }
  state.viableSeeds += viable;
  state.offspringPool += viable;
  state.seeds = 0;
  addLog(`${viable} seeds proved viable this spring.`);
}

function advanceTurn() {
  if (state.health <= 0) return handleDeath();
  if (state.turnInSeason < 3) {
    state.turnInSeason += 1;
  } else {
    state.turnInSeason = 1;
    state.seasonIndex += 1;
    if (state.seasonIndex > 3) {
      state.seasonIndex = 0;
      state.year += 1;
    }
    if (currentSeason().name === 'Spring') handleSpringViability();
  }
  updateScore();
  updateUI();
  render();
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
    addLog('Your current tree died, but a viable offspring continues the lineage.');
    showModal('Succession', '<p>Your tree has died, but one offspring survives. You continue through the lineage.</p>', () => {
      updateScore(); updateUI(); render(); showResourcePhase();
    });
  } else {
    state.gameOver = true;
    showModal('Game Over', `<p>Your lineage has ended.</p><p>Final score: <strong>${state.score}</strong></p>`, () => {});
  }
}

function updateScore() {
  state.score = (state.year * 10) + (state.branches + state.rootZones + state.trunk) + (state.viableSeeds * 50) + (state.allies * 20);
}

function updateUI() {
  document.getElementById('score').textContent = state.score;
  document.getElementById('year').textContent = state.year;
  document.getElementById('season').textContent = currentSeason().name;
  document.getElementById('turn').textContent = state.turnInSeason;
  document.getElementById('sunlight').textContent = state.sunlight;
  document.getElementById('water').textContent = state.water;
  document.getElementById('nutrients').textContent = state.nutrients;
  document.getElementById('actions').textContent = state.actions;
  document.getElementById('leaf-clusters').textContent = state.leafClusters;
  document.getElementById('root-zones').textContent = state.rootZones;
  document.getElementById('branches').textContent = state.branches;
  document.getElementById('trunk').textContent = state.trunk;
  document.getElementById('flowers').textContent = state.flowers;
  document.getElementById('seeds').textContent = state.seeds;
  document.getElementById('allies').textContent = state.allies;
  document.getElementById('health').textContent = state.health;
  els.log.innerHTML = state.log.map(line => `<div class="log-entry">${line}</div>`).join('');

  const phasePill = document.getElementById('phase-indicator');
  if (phasePill) {
    phasePill.textContent = state.actions > 0 ? 'Action Phase' : 'Event Phase';
    phasePill.className = 'phase-pill ' + (state.actions > 0 ? 'phase-action' : 'phase-event');
  }

  const speciesBadge = document.getElementById('species-badge');
  if (speciesBadge && state.selectedSpecies) {
    const spec = SPECIES[state.selectedSpecies];
    const icons = { Redwood: '🌲', Plum: '🌳', Oak: '🌳' };
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
  const spec = isPlayer ? SPECIES[state.selectedSpecies] : (neighbor ? SPECIES[neighbor.species] : SPECIES.Oak);
  const scale = isPlayer ? 1 + state.trunk * 0.08 : (neighbor ? neighbor.age * 1.2 : 0.8);

  const leafClusters = isPlayer ? state.leafClusters : (neighbor ? neighbor.branches : 2);
  const trunk = isPlayer ? state.trunk : (neighbor ? neighbor.trunk : 1);
  const branches = isPlayer ? state.branches : (neighbor ? neighbor.branches : 2);
  const rootZones = isPlayer ? state.rootZones : (neighbor ? neighbor.roots : 2);

  const canopyR = (18 + leafClusters * 2) * scale;
  const trunkH = (60 + trunk * 10) * scale;
  const trunkW = (14 + trunk * 2) * scale;

  const treeColor = isPlayer ? '#1a1a1a' : (neighbor && neighbor.ally ? '#2a2a2a' : '#151515');
  ctx.fillStyle = treeColor;
  ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);

  for (let i = 0; i < Math.max(1, Math.min(branches, 8)); i++) {
    const y = groundY - trunkH + 20 + i * 8;
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * (24 + i * 4) * scale, y - (10 + i * 2) * scale);
    ctx.strokeStyle = treeColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(x, groundY - trunkH - canopyR * 0.3, canopyR, canopyR * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < Math.max(2, Math.min(rootZones, 8)); i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + dir * (18 + i * 10) * scale, groundY + (25 + i * 16) * scale);
    ctx.strokeStyle = isPlayer ? '#1a1a1a' : '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (!isPlayer && neighbor) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const label = neighbor.ally ? `${neighbor.species} (ally)` : neighbor.species;
    ctx.fillText(label, x, groundY + 110);
  }
}

els.startGame.addEventListener('click', startGame);
initSpeciesSelect();
render();
