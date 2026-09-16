import { createDecision, findDecisionOption } from './decisions.js';

export const HUMAN_RUMORS = [
  {
    title: 'A Distant Tremor',
    body: 'A faint warning travels through the fungal dark. Far away, an old tree feels repeated blows against its trunk.',
    minRank: 2,
  },
  {
    title: 'The Signal Falters',
    body: 'The distant tree speaks only in broken pulses now. Around it, familiar root-signals are disappearing one by one.',
    minRank: 2,
  },
  {
    title: 'Silence in the Network',
    body: 'The old tree is gone. Where its roots once answered, the fungal network carries only a cold and empty silence.',
    minRank: 3,
  },
  {
    title: 'A Pattern of Loss',
    body: 'Other forests whisper of the same destruction. Humans are seeking the largest trunks and leaving broken ground behind them.',
    minRank: 4,
  },
  {
    title: 'The Cutting Draws Nearer',
    body: 'The missing forests are no longer impossibly distant. Each season, the edge of the silence feels closer.',
    minRank: 5,
  },
  {
    title: 'The Largest Trees',
    body: 'A grim rumor spreads: forests holding the greatest trees are being marked first. Their wood has drawn human attention.',
    minRank: 5,
  },
  {
    title: 'A Grove Left Standing',
    body: 'Then comes a different story. Humans spared one grove larger than all the rest—a thriving community of ancient trees and their descendants, protected together as a living ecosystem.',
    minRank: 5,
  },
];

export function ensureHumanState(state) {
  state.offspringRecords ||= [];
  state.alliedNeighbors ??= 0;
  state.humanPressure ??= 0;
  state.humanAttention ??= 0;
  state.humanCooldown ??= 0;
  state.cuttingProgress ??= 0;
  state.thornDefense ??= 0;
  state.toxicLeaves ??= 0;
  state.pendingHumanEncounter ??= null;
  state.humanStoryTurns ??= 0;
  state.humanRumorIndex ??= 0;
  state.lastHumanRumorTurn ??= -99;
  state.lastPressureYear ??= 0;
  state.protectionProgress ??= 0;
  state.protectionEligible ??= false;
  state.protectionDesignated ??= false;
  return state;
}

export function createOffspringRecords(state, count) {
  ensureHumanState(state);
  const created = [];
  for (let i = 0; i < count; i += 1) {
    const record = {
      id: `offspring-${state.year}-${state.seasonIndex}-${state.offspringRecords.length + 1}`,
      species: state.selectedSpecies || 'Plum',
      stageScore: 100,
      maxHealth: 8,
      health: 8,
      nurtureCount: 0,
      dead: false,
    };
    state.offspringRecords.push(record);
    created.push(record);
  }
  syncOffspringCounts(state);
  return created;
}

export function syncOffspringCounts(state) {
  ensureHumanState(state);
  state.offspringTrees = state.offspringRecords.filter(child => !child.dead).length;
  return state.offspringTrees;
}

export function growOffspringRecords(state, random = Math.random) {
  ensureHumanState(state);
  for (const child of state.offspringRecords) {
    if (child.dead) continue;
    child.stageScore += 35 + Math.floor(random() * 26);
    if (child.health < child.maxHealth && random() < 0.16) child.health += 1;
  }
  syncOffspringCounts(state);
}

export function nurtureOffspring(state) {
  ensureHumanState(state);
  const candidates = state.offspringRecords
    .filter(child => !child.dead)
    .sort((a, b) => a.nurtureCount - b.nurtureCount || a.stageScore - b.stageScore);
  const child = candidates[0];
  if (!child) return null;
  child.nurtureCount += 1;
  child.stageScore += 300;
  child.maxHealth += 1;
  child.health = Math.min(child.maxHealth, child.health + 2);
  return child;
}

export function loseYoungestOffspring(state) {
  ensureHumanState(state);
  const child = state.offspringRecords
    .filter(candidate => !candidate.dead)
    .sort((a, b) => a.stageScore - b.stageScore)[0];
  if (!child) return null;
  child.dead = true;
  child.health = 0;
  syncOffspringCounts(state);
  return child;
}

export function getProtectedCompanions(state, { getRelationshipState, getNeighborStage }) {
  ensureHumanState(state);
  const supportedAllies = state.neighbors
    .map((neighbor, index) => ({ neighbor, index }))
    .filter(({ neighbor }) => !neighbor.dead)
    .filter(({ neighbor }) => getRelationshipState(neighbor.relation).name === 'Ally')
    .filter(({ neighbor }) => getNeighborStage(neighbor.stageScore).rank >= 5)
    .filter(({ neighbor }) => (neighbor.helpGivenToThem || 0) >= 2)
    .filter(({ neighbor }) => getNeighborStage(neighbor.firstAidStageScore ?? neighbor.stageScore).rank < 5 || (neighbor.growthAidReceived || 0) >= 4)
    .filter(({ neighbor }) => neighbor.health >= Math.ceil(neighbor.maxHealth * 0.5))
    .map(({ neighbor, index }) => ({ kind: 'ally', id: `neighbor-${index}`, tree: neighbor }));

  const supportedChildren = state.offspringRecords
    .filter(child => !child.dead)
    .filter(child => getNeighborStage(child.stageScore).rank >= 5)
    .filter(child => child.nurtureCount >= 2)
    .filter(child => child.health >= Math.ceil(child.maxHealth * 0.5))
    .map(child => ({ kind: 'offspring', id: child.id, tree: child }));

  return [...supportedAllies, ...supportedChildren];
}

export function updateProtectionProgress(state, deps) {
  const companions = getProtectedCompanions(state, deps);
  state.protectionProgress = Math.min(2, companions.length);
  state.protectionEligible = state.lifeStage?.name === 'Ancient'
    && state.protectionProgress >= 2
    && state.humanRumorIndex >= HUMAN_RUMORS.length;
  return { companions, eligible: state.protectionEligible };
}

export function woodAttraction(state) {
  const rank = state.lifeStage?.rank || 0;
  if (rank < 4) return 0;
  return Math.max(0, (rank - 3) * 2 + (state.trunk || 0) + Math.floor((state.branches || 0) / 2) + Math.floor((state.canopySpread || 0) / 2));
}

function buildConservationDecision(state, deps) {
  const { companions } = updateProtectionProgress(state, deps);
  const names = companions.slice(0, 2).map(entry => entry.kind === 'offspring'
    ? `${entry.tree.species} offspring`
    : `${entry.tree.species} ally`);
  return createDecision({
    kind: 'conservation-inspection',
    title: 'Visitors in the Grove',
    body: `<p>Humans arrive again, but these carry notebooks and measuring tapes instead of saws.</p><p>They study you and the two great trees you helped flourish: <strong>${names.join(' and ')}</strong>.</p>`,
    options: [{ id: 'receive-inspection', label: 'Let them witness the living grove' }],
  });
}

export function buildHumanEncounterDecision(state) {
  ensureHumanState(state);
  const encounter = state.pendingHumanEncounter;
  if (!encounter) return null;
  const options = [];
  if (state.branches > 0) {
    options.push({
      id: 'drop-branch',
      label: 'Drop a branch nearby (lose 1 branch and up to 2 leaf clusters)',
      preview: 'A forceful immediate defense that drives the humans away.',
    });
  }
  if (state.allies > 0) {
    options.push({
      id: 'call-network',
      label: state.nutrients >= 2 ? 'Call through the fungal network (2 nutrients)' : 'Call through the fungal network — need 2 nutrients',
      affordable: state.nutrients >= 2,
      preview: 'Connected trees send warning pulses and make the grove feel active and defended.',
    });
  }
  options.push({
    id: 'use-defenses',
    label: state.thornDefense + state.toxicLeaves > 0 ? 'Rely on your thorns and toxic foliage' : 'Stand firm without special defenses',
  });
  options.push({ id: 'endure-cutting', label: 'Conserve your strength and endure' });
  return createDecision({
    kind: 'human-encounter',
    title: encounter.phase === 'survey' ? 'Humans at Your Trunk' : 'The Cutters Return',
    body: encounter.phase === 'survey'
      ? '<p>Humans circle your trunk, measuring your girth and studying the shape of your wood. One raises a bright marking brush.</p>'
      : `<p>${encounter.count} humans return with cutting tools. Old marks on your trunk guide them back to you.</p><p><strong>Cutting damage:</strong> ${state.cuttingProgress}/3</p>`,
    options,
    meta: { encounter },
  });
}

function failEncounter(state, encounter) {
  if (encounter.phase === 'survey') {
    state.humanAttention += 1;
    state.humanCooldown = 4;
    state.pendingHumanEncounter = null;
    return {
      title: 'The Tree Is Marked',
      body: '<p>The humans paint a bright mark low on your trunk. They leave for now, but the fungal network carries an uneasy certainty: they intend to return.</p><p class="threat-status threat-growing">The danger is drawing closer.</p>',
    };
  }

  const damage = 2 + Math.floor(state.humanPressure / 3);
  state.health = Math.max(0, state.health - damage);
  state.trunk = Math.max(1, state.trunk - 1);
  state.cuttingProgress += 1;
  state.humanAttention += 1;
  state.humanCooldown = 3;
  state.pendingHumanEncounter = null;
  if (state.cuttingProgress >= 3) {
    state.health = 0;
    state.lastDamageCause = 'logging';
    return {
      title: 'Felled',
      body: '<p>The final cuts pass through your remaining wood. Your crown falls, and your root-signals break into silence.</p><p>The cutting ends only when the tree is gone.</p>',
      fatal: true,
    };
  }
  return {
    title: 'A Deep Cut',
    body: `<p>The humans carve deeply into your trunk before leaving. You lose <strong>${damage} health</strong> and one level of trunk growth.</p><p><strong>Cutting damage:</strong> ${state.cuttingProgress}/3</p><p class="threat-status threat-growing">They have withdrawn, but they mean to return.</p>`,
  };
}

export function resolveHumanDecision(state, decision, optionId, deps = {}) {
  const { random = Math.random } = deps;
  const option = findDecisionOption(decision, optionId);
  if (!option) return { title: 'The Moment Passes', body: '<p>No response was chosen.</p>' };

  if (decision.kind === 'conservation-inspection') {
    state.protectionDesignated = true;
    state.protectionEligible = true;
    state.victoryAchieved = true;
    state.pendingHumanEncounter = null;
    return {
      title: 'A Protected Ecosystem',
      body: '<p>The visitors recognize that this is not merely valuable timber, but a rare community of great trees supporting one another across generations.</p><p>Boundaries are drawn around the grove. Cutting is forbidden. Your ecosystem will be allowed to endure.</p><p class="threat-status threat-solved">The axes will not return.</p>',
      victory: true,
    };
  }

  const encounter = state.pendingHumanEncounter || decision.meta?.encounter;
  if (!encounter) return { title: 'The Humans Have Gone', body: '<p>The grove is quiet again.</p>' };

  if (option.id === 'drop-branch' && state.branches > 0) {
    state.branches -= 1;
    state.leafClusters = Math.max(0, state.leafClusters - 2);
    state.humanAttention = Math.max(0, state.humanAttention - 1);
    state.humanCooldown = 6;
    state.pendingHumanEncounter = null;
    return {
      title: 'Branchfall',
      body: '<p>You release a heavy branch. It crashes into the ground beside the humans, who abandon their tools and flee.</p><p>You lose <strong>1 branch</strong> and up to <strong>2 leaf clusters</strong>.</p><p class="threat-status threat-solved">The grove is safe for now.</p>',
      repelled: true,
    };
  }

  let defensePower = state.thornDefense * 2 + state.toxicLeaves * 2 + Math.min(2, state.defense || 0);
  if (option.id === 'call-network' && state.nutrients >= 2 && state.allies > 0) {
    state.nutrients -= 2;
    defensePower += 3 + Math.min(3, state.allies);
  }
  if (option.id === 'endure-cutting') defensePower = Math.floor(defensePower / 2);

  const difficulty = encounter.phase === 'survey'
    ? 2 + state.humanPressure * 0.45
    : 5 + state.humanPressure * 0.7 + state.humanAttention * 0.35;
  const successChance = Math.max(0.08, Math.min(0.9, 0.38 + defensePower * 0.08 - difficulty * 0.035));
  if (random() < successChance) {
    state.humanAttention = Math.max(0, state.humanAttention - 1);
    state.humanCooldown = 5;
    state.pendingHumanEncounter = null;
    return {
      title: 'The Humans Retreat',
      body: option.id === 'call-network'
        ? '<p>Alarm pulses race through the connected grove. Roots shift, branches move, and the humans find themselves surrounded by signs of a living forest. They retreat.</p><p class="threat-status threat-solved">The grove is safe for now.</p>'
        : '<p>Your thorns, toxic foliage, and imposing movement make the work too dangerous. The humans withdraw from the grove.</p><p class="threat-status threat-solved">The grove is safe for now.</p>',
      repelled: true,
    };
  }
  return failEncounter(state, encounter);
}

export function advanceHumanSystem(state, deps = {}) {
  const {
    getRelationshipState,
    getNeighborStage,
    random = Math.random,
  } = deps;
  ensureHumanState(state);
  state.humanStoryTurns += 1;
  if (state.humanCooldown > 0) state.humanCooldown -= 1;

  if (state.protectionDesignated) return {};

  if (state.pendingHumanEncounter) {
    return { decision: buildHumanEncounterDecision(state) };
  }

  const protection = updateProtectionProgress(state, { getRelationshipState, getNeighborStage });
  if (protection.eligible && !state.victoryAchieved) {
    return { decision: buildConservationDecision(state, { getRelationshipState, getNeighborStage }) };
  }

  const nextRumor = HUMAN_RUMORS[state.humanRumorIndex];
  if (nextRumor
    && state.lifeStage?.rank >= nextRumor.minRank
    && state.humanStoryTurns - state.lastHumanRumorTurn >= 6) {
    state.humanRumorIndex += 1;
    state.lastHumanRumorTurn = state.humanStoryTurns;
    return { rumor: nextRumor };
  }

  if (state.lifeStage?.rank >= 4 && state.year > state.lastPressureYear) {
    state.humanPressure = Math.min(8, state.humanPressure + 1);
    state.lastPressureYear = state.year;
  }

  const attraction = woodAttraction(state);
  if (attraction <= 0 || state.humanCooldown > 0) return {};
  const baseChance = state.lifeStage.rank === 4 ? 0.025 : state.lifeStage.rank === 5 ? 0.065 : 0.1;
  const chance = Math.min(0.28, baseChance + attraction * 0.004 + state.humanPressure * 0.012);
  if (random() >= chance) return {};

  const phase = state.humanAttention > 0 || state.cuttingProgress > 0 ? 'cutting' : 'survey';
  state.pendingHumanEncounter = {
    phase,
    count: phase === 'survey' ? 2 : Math.min(5, 2 + Math.floor((state.humanPressure + state.humanAttention) / 3)),
  };
  return {
    event: {
      text: phase === 'survey'
        ? 'Humans have entered the grove and are measuring your trunk. They remain visible on the map, and their interest is growing.'
        : 'The marked humans have returned with cutting tools. They remain beside your trunk until you respond.',
      effect: 'human-warning',
    },
  };
}
