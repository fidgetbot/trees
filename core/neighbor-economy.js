import { awaitIncidentResponse, findActiveIncident, resolveIncident } from './incidents.js?rev=structured-event-outcomes-v1';

export const NEIGHBOR_BUFFER = 4;
export const NEIGHBOR_CAPACITY = 16;
export const NEIGHBOR_RESOURCES = ['sunlight', 'water', 'nutrients'];
const PASSIVE_SHARED_RESOURCES = ['water', 'nutrients'];

// Old games acquire finite reserves once, never on each request or gathering.
export function ensureNeighborEconomy(neighbor) {
  neighbor.maxHealth ??= 10;
  neighbor.health ??= neighbor.maxHealth;
  neighbor.activeCrises ||= [];
  if (!neighbor.reserves) {
    neighbor.reserves = { sunlight: 12, water: 12, nutrients: 12 };
    neighbor.strains = { sunlight: 0, water: 0, nutrients: 0 };
    for (const crisis of neighbor.activeCrises) {
      if (!NEIGHBOR_RESOURCES.includes(crisis.kind)) continue;
      neighbor.reserves[crisis.kind] = 0;
      neighbor.strains[crisis.kind] = 4;
    }
  }
  neighbor.strains ||= { sunlight: 0, water: 0, nutrients: 0 };
  for (const kind of NEIGHBOR_RESOURCES) {
    if (neighbor.reserves[kind] == null) neighbor.reserves[kind] = 12;
    neighbor.reserves[kind] = Math.max(0, Math.min(NEIGHBOR_CAPACITY, Number(neighbor.reserves[kind]) || 0));
    neighbor.strains[kind] ||= 0;
  }
  neighbor.shortageTurns ||= 0;
  neighbor.aidGrace ||= 0;
  neighbor.crisisCounter ||= 0;
  neighbor.lastAidRequestTurns ||= { sunlight: -100, water: -100, nutrients: -100 };
  for (const kind of NEIGHBOR_RESOURCES) neighbor.lastAidRequestTurns[kind] ??= -100;
  neighbor.hardshipCooldown ||= 0;
  for (const key of ['helpGivenToThem', 'helpRefusedToThem', 'helpReceivedFromThem', 'timesAskedThemForHelp']) neighbor[key] ||= 0;
  return neighbor;
}

export function neighborSurplus(neighbor, kind) {
  ensureNeighborEconomy(neighbor);
  if (neighbor.dead || !NEIGHBOR_RESOURCES.includes(kind) || neighbor.activeCrises.some(c => c.kind === kind)) return 0;
  // Retain enough to weather the rest of a known shortage, not merely today's upkeep.
  const buffer = 6 + Math.min(8, neighbor.strains[kind] * 2);
  return Math.max(0, Math.floor(neighbor.reserves[kind] - buffer));
}

export function neighborHelpAvailable(state, neighbor, kind, getNeighborStage = () => ({ rank: 1 })) {
  if (!neighbor || neighbor.dead || !['health', ...NEIGHBOR_RESOURCES].includes(kind)) return 0;
  const cap = Math.min(6, Math.max(1, (getNeighborStage(neighbor.stageScore).rank || 0) + 1));
  if (kind === 'health') {
    ensureNeighborEconomy(neighbor);
    if (neighbor.health <= neighbor.maxHealth / 2) return 0;
    return Math.max(0, Math.min(cap, state.maxHealth - state.health, neighborSurplus(neighbor, 'water'), neighborSurplus(neighbor, 'nutrients')));
  }
  return Math.min(cap, neighborSurplus(neighbor, kind));
}

export function neighborGrowthFactor(neighbor) {
  ensureNeighborEconomy(neighbor);
  const minimum = Math.min(...NEIGHBOR_RESOURCES.map(kind => neighbor.reserves[kind]));
  return minimum === 0 ? 0 : minimum < NEIGHBOR_BUFFER ? 0.5 : 1;
}

export function collectRootDominionTransfer(neighbor) {
  if (!neighbor || neighbor.dead || !neighbor.playerRootDominated) return { water: 0, nutrients: 0 };
  ensureNeighborEconomy(neighbor);
  const water = Math.min(1, neighbor.reserves.water);
  const nutrients = Math.min(1, neighbor.reserves.nutrients);
  neighbor.reserves.water -= water;
  neighbor.reserves.nutrients -= nutrients;
  return { water, nutrients };
}

export function applyNeighborAid(neighbor, kind, amount) {
  ensureNeighborEconomy(neighbor);
  const received = Math.min(Math.max(0, Math.floor(amount)), NEIGHBOR_CAPACITY - neighbor.reserves[kind]);
  if (!received) return 0;
  neighbor.reserves[kind] += received;
  neighbor.aidGrace = Math.max(neighbor.aidGrace, received >= 3 ? 2 : 1);
  neighbor.shortageTurns = Math.max(0, neighbor.shortageTurns - received);
  neighbor.activeCrises = neighbor.activeCrises.filter(crisis => crisis.kind !== kind || neighbor.reserves[kind] < NEIGHBOR_BUFFER);
  for (const crisis of neighbor.activeCrises) if (crisis.kind === kind) crisis.amount = Math.max(1, 6 - neighbor.reserves[kind]);
  return received;
}

// A single real budget funds both passive sharing and explicit requests.
export function collectNeighborDonations(state, getRelationshipState, getNeighborStage, needed = { water: Infinity, nutrients: Infinity }) {
  const gains = { water: 0, nutrients: 0 };
  for (const neighbor of state.neighbors || []) {
    if (neighbor.dead || getRelationshipState(neighbor.relation).name !== 'Ally') continue;
    ensureNeighborEconomy(neighbor);
    const rank = getNeighborStage(neighbor.stageScore).rank || 0;
    const limit = rank >= 4 ? 2 : rank >= 2 ? 1 : 0;
    for (const kind of PASSIVE_SHARED_RESOURCES) {
      // Passive support is deliberately conservative. Explicit requests may
      // draw farther down to the safe reserve, so allies retain useful help
      // instead of donating every available unit before the action phase.
      const passiveSurplus = Math.max(0, Math.floor(neighbor.reserves[kind] - 10));
      const amount = Math.max(0, Math.min(limit, passiveSurplus, needed[kind] - gains[kind]));
      neighbor.reserves[kind] -= amount;
      gains[kind] += amount;
    }
  }
  return gains;
}

const WEATHER_STRAINS = {
  Drought: { water: 4 }, Herbivores: { nutrients: 3 }, FungalBlight: { nutrients: 4 },
  Fire: { water: 3, nutrients: 3 }, Wildfire: { water: 3, nutrients: 3 },
  LateFrost: { sunlight: 2, nutrients: 2 }, Storm: { sunlight: 1, nutrients: 2 }, WinterStorm: { sunlight: 2, nutrients: 2 },
};

export function advanceNeighborEcology(state, { majorKey, getRelationshipState, getNeighborStage, random = Math.random, onDeath } = {}) {
  const turn = state.turnsElapsed || 0;
  if (state.neighborEcologyTurn === turn) return [];
  state.neighborEcologyTurn = turn;
  const events = [];
  for (const neighbor of state.neighbors || []) {
    if (neighbor.dead) continue;
    ensureNeighborEconomy(neighbor);
    for (const incident of state.incidents || []) {
      if (incident.kind !== 'ally-aid' || ['resolved', 'expired'].includes(incident.state) || incident.response?.neighborSlot !== neighbor.slot) continue;
      if (!neighbor.activeCrises.some(c => c.id === incident.response.crisisId)) resolveIncident(state, incident.id, { summary: `The ${neighbor.species} has replenished the requested reserve. The shortage has passed.` });
      else if (getRelationshipState(neighbor.relation).name !== 'Ally') resolveIncident(state, incident.id, { summary: 'The alliance has ended. The tree continues its own recovery.' });
    }
    const rank = getNeighborStage(neighbor.stageScore).rank || 0;
    const subject = { type: 'neighbor', species: neighbor.species, slot: neighbor.slot, stageName: getNeighborStage(neighbor.stageScore).name };
    for (const [kind, duration] of Object.entries(WEATHER_STRAINS[majorKey] || {})) neighbor.strains[kind] = Math.max(neighbor.strains[kind], duration);
    neighbor.hardshipCooldown = Math.max(0, neighbor.hardshipCooldown - 1);
    if (!neighbor.hardshipCooldown && !NEIGHBOR_RESOURCES.some(kind => neighbor.strains[kind]) && random() < 0.04) {
      const kind = NEIGHBOR_RESOURCES[Math.min(NEIGHBOR_RESOURCES.length - 1, Math.floor(random() * NEIGHBOR_RESOURCES.length))];
      neighbor.strains[kind] = 6;
      neighbor.hardshipCooldown = 16;
    }
    const income = rank >= 4 ? 4 : 3;
    for (const kind of NEIGHBOR_RESOURCES) {
      const shadeCost = neighbor.playerShading ? (kind === 'sunlight' ? 2 : kind === 'nutrients' ? 1 : 0) : 0;
      const net = (neighbor.strains[kind] > 0 ? -2 : income - 2) - shadeCost;
      neighbor.reserves[kind] = Math.max(0, Math.min(NEIGHBOR_CAPACITY, neighbor.reserves[kind] + net));
      neighbor.strains[kind] = Math.max(0, neighbor.strains[kind] - 1);
    }
    const empty = NEIGHBOR_RESOURCES.some(kind => neighbor.reserves[kind] === 0);
    neighbor.shortageTurns = empty ? neighbor.shortageTurns + 1 : 0;
    const grace = neighbor.aidGrace > 0;
    neighbor.aidGrace = Math.max(0, neighbor.aidGrace - 1);
    if (empty && neighbor.shortageTurns >= 3 && !grace) neighbor.health = Math.max(0, neighbor.health - 1);
    else if (neighborGrowthFactor(neighbor) === 1) neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + 1);

    // Resolve recovered requests even after diplomacy changes the relationship.
    for (const crisis of [...neighbor.activeCrises]) {
      if (!NEIGHBOR_RESOURCES.includes(crisis.kind) || neighbor.reserves[crisis.kind] >= NEIGHBOR_BUFFER) {
        neighbor.activeCrises = neighbor.activeCrises.filter(c => c !== crisis);
        const incident = findActiveIncident(state, 'ally-aid', i => i.response?.neighborSlot === neighbor.slot && i.response?.crisisId === crisis.id);
        if (incident) resolveIncident(state, incident.id, { summary: `The ${neighbor.species} has replenished its reserves. The shortage has passed.` });
        events.push({ title: `${neighbor.species} recovers`, text: `Its ${crisis.kind} reserves recover.${neighborGrowthFactor(neighbor) === 1 ? ' Normal growth resumes.' : ' Other shortages still slow its growth.'}`, effect: 'recovery', subject });
      }
    }
    if (neighbor.health <= 0) {
      const deathReported = onDeath?.(neighbor, 'prolonged resource shortage');
      for (const incident of state.incidents || []) {
        if (incident.response?.neighborSlot === neighbor.slot && !['resolved', 'expired'].includes(incident.state)) resolveIncident(state, incident.id, { summary: `The ${neighbor.species} dies, ending this incident.` });
      }
      neighbor.dead = true;
      neighbor.deathAge = 0;
      neighbor.deathStageScore = neighbor.stageScore;
      neighbor.deathCause = 'prolonged resource shortage';
      neighbor.activeCrises = [];
      neighbor.playerShading = neighbor.shadingPlayer = neighbor.playerRootDominated = false;
      if (!deathReported) events.push({ title: `${neighbor.species} lost`, text: 'After prolonged shortages, the tree can no longer sustain its living tissue.', effect: 'damage', subject });
      continue;
    }
    for (const kind of NEIGHBOR_RESOURCES) {
      if (neighbor.reserves[kind] >= NEIGHBOR_BUFFER) continue;
      let crisis = neighbor.activeCrises.find(c => c.kind === kind);
      if (!crisis) {
        const title = kind === 'sunlight' ? 'Dimmed crown' : kind === 'water' ? 'Dry roots' : 'Lean soil';
        crisis = { id: `reserve-${neighbor.slot}-${++neighbor.crisisCounter}`, kind, title, stage: 0, healthLoss: 1, lastAskedTurn: -100, flavors: [`The ${neighbor.species} is drawing down its ${kind} reserves. Growth slows while it recovers.`] };
        neighbor.activeCrises.push(crisis);
      }
      crisis.amount = 6 - neighbor.reserves[kind];
      crisis.stage += 1;
      if (turn - Math.max(crisis.lastAskedTurn ?? -100, neighbor.lastAidRequestTurns[kind] ?? -100) < 3) continue;
      crisis.lastAskedTurn = turn;
      neighbor.lastAidRequestTurns[kind] = turn;
      const allied = getRelationshipState(neighbor.relation).name === 'Ally';
      const text = neighbor.shortageTurns >= 2
        ? `The ${neighbor.species} has exhausted its ${kind}. Continued shortage threatens its health; its tissues are still working to recover.`
        : crisis.flavors[0];
      const event = { kind: allied ? 'ally-aid' : 'neighbor-stress', title: `${neighbor.species}: ${crisis.title}`, text, effect: 'warning', subject };
      if (allied) {
        event.response = { kind: 'ally-aid', neighborSlot: neighbor.slot, crisisId: crisis.id };
        const existing = findActiveIncident(state, 'ally-aid', i => i.response?.neighborSlot === neighbor.slot && i.response?.crisisId === crisis.id);
        if (existing) {
          awaitIncidentResponse(state, existing.id, event);
          event.existingIncidentId = existing.id;
        }
      }
      events.push(event);
    }
  }
  return events;
}
