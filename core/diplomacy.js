import { applyNeighborAid, ensureNeighborEconomy, neighborHelpAvailable } from './neighbor-economy.js?rev=mature-grove-v1';
import { createDecision, findDecisionOption } from './decisions.js?rev=seasonal-canopy-v1';
import { findActiveIncident, migrateLegacyIncidentState, resolveIncident } from './incidents.js?rev=structured-event-outcomes-v1';
import { canPlayerShadeNeighbor, getShadedOffspring, neighborHeightLevel, playerHeightLevel, setPlayerRootDominionTarget, setPlayerShadeTarget, ROOT_DOMINION_NUTRIENT_BONUS, ROOT_DOMINION_WATER_BONUS, SHADE_NUTRIENT_BONUS, SHADE_SUNLIGHT_BONUS, SHADED_NEIGHBOR_GROWTH_MULTIPLIER } from './growth.js?rev=mature-grove-v1';

export const SAME_SPECIES_CONNECTION_BONUS = 0.15;

export const CONNECTION_AGE_BANDS = [
  {
    key: 'young',
    label: 'Young trees',
    maxRank: 2,
    chanceBonus: 0.15,
    description: 'Easiest to befriend (+15 percentage points). They share less at first, but can grow alongside you.',
  },
  {
    key: 'established',
    label: 'Established trees',
    maxRank: 4,
    chanceBonus: 0.07,
    description: 'A smaller advantage than young trees (+7 percentage points), with meaningful support available sooner.',
  },
  {
    key: 'mature',
    label: 'Mature trees',
    maxRank: Number.POSITIVE_INFINITY,
    chanceBonus: 0,
    description: 'Hardest to befriend, but capable of sharing the most water and nutrients.',
  },
];

export function getConnectionAgeBand(stageRank = 0) {
  return CONNECTION_AGE_BANDS.find(band => stageRank <= band.maxRank) || CONNECTION_AGE_BANDS.at(-1);
}

export function applyRelationshipDelta(state, neighbor, delta, getAdjustedRelationshipDelta) {
  const adjustedDelta = getAdjustedRelationshipDelta(state, delta);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjustedDelta));
  if (neighbor.relation >= 0) {
    neighbor.playerShading = false;
    neighbor.shadingPlayer = false;
    neighbor.playerRootDominated = false;
  }
  return adjustedDelta;
}

export function updateAlliesCount(state, getRelationshipState) {
  state.alliedNeighbors = state.neighbors.filter(n => !n.dead && getRelationshipState(n.relation).name === 'Ally').length;
  if (state.alliedNeighbors > 0) state.hasMadeFirstAlly = true;
  if (Array.isArray(state.offspringRecords)) state.offspringTrees = state.offspringRecords.filter(child => !child.dead).length;
  state.allies = state.alliedNeighbors + state.offspringTrees;
  return state.allies;
}

export function markNeighborDead(state, neighbor, cause = 'hardship', deps = {}) {
  const { getRelationshipState = () => ({ name: 'Neutral' }) } = deps;
  if (!neighbor || neighbor.dead || neighbor.health > 0) return { changed: false };
  const relationship = getRelationshipState(neighbor.relation).name;
  neighbor.health = 0;
  neighbor.dead = true;
  neighbor.ally = false;
  neighbor.activeCrises = [];
  neighbor.playerShading = false;
  neighbor.shadingPlayer = false;
  neighbor.playerRootDominated = false;
  neighbor.deathCause = cause;
  return { changed: true, relationship, cause };
}

export function compareConflictPower(state, neighbor, getNeighborStage) {
  const yourPower = state.defense + state.rootZones + state.branches + state.trunk + Math.floor(state.leafClusters / 2);
  const neighborStage = getNeighborStage(neighbor.stageScore).rank + 1;
  const theirPower = neighborStage * 2 + Math.max(0, Math.floor(-neighbor.relation / 20));
  return { yourPower, theirPower };
}

export function resolveAidToAlly(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    getAdjustedRelationshipDelta = (_state, delta) => delta,
    paidCost = { sunlight: 0, water: 0, nutrients: 0 },
  } = deps;

  ensureNeighborEconomy(neighbor);
  const oldState = getRelationshipState(neighbor.relation).name;
  const crisis = (neighbor.activeCrises || [])[0] || null;

  if (oldState !== 'Ally') {
    return {
      ok: false,
      oldState,
      newState: oldState,
      crisis,
      paidCost,
      reason: 'not-an-ally',
    };
  }
  if (neighbor.health >= neighbor.maxHealth && !crisis) {
    return {
      ok: false,
      oldState,
      newState: oldState,
      crisis,
      paidCost,
      reason: 'full-health',
    };
  }

  neighbor.helpGivenToThem += 1;
  neighbor.growthAidReceived = (neighbor.growthAidReceived || 0) + 1;
  if (neighbor.firstAidStageScore == null) neighbor.firstAidStageScore = neighbor.stageScore;
  neighbor.stageScore += crisis ? 120 : 180;
  neighbor.lastAidMemory = 'you-gave-freely';
  const adjusted = getAdjustedRelationshipDelta(state, crisis ? 10 : 8);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjusted));
  neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + (crisis ? 3 : 2));
  applyNeighborAid(neighbor, 'sunlight', paidCost.sunlight || 0);
  applyNeighborAid(neighbor, 'water', paidCost.water || 0);
  applyNeighborAid(neighbor, 'nutrients', paidCost.nutrients || 0);
  const crisisResolved = !!crisis && !neighbor.activeCrises.some(c => c.id === crisis.id);
  const newState = getRelationshipState(neighbor.relation).name;

  return {
    ok: true,
    crisisResolved,
    oldState,
    newState,
    crisis,
    paidCost,
  };
}

export function resolveHelpRequestFromAlly(state, neighbor, deps = {}) {
  migrateLegacyIncidentState(state);
  const {
    getRelationshipState,
    getAdjustedRelationshipDelta = (_state, delta) => delta,
    getNeighborStage = () => ({ rank: 1 }),
    random = Math.random,
    requestKind = 'health',
  } = deps;

  ensureNeighborEconomy(neighbor);
  const available = getRelationshipState(neighbor.relation).name === 'Ally'
    ? neighborHelpAvailable(state, neighbor, requestKind, getNeighborStage) : 0;
  if (!available) return {
    ok: false, reason: 'no-surplus', requestKind, actualAmount: 0, actualHeal: 0,
    oldState: getRelationshipState(neighbor.relation).name,
    newState: getRelationshipState(neighbor.relation).name,
    tone: `The ${neighbor.species} cannot safely spare ${requestKind}. Its survival reserves stay intact.`,
    clearedThreat: null, threatStatus: null,
  };
  neighbor.timesAskedThemForHelp += 1;
  const favorBalance = neighbor.helpGivenToThem - neighbor.timesAskedThemForHelp;
  const relationShift = favorBalance < -2 ? -2 : 0;
  const tone = favorBalance < -2
    ? `The ${neighbor.species} shares its surplus, but repeated one-sided requests are straining the bond.`
    : `The ${neighbor.species} shares its surplus while keeping reserves for its own recovery.`;
  const actualAmount = available;
  if (requestKind === 'health') {
    neighbor.reserves.water -= actualAmount;
    neighbor.reserves.nutrients -= actualAmount;
    state.health += actualAmount;
  } else {
    neighbor.reserves[requestKind] -= actualAmount;
    state[requestKind] = (state[requestKind] || 0) + actualAmount;
  }

  const threatIncident = requestKind === 'health'
    ? findActiveIncident(state, 'chemical-threat', incident => incident.state === 'ongoing')
    : null;
  const clearedThreat = threatIncident
    ? { title: threatIncident.title, warning: threatIncident.summary }
    : null;
  if (clearedThreat) {
    resolveIncident(state, threatIncident.id, { title: threatIncident.title, summary: 'Allied support clears the threat before it can spread.' });
  }
  neighbor.helpReceivedFromThem += 1;
  const oldState = getRelationshipState(neighbor.relation).name;
  const adjusted = getAdjustedRelationshipDelta(state, relationShift);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjusted));
  const newState = getRelationshipState(neighbor.relation).name;
  neighbor.lastAidMemory = actualAmount > 0 || clearedThreat ? 'helped-you' : 'could-not-help';

  return {
    oldState,
    newState,
    tone,
    requestKind,
    actualAmount,
    actualHeal: requestKind === 'health' ? actualAmount : 0,
    clearedThreat,
    threatStatus: clearedThreat ? 'solved' : null,
  };
}

export function buildConnectionDecision(state, deps = {}) {
  const { getRelationshipState, getNeighborStage = () => ({ name: 'Unknown', rank: 0 }) } = deps;

  return createDecision({
    kind: 'connection',
    title: 'Reach toward which neighbor?',
    body: 'Choose a neighboring tree to contact through the soil. Rejection can cost health or resources.',
    options: state.neighbors
      .map((neighbor, targetIndex) => ({ neighbor, targetIndex }))
      .filter(({ neighbor }) => !neighbor.dead)
      .sort((left, right) => getNeighborStage(left.neighbor.stageScore).rank - getNeighborStage(right.neighbor.stageScore).rank)
      .map(({ neighbor, targetIndex }) => {
        const relationName = getRelationshipState(neighbor.relation).name;
        const stage = getNeighborStage(neighbor.stageScore);
        const ageBand = getConnectionAgeBand(stage.rank);
        const risk = relationName === 'Rival' || relationName === 'Hostile'
          ? 'Its present hostility makes contact risky.'
          : relationName === 'Ally'
            ? 'Renewing contact strengthens an existing bond.'
            : '';
        const relationshipHint = relationName === 'Friendly'
          ? 'Already friendly, it is more likely to welcome your roots and move toward allyship.'
          : '';
        const affinity = state.selectedSpecies === neighbor.species && relationName !== 'Ally'
          ? ` As another ${neighbor.species}, it is more likely to accept your roots.`
          : '';
        return {
          id: `neighbor-${targetIndex}`,
          label: `${neighbor.species} — ${stage.name} · ${relationName}`,
          description: `${risk}${relationshipHint ? ` ${relationshipHint}` : ''}${affinity}`.trim() || null,
          group: ageBand.label,
          groupDescription: ageBand.description,
          groupOrder: CONNECTION_AGE_BANDS.indexOf(ageBand),
          targetIndex,
          meta: {
            species: neighbor.species,
            relationName,
            canStrengthenAlliance: relationName === 'Ally',
            isRisky: relationName === 'Rival' || relationName === 'Hostile',
            sameSpeciesAffinity: state.selectedSpecies === neighbor.species,
            ageBand: ageBand.key,
            ageBonus: ageBand.chanceBonus,
          },
        };
      }),
  });
}

export function buildAidDecision(state, deps = {}) {
  const {
    getRelationshipState,
    paidCost = { sunlight: 0, water: 0, nutrients: 0 },
  } = deps;

  return createDecision({
    kind: 'ally-aid',
    title: 'Offer aid to which ally?',
    body: 'Choose an allied tree to heal and help grow. Repeated support strengthens the bond and can qualify the tree for the protected-grove goal.',
    options: state.neighbors
      .map((neighbor, targetIndex) => ({ neighbor, targetIndex }))
      .filter(({ neighbor }) => !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally' && (neighbor.health < neighbor.maxHealth || neighbor.activeCrises?.length))
      .map(({ neighbor, targetIndex }) => {
        const crisis = (neighbor.activeCrises || [])[0] || null;
        ensureNeighborEconomy(neighbor);
        const needs = (neighbor.activeCrises || []).map(active => active.title || active.kind).join(', ');
        const condition = needs
          ? `Needs help with ${needs}.`
          : neighbor.health < neighbor.maxHealth
            ? `Recovering from injury at ${neighbor.health}/${neighbor.maxHealth} health.`
            : 'Stable and growing normally.';
        return {
          id: `neighbor-${targetIndex}`,
          label: `${neighbor.species} — Ally`,
          description: `${condition} Reserves: ${neighbor.reserves.sunlight} sunlight, ${neighbor.reserves.water} water, ${neighbor.reserves.nutrients} nutrients.`,
          targetIndex,
          affordable: true,
          meta: {
            species: neighbor.species,
            relationName: 'Ally',
            crisis,
            paidCost,
          },
        };
      }),
  });
}

export function buildHelpRequestDecision(state, deps = {}) {
  const {
    getRelationshipState,
    getNeighborStage = () => ({ rank: 1 }),
    requestKind = null,
  } = deps;

  const requestKinds = requestKind ? [requestKind] : ['health', 'sunlight', 'water', 'nutrients'];
  const kindLabel = kind => kind === 'health' ? 'health' : kind;
  const kindTitle = kind => kindLabel(kind).replace(/^./, letter => letter.toUpperCase());
  const kindIcon = kind => ({ health: '❤️', sunlight: '☀️', water: '💧', nutrients: '🌱' })[kind] || '';

  return createDecision({
    kind: 'ally-help-request',
    title: 'Ask an ally for help',
    body: requestKind
      ? `Choose which allied tree you will ask for ${requestKind}. Each transfer uses one action, with no resource fee. The donor keeps its survival reserves.${requestKind === 'health' ? ' Each health restored uses one donor water and one donor nutrient.' : ''} Unavailable requests cost nothing.`
      : '',
    options: state.neighbors
      .map((neighbor, targetIndex) => ({ neighbor, targetIndex }))
      .filter(({ neighbor }) => !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally')
      .flatMap(({ neighbor, targetIndex }) => requestKinds.map(kind => {
        const available = neighborHelpAvailable(state, neighbor, kind, getNeighborStage);
        const favorBalance = neighbor.helpGivenToThem - neighbor.timesAskedThemForHelp;
        const stageBonus = Math.max(0, getNeighborStage(neighbor.stageScore).rank - 1);
        let toneHint = 'steady';
        if (favorBalance < -2) toneHint = 'strained';
        else if (neighbor.helpGivenToThem > neighbor.helpRefusedToThem) toneHint = 'warm';
        return {
          id: requestKind ? `neighbor-${targetIndex}` : `neighbor-${targetIndex}-${kind}`,
          label: requestKind
            ? `${neighbor.species} — ${available ? `${available} ${kindLabel(kind)} available` : `cannot spare ${kindLabel(kind)}`}`
            : `${kindIcon(kind)} ${kindTitle(kind)} — ${available ? `${available} ${kindLabel(kind)} available to share` : `cannot spare ${kindLabel(kind)}`}`,
          description: available ? null : `Its own ${kindLabel(kind)} needs come first; check again after it replenishes.`,
          group: requestKind ? null : `${neighbor.species} Ally`,
          groupDescription: requestKind ? null : `Health ${neighbor.health}/${neighbor.maxHealth} · reserves ${neighbor.reserves?.sunlight ?? 12} sunlight, ${neighbor.reserves?.water ?? 12} water, ${neighbor.reserves?.nutrients ?? 12} nutrients`,
          groupOrder: targetIndex,
          disabled: available <= 0,
          affordable: available > 0,
          targetIndex,
          meta: {
            species: neighbor.species,
            relationName: 'Ally',
            favorBalance,
            stageBonus,
            toneHint,
            requestKind: kind,
          },
        };
      })),
  });
}

export function resolveConnectionAttempt(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    getAdjustedRelationshipDelta = (_state, delta) => delta,
    getNeighborStage = () => ({ rank: 0 }),
    recordDamage = () => {},
    random = Math.random,
  } = deps;

  const rootBonus = Math.min(0.35, Math.max(0, state.rootZones - 2) * 0.08);
  const oldState = getRelationshipState(neighbor.relation).name;
  const ageBand = getConnectionAgeBand(getNeighborStage(neighbor.stageScore).rank);
  const sameSpeciesAffinity = state.selectedSpecies === neighbor.species;
  const affinityBonus = sameSpeciesAffinity && oldState !== 'Ally' ? SAME_SPECIES_CONNECTION_BONUS : 0;
  const ageBonus = oldState !== 'Ally' ? ageBand.chanceBonus : 0;
  const favorableBonus = affinityBonus + ageBonus;
  const breakthroughBonus = favorableBonus / 3;
  const roll = random();
  let message = '';
  let feedback = { text: '', type: 'info' };

  const applyDelta = (delta) => {
    const adjusted = getAdjustedRelationshipDelta(state, delta);
    neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjusted));
    return adjusted;
  };

  if (oldState === 'Ally') {
    applyDelta(10);
    message = `Your roots find the familiar touch of the ${neighbor.species}. Resources and signals pass warmly between you.`;
    feedback = { text: `${neighbor.species} strengthens your alliance`, type: 'success' };
  } else if (oldState === 'Friendly') {
    const breakthroughChance = 0.12 + (rootBonus * 0.35) + breakthroughBonus;
    const successChance = Math.min(0.99, 0.64 + rootBonus + favorableBonus);
    if (roll < breakthroughChance) {
      applyDelta(42);
      message = `Something clicks beneath the soil. The ${neighbor.species} opens itself to you all at once, and the two of you braid roots in sudden trust.`;
      feedback = { text: `${neighbor.species} embraced an immediate alliance`, type: 'success' };
    } else if (roll < successChance) {
      applyDelta(22);
      message = `The ${neighbor.species} answers your overture with quiet warmth, opening more of its root network to you.`;
      feedback = { text: `${neighbor.species} welcomed your roots`, type: 'success' };
    } else if (roll < 0.90) {
      applyDelta(-4);
      message = `The ${neighbor.species} hesitates. It does not reject you, but keeps part of itself withheld.`;
      feedback = { text: `${neighbor.species} grew cautious`, type: 'info' };
    } else {
      applyDelta(-18);
      message = `The ${neighbor.species} recoils from your reach, and the warmth between you drains away in an instant.`;
      feedback = { text: `${neighbor.species} turned sharply away`, type: 'error' };
    }
  } else if (oldState === 'Neutral') {
    const breakthroughChance = 0.10 + (rootBonus * 0.3) + breakthroughBonus;
    const successChance = Math.min(0.99, 0.52 + rootBonus + favorableBonus);
    if (roll < breakthroughChance) {
      applyDelta(55);
      message = `Against all expectation, the ${neighbor.species} answers with immediate warmth. Your tentative greeting becomes a full fungal bond almost at once.`;
      feedback = { text: `${neighbor.species} formed an immediate alliance`, type: 'success' };
    } else if (roll < successChance) {
      applyDelta(20);
      message = `The ${neighbor.species} pauses, then accepts your tentative underground greeting.`;
      feedback = { text: `${neighbor.species} responded cautiously`, type: 'success' };
    } else if (roll < 0.82) {
      applyDelta(3);
      message = `The ${neighbor.species} senses you, but offers little in return. For now, the soil remains politely quiet.`;
      feedback = { text: `${neighbor.species} mostly ignored you`, type: 'info' };
    } else {
      applyDelta(-18);
      message = `The ${neighbor.species} interprets your reach as intrusion and releases a bitter pulse through the soil.`;
      state.health = Math.max(0, state.health - 1);
      recordDamage(1, 'chemicals');
      feedback = { text: `${neighbor.species} rebuffed you hard`, type: 'error' };
    }
  } else if (oldState === 'Rival') {
    if (roll < 0.12 + rootBonus + breakthroughBonus) {
      applyDelta(32);
      message = `After a tense silence, the ${neighbor.species} relents more than you expected. The rivalry cracks and something calmer pushes through.`;
      feedback = { text: `${neighbor.species} softened unexpectedly`, type: 'success' };
    } else if (roll < Math.min(0.99, 0.32 + rootBonus + favorableBonus)) {
      applyDelta(18);
      message = `After a tense silence, the ${neighbor.species} relents. The rivalry softens, if only a little.`;
      feedback = { text: `${neighbor.species} softened`, type: 'success' };
    } else {
      applyDelta(-12);
      message = `The ${neighbor.species} answers with defensive chemistry, warning you that the rivalry is still alive.`;
      state.health = Math.max(0, state.health - 1);
      recordDamage(1, 'chemicals');
      state.nutrients = Math.max(0, state.nutrients - 1);
      feedback = { text: `${neighbor.species} retaliated`, type: 'error' };
    }
  } else if (oldState === 'Hostile') {
    if (roll < Math.min(0.99, 0.06 + rootBonus + favorableBonus)) {
      applyDelta(30);
      message = `Against all expectation, the ${neighbor.species} does not strike. Its hatred cools, though distrust still lingers.`;
      feedback = { text: `${neighbor.species} cooled slightly`, type: 'success' };
    } else {
      applyDelta(-8);
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
  if (newState === 'Neutral' || newState === 'Friendly' || newState === 'Ally') {
    neighbor.playerShading = false;
    neighbor.shadingPlayer = false;
    neighbor.playerRootDominated = false;
  }

  return {
    oldState,
    newState,
    message,
    feedback,
    sameSpeciesAffinity,
    affinityBonus,
    ageBand: ageBand.key,
    ageBonus,
    favorableBonus,
  };
}

export function buildAggressionDecision(state, kind, deps = {}) {
  const { getRelationshipState, getNeighborStage = () => ({ rank: 0 }) } = deps;

  const options = state.neighbors
    .map((neighbor, targetIndex) => ({ neighbor, targetIndex }))
    .filter(({ neighbor }) => !neighbor.dead && (kind !== 'shade' || neighbor.slot === 1 || neighbor.slot === 3))
    .map(({ neighbor, targetIndex }) => {
      const relationName = getRelationshipState(neighbor.relation).name;
      const alreadyContested = relationName === 'Rival' || relationName === 'Hostile';
      const requiresWarning = relationName === 'Friendly' || relationName === 'Ally';
      const shadeAllowed = kind !== 'shade' || canPlayerShadeNeighbor(state, neighbor, getNeighborStage);
      const playerHeight = playerHeightLevel(state);
      const targetHeight = kind === 'shade' ? neighborHeightLevel(neighbor, getNeighborStage) : null;
      const heightNeeded = kind === 'shade' ? Math.max(0, targetHeight - playerHeight + 1) : 0;
      const shadedOffspring = kind === 'shade' ? getShadedOffspring(state, neighbor) : [];
      const preview = kind === 'shade'
        ? {
            sunlight: 0,
            water: 0,
            nutrients: 0,
            relationShift: alreadyContested ? 'press rivalry' : 'start rivalry',
            persistent: `+${SHADE_SUNLIGHT_BONUS} sunlight and +${SHADE_NUTRIENT_BONUS} nutrient each turn; slows the neighbor's growth`,
          }
        : {
            sunlight: alreadyContested ? 1 : 0,
            water: 1,
            nutrients: 1,
            relationShift: alreadyContested ? 'press rivalry' : 'start rivalry',
            persistent: `up to +${ROOT_DOMINION_WATER_BONUS} water and +${ROOT_DOMINION_NUTRIENT_BONUS} nutrient each turn, taken from this tree's real reserves`,
          };

      return {
        id: `neighbor-${targetIndex}`,
        label: kind === 'shade'
          ? `${neighbor.species} — ${relationName}`
          : `${neighbor.species} — ${relationName}`,
        description: kind === 'shade'
          ? (neighbor.playerShading
              ? `Currently shaded. Choose Stop Shading to release this tree and offspring on its side.`
              : shadeAllowed
              ? `Shorter than you — can be shaded.${shadedOffspring.length ? ` Warning: ${shadedOffspring.length} offspring on this side will also lose light.` : ''}`
              : `You'd need to grow taller first.${heightNeeded > 1 ? ` (${heightNeeded} height levels)` : ''}`)
          : (neighbor.playerRootDominated
              ? 'Currently dominated. Choose Stop Root Dominion to release this tree’s roots.'
              : `Establishes an ongoing contested root zone. Choosing a new target releases the current one.`),
        disabled: kind === 'shade'
          ? (!shadeAllowed || neighbor.playerShading)
          : Boolean(neighbor.playerRootDominated),
        targetIndex,
        requiresConfirmation: requiresWarning || shadedOffspring.length > 0,
        confirmation: requiresWarning || shadedOffspring.length > 0 ? {
          title: shadedOffspring.length ? 'Shade your offspring too?' : 'Escalate against this tree?',
          body: `${requiresWarning ? `<p><em>The ${neighbor.species} is currently ${relationName.toLowerCase()} toward you.</em></p><p>If you attack now, it will immediately become a <strong>Rival</strong>.</p>` : ''}${shadedOffspring.length ? `<p><strong>${shadedOffspring.length} of your offspring ${shadedOffspring.length === 1 ? 'grows' : 'grow'} on this side.</strong> Leaning toward the ${neighbor.species} will also shade ${shadedOffspring.length === 1 ? 'it' : 'them'} and slow ${shadedOffspring.length === 1 ? 'its' : 'their'} growth until you lean away.</p>` : ''}<p>Do you want to go through with it?</p>`,
        } : null,
        preview,
        meta: {
          species: neighbor.species,
          relationName,
          alreadyContested,
          currentShade: Boolean(neighbor.playerShading),
          currentDominion: Boolean(neighbor.playerRootDominated),
          blockedReason: shadeAllowed ? null : 'too-short',
          playerHeight,
          targetHeight,
          heightNeeded,
          shadedOffspringCount: shadedOffspring.length,
        },
      };
    });

  return createDecision({
    kind: kind === 'shade' ? 'aggression:shade' : 'aggression:dominion',
    title: kind === 'shade' ? 'Shade which neighbor?' : 'Assert dominion over which neighbor?',
    body: kind === 'shade' ? 'Choose one living tree immediately to your left or right. Shadeable trees are shorter than you. Choosing a new target releases your previous one.' : 'Choose one neighboring tree to pressure underground. The contested root zone lasts until you stop or choose another target.',
    options,
    meta: { actionKind: kind },
  });
}

export function applyAggressionToNeighbor(state, neighbor, kind, deps = {}) {
  const { getRelationshipState, getNeighborStage } = deps;
  const relationName = getRelationshipState(neighbor.relation).name;
  const alreadyContested = relationName === 'Rival' || relationName === 'Hostile';

  if (kind === 'shade' && getNeighborStage && !canPlayerShadeNeighbor(state, neighbor, getNeighborStage)) {
    return {
      ok: false,
      reason: 'too-short',
      playerHeight: playerHeightLevel(state),
      targetHeight: neighborHeightLevel(neighbor, getNeighborStage),
      alreadyContested,
      gains: { sunlight: 0, water: 0, nutrients: 0 },
      relationStateBefore: relationName,
      persistentCanopyAdvantage: false,
    };
  }

  if (relationName === 'Friendly' || relationName === 'Neutral' || relationName === 'Ally') {
    neighbor.relation = -35;
    neighbor.ally = false;
  }

  if (kind === 'shade') {
    const relationLoss = alreadyContested ? 4 : 8;
    const sunlightGain = 0;
    const nutrientGain = 0;
    neighbor.relation = Math.max(-100, neighbor.relation - relationLoss);
    const releasedShadeTarget = setPlayerShadeTarget(state, neighbor);
    const shadedOffspring = getShadedOffspring(state, neighbor);
    return {
      alreadyContested,
      gains: { sunlight: sunlightGain, water: 0, nutrients: nutrientGain },
      relationStateBefore: relationName,
      persistentCanopyAdvantage: true,
      sunlightPerTurn: SHADE_SUNLIGHT_BONUS,
      nutrientsPerTurn: SHADE_NUTRIENT_BONUS,
      targetGrowthMultiplier: SHADED_NEIGHBOR_GROWTH_MULTIPLIER,
      releasedShadeTarget,
      shadedOffspringCount: shadedOffspring.length,
    };
  }

  if (kind === 'dominion') {
    const stageScoreLoss = alreadyContested ? 50 : 35;
    const relationLoss = alreadyContested ? 6 : 12;
    const sunlightGain = alreadyContested ? 1 : 0;
    ensureNeighborEconomy(neighbor);
    const waterGain = Math.min(1, neighbor.reserves.water);
    const nutrientGain = Math.min(1, neighbor.reserves.nutrients);
    neighbor.stageScore = Math.max(0, neighbor.stageScore - stageScoreLoss);
    neighbor.relation = Math.max(-100, neighbor.relation - relationLoss);
    neighbor.reserves.water -= waterGain;
    neighbor.reserves.nutrients -= nutrientGain;
    state.sunlight += sunlightGain;
    state.water += waterGain;
    state.nutrients += nutrientGain;
    const releasedDominionTarget = setPlayerRootDominionTarget(state, neighbor);
    return {
      alreadyContested,
      gains: { sunlight: sunlightGain, water: waterGain, nutrients: nutrientGain },
      relationStateBefore: relationName,
      persistentRootDominion: true,
      waterPerTurn: ROOT_DOMINION_WATER_BONUS,
      nutrientsPerTurn: ROOT_DOMINION_NUTRIENT_BONUS,
      releasedDominionTarget,
    };
  }

  throw new Error(`Unknown aggression kind: ${kind}`);
}

export function resolveDiplomacyDecision(state, decision, choiceId, deps = {}) {
  if (!decision) throw new Error('Decision is required');
  const option = findDecisionOption(decision, choiceId);
  if (!option) throw new Error(`Unknown decision option: ${choiceId}`);
  const neighbor = option.targetIndex == null ? null : state.neighbors[option.targetIndex];

  if (decision.kind === 'connection') {
    if (!neighbor) throw new Error('Connection decision missing neighbor target');
    return {
      kind: 'connection',
      targetIndex: option.targetIndex,
      option,
      outcome: resolveConnectionAttempt(state, neighbor, {
        getRelationshipState: deps.getRelationshipState,
        getAdjustedRelationshipDelta: deps.getAdjustedRelationshipDelta,
        getNeighborStage: deps.getNeighborStage,
        recordDamage: deps.recordDamage,
        random: deps.random,
      }),
    };
  }

  if (decision.kind === 'ally-aid') {
    if (!neighbor) throw new Error('Aid decision missing neighbor target');
    return {
      kind: 'ally-aid',
      targetIndex: option.targetIndex,
      option,
      outcome: resolveAidToAlly(state, neighbor, {
        getRelationshipState: deps.getRelationshipState,
        getAdjustedRelationshipDelta: deps.getAdjustedRelationshipDelta,
        paidCost: option.meta?.paidCost,
      }),
    };
  }

  if (decision.kind === 'ally-help-request') {
    if (!neighbor) throw new Error('Help request decision missing neighbor target');
    return {
      kind: 'ally-help-request',
      targetIndex: option.targetIndex,
      option,
      outcome: resolveHelpRequestFromAlly(state, neighbor, {
        getRelationshipState: deps.getRelationshipState,
        getAdjustedRelationshipDelta: deps.getAdjustedRelationshipDelta,
        getNeighborStage: deps.getNeighborStage,
        random: deps.random,
        requestKind: option.meta?.requestKind || 'health',
      }),
    };
  }

  if (decision.kind === 'aggression:shade' || decision.kind === 'aggression:dominion') {
    if (!neighbor) throw new Error('Aggression decision missing neighbor target');
    const actionKind = decision.meta?.actionKind || (decision.kind === 'aggression:shade' ? 'shade' : 'dominion');
    return {
      kind: decision.kind,
      targetIndex: option.targetIndex,
      option,
      outcome: applyAggressionToNeighbor(state, neighbor, actionKind, {
        getRelationshipState: deps.getRelationshipState,
        getNeighborStage: deps.getNeighborStage,
      }),
    };
  }

  throw new Error(`Unsupported diplomacy decision kind: ${decision.kind}`);
}

export function checkAllyBetrayal(state, events, deps) {
  const {
    computeCurrentLifeStage,
    STAGE_BY_NAME,
    getRelationshipState,
    recordDamage,
    onRelationshipShift,
  } = deps;

  const currentStage = computeCurrentLifeStage();
  if (currentStage.rank < STAGE_BY_NAME['Sapling'].rank) return;

  const capAllyThreats = currentStage.rank < STAGE_BY_NAME['Mature Tree'].rank;
  let allyThreatTriggered = false;

  for (const neighbor of state.neighbors) {
    if (neighbor.dead) continue;
    if (getRelationshipState(neighbor.relation).name !== 'Ally') continue;
    if (capAllyThreats && allyThreatTriggered) break;

    const neglectScore = (neighbor.helpRefusedToThem || 0) - (neighbor.helpGivenToThem || 0);

    if (neglectScore >= 2 && Math.random() < 0.15) {
      const oldState = getRelationshipState(neighbor.relation).name;
      neighbor.relation = Math.max(-100, neighbor.relation - 25);
      const newState = getRelationshipState(neighbor.relation).name;

      events.push({
        text: `Your ally ${neighbor.species} feels abandoned. The fungal bond between you weakens into something bitter.`,
        effect: 'warning'
      });

      onRelationshipShift?.(neighbor, oldState, newState);
      allyThreatTriggered = true;
      continue;
    }

    if (state.year >= 8 && Math.random() < 0.08) {
      state.eventModifiers.disease = 0.7;
      state.health -= 2;
      recordDamage(2, 'blight');
      events.push({
        title: 'Network Blight',
        text: `Blight travels the fungal network from your ally ${neighbor.species}. The shared connection carries disease into your tissues and weakens resource collection.`,
        effects: ['Health −2', 'Resource collection reduced'],
        effect: 'damage',
        sceneArt: 'event-fungal-blight',
      });
      allyThreatTriggered = true;
    }
  }
}
