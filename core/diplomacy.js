import { createDecision } from './decisions.js';

export function applyRelationshipDelta(state, neighbor, delta, getAdjustedRelationshipDelta) {
  const adjustedDelta = getAdjustedRelationshipDelta(state, delta);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjustedDelta));
  return adjustedDelta;
}

export function updateAlliesCount(state, getRelationshipState) {
  state.allies = state.neighbors.filter(n => getRelationshipState(n.relation).name === 'Ally').length + state.offspringTrees;
  return state.allies;
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
    scaledAidNutrientCost = (_base, _neighbor, _crisis) => 8,
  } = deps;

  const oldState = getRelationshipState(neighbor.relation).name;
  const crisis = (neighbor.activeCrises || [])[0] || null;
  const nutrientCost = scaledAidNutrientCost(8, neighbor, crisis);
  const waterCost = crisis?.kind === 'water' ? Math.min(10, Math.max(3, crisis.amount)) : 2;

  if (state.nutrients < nutrientCost || state.water < waterCost) {
    return {
      ok: false,
      oldState,
      newState: oldState,
      crisis,
      nutrientCost,
      waterCost,
      reason: 'insufficient-reserves',
    };
  }

  state.nutrients -= nutrientCost;
  state.water -= waterCost;
  neighbor.helpGivenToThem += 1;
  neighbor.lastAidMemory = 'you-gave-freely';
  const adjusted = getAdjustedRelationshipDelta(state, crisis ? 10 : 8);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjusted));
  neighbor.health = Math.min(neighbor.maxHealth, neighbor.health + (crisis ? 3 : 2));
  if (crisis) neighbor.activeCrises = neighbor.activeCrises.filter(c => c.id !== crisis.id);
  const newState = getRelationshipState(neighbor.relation).name;

  return {
    ok: true,
    oldState,
    newState,
    crisis,
    nutrientCost,
    waterCost,
  };
}

export function resolveHelpRequestFromAlly(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    getAdjustedRelationshipDelta = (_state, delta) => delta,
    getNeighborStage = () => ({ rank: 1 }),
    random = Math.random,
  } = deps;

  neighbor.timesAskedThemForHelp += 1;
  const favorBalance = neighbor.helpGivenToThem - neighbor.timesAskedThemForHelp;
  const stageBonus = Math.max(0, getNeighborStage(neighbor.stageScore).rank - 1);
  const rawHeal = 2 + Math.floor(random() * 4) + Math.max(0, stageBonus > 2 ? 1 : 0);
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
  const adjusted = getAdjustedRelationshipDelta(state, relationShift);
  neighbor.relation = Math.max(-100, Math.min(100, neighbor.relation + adjusted));
  const newState = getRelationshipState(neighbor.relation).name;
  neighbor.lastAidMemory = actualHeal > 0 ? 'helped-you' : 'could-not-help';

  return {
    oldState,
    newState,
    tone,
    actualHeal,
  };
}

export function buildConnectionDecision(state, deps = {}) {
  const { getRelationshipState } = deps;

  return createDecision({
    kind: 'connection',
    title: 'Reach toward which neighbor?',
    body: 'Choose a neighboring tree to contact through the soil.',
    options: state.neighbors
      .filter(neighbor => !neighbor.dead)
      .map((neighbor, index) => {
        const relationName = getRelationshipState(neighbor.relation).name;
        return {
          id: `neighbor-${index}`,
          label: `${neighbor.species} — ${relationName}`,
          targetIndex: index,
          meta: {
            species: neighbor.species,
            relationName,
            canStrengthenAlliance: relationName === 'Ally',
            isRisky: relationName === 'Rival' || relationName === 'Hostile',
          },
        };
      }),
  });
}

export function listConnectionOptions(state, deps = {}) {
  return buildConnectionDecision(state, deps).options;
}

export function buildAidDecision(state, deps = {}) {
  const {
    getRelationshipState,
    scaledAidNutrientCost = (_base, _neighbor, _crisis) => 8,
  } = deps;

  return createDecision({
    kind: 'ally-aid',
    title: 'Offer aid to which ally?',
    body: 'Choose an allied tree to support.',
    options: state.neighbors
      .filter(neighbor => !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally')
      .map((neighbor, index) => {
        const crisis = (neighbor.activeCrises || [])[0] || null;
        const nutrientCost = scaledAidNutrientCost(8, neighbor, crisis);
        const waterCost = crisis?.kind === 'water' ? Math.min(10, Math.max(3, crisis.amount)) : 2;
        return {
          id: `neighbor-${index}`,
          label: `${neighbor.species} — Ally`,
          targetIndex: index,
          affordable: state.nutrients >= nutrientCost && state.water >= waterCost,
          meta: {
            species: neighbor.species,
            relationName: 'Ally',
            crisis,
            nutrientCost,
            waterCost,
          },
        };
      }),
  });
}

export function listAidOptions(state, deps = {}) {
  return buildAidDecision(state, deps).options;
}

export function buildHelpRequestDecision(state, deps = {}) {
  const {
    getRelationshipState,
    getNeighborStage = () => ({ rank: 1 }),
  } = deps;

  return createDecision({
    kind: 'ally-help-request',
    title: 'Ask an ally for help',
    body: 'Choose which allied tree you are asking to support you.',
    options: state.neighbors
      .filter(neighbor => !neighbor.dead && getRelationshipState(neighbor.relation).name === 'Ally')
      .map((neighbor, index) => {
        const favorBalance = neighbor.helpGivenToThem - neighbor.timesAskedThemForHelp;
        const stageBonus = Math.max(0, getNeighborStage(neighbor.stageScore).rank - 1);
        let toneHint = 'steady';
        if (favorBalance < -2) toneHint = 'strained';
        else if (neighbor.helpGivenToThem > neighbor.helpRefusedToThem) toneHint = 'warm';
        return {
          id: `neighbor-${index}`,
          label: `${neighbor.species} — Ally`,
          targetIndex: index,
          meta: {
            species: neighbor.species,
            relationName: 'Ally',
            favorBalance,
            stageBonus,
            toneHint,
          },
        };
      }),
  });
}

export function listHelpRequestOptions(state, deps = {}) {
  return buildHelpRequestDecision(state, deps).options;
}

export function resolveConnectionAttempt(state, neighbor, deps = {}) {
  const {
    getRelationshipState,
    getAdjustedRelationshipDelta = (_state, delta) => delta,
    recordDamage = () => {},
    random = Math.random,
  } = deps;

  const rootBonus = Math.min(0.35, Math.max(0, state.rootZones - 2) * 0.08);
  const oldState = getRelationshipState(neighbor.relation).name;
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
    const breakthroughChance = 0.12 + (rootBonus * 0.35);
    const successChance = 0.64 + rootBonus;
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
    const breakthroughChance = 0.10 + (rootBonus * 0.3);
    const successChance = 0.52 + rootBonus;
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
    if (roll < 0.12 + rootBonus) {
      applyDelta(32);
      message = `After a tense silence, the ${neighbor.species} relents more than you expected. The rivalry cracks and something calmer pushes through.`;
      feedback = { text: `${neighbor.species} softened unexpectedly`, type: 'success' };
    } else if (roll < 0.32 + rootBonus) {
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
    if (roll < 0.06 + rootBonus) {
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

  return {
    oldState,
    newState,
    message,
    feedback,
  };
}

export function buildAggressionDecision(state, kind, deps = {}) {
  const { getRelationshipState } = deps;

  const options = state.neighbors
    .filter(neighbor => !neighbor.dead)
    .map((neighbor, index) => {
      const relationName = getRelationshipState(neighbor.relation).name;
      const alreadyContested = relationName === 'Rival' || relationName === 'Hostile';
      const requiresWarning = relationName === 'Friendly' || relationName === 'Ally';
      const preview = kind === 'shade'
        ? {
            sunlight: alreadyContested ? 2 : 1,
            water: 0,
            nutrients: 0,
            relationShift: alreadyContested ? 'press rivalry' : 'start rivalry',
          }
        : {
            sunlight: alreadyContested ? 1 : 0,
            water: 1,
            nutrients: 1,
            relationShift: alreadyContested ? 'press rivalry' : 'start rivalry',
          };

      return {
        id: `neighbor-${index}`,
        label: `${neighbor.species} — ${relationName}`,
        targetIndex: index,
        requiresConfirmation: requiresWarning,
        confirmation: requiresWarning ? {
          title: 'Escalate against this tree?',
          body: `<p><em>The ${neighbor.species} is currently ${relationName.toLowerCase()} toward you.</em></p><p>If you attack now, it will immediately become a <strong>Rival</strong>.</p><p>Do you want to go through with it?</p>`,
        } : null,
        preview,
        meta: {
          species: neighbor.species,
          relationName,
          alreadyContested,
        },
      };
    });

  return createDecision({
    kind: kind === 'shade' ? 'aggression:shade' : 'aggression:dominion',
    title: kind === 'shade' ? 'Shade which neighbor?' : 'Assert dominion over which neighbor?',
    body: kind === 'shade' ? 'Choose any neighboring tree to suppress.' : 'Choose any neighboring tree to pressure underground.',
    options,
    meta: { actionKind: kind },
  });
}

export function listAggressionOptions(state, kind, deps = {}) {
  return buildAggressionDecision(state, kind, deps).options;
}

export function applyAggressionToNeighbor(state, neighbor, kind, deps = {}) {
  const { getRelationshipState } = deps;
  const relationName = getRelationshipState(neighbor.relation).name;
  const alreadyContested = relationName === 'Rival' || relationName === 'Hostile';

  if (relationName === 'Friendly' || relationName === 'Neutral' || relationName === 'Ally') {
    neighbor.relation = -35;
    neighbor.ally = false;
  }

  if (kind === 'shade') {
    const stageScoreLoss = alreadyContested ? 30 : 20;
    const relationLoss = alreadyContested ? 4 : 8;
    const sunlightGain = alreadyContested ? 2 : 1;
    neighbor.stageScore = Math.max(0, neighbor.stageScore - stageScoreLoss);
    neighbor.relation = Math.max(-100, neighbor.relation - relationLoss);
    state.sunlight += sunlightGain;
    return {
      alreadyContested,
      gains: { sunlight: sunlightGain, water: 0, nutrients: 0 },
      relationStateBefore: relationName,
    };
  }

  if (kind === 'dominion') {
    const stageScoreLoss = alreadyContested ? 50 : 35;
    const relationLoss = alreadyContested ? 6 : 12;
    const sunlightGain = alreadyContested ? 1 : 0;
    const waterGain = 1;
    const nutrientGain = 1;
    neighbor.stageScore = Math.max(0, neighbor.stageScore - stageScoreLoss);
    neighbor.relation = Math.max(-100, neighbor.relation - relationLoss);
    state.sunlight += sunlightGain;
    state.water += waterGain;
    state.nutrients += nutrientGain;
    return {
      alreadyContested,
      gains: { sunlight: sunlightGain, water: waterGain, nutrients: nutrientGain },
      relationStateBefore: relationName,
    };
  }

  throw new Error(`Unknown aggression kind: ${kind}`);
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
      events.push({
        text: `Blight travels the fungal network from your ally ${neighbor.species}. Your shared connection becomes a channel for disease.`,
        effect: 'warning'
      });
      state.eventModifiers.disease = 0.7;
      state.health -= 2;
      recordDamage(2, 'blight');
      events.push({ text: 'Health -2 from network blight. Resource collection reduced.', effect: 'damage' });
      allyThreatTriggered = true;
    }
  }
}
