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
