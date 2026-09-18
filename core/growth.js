export const SHADE_SUNLIGHT_BONUS = 2;
export const SHADED_NEIGHBOR_GROWTH_MULTIPLIER = 0.6;

export function playerHeightLevel(state) {
  return ((state.lifeStage?.rank || 0) * 4) + Math.max(0, state.heightGrowth || 0);
}

export function getPlayerShadeTarget(state) {
  return (state.neighbors || []).find(neighbor => (
    !neighbor.dead
    && neighbor.playerShading
    && (neighbor.slot === 1 || neighbor.slot === 3)
  )) || null;
}

export function offspringGroveSide(child, index = 0) {
  return child?.groveSide || (index % 2 === 0 ? 'left' : 'right');
}

export function offspringSharesShadeDirection(child, index, target) {
  if (!child || child.dead || !target) return false;
  return offspringGroveSide(child, index) === (target.slot === 1 ? 'left' : 'right');
}

export function getShadedOffspring(state, target = getPlayerShadeTarget(state)) {
  return (state.offspringRecords || []).filter((child, index) => offspringSharesShadeDirection(child, index, target));
}

export function offspringGrowthFromLight(baseGrowth, child, index, activeTarget) {
  if (!offspringSharesShadeDirection(child, index, activeTarget)) return baseGrowth;
  return Math.max(1, Math.round(baseGrowth * SHADED_NEIGHBOR_GROWTH_MULTIPLIER));
}

export function normalizePlayerShadeTarget(state) {
  const target = getPlayerShadeTarget(state);
  (state.neighbors || []).forEach(neighbor => {
    if (neighbor !== target) neighbor.playerShading = false;
  });
  return target;
}

export function setPlayerShadeTarget(state, target) {
  let releasedTarget = null;
  (state.neighbors || []).forEach(neighbor => {
    if (neighbor !== target && neighbor.playerShading) {
      releasedTarget ||= neighbor;
      neighbor.playerShading = false;
    }
  });
  if (target) {
    target.playerShading = true;
    target.shadingPlayer = false;
  }
  return releasedTarget;
}

export function neighborGrowthFromLight(baseGrowth, neighbor, activeTarget = neighbor) {
  if (!neighbor?.playerShading || neighbor !== activeTarget) return baseGrowth;
  return Math.max(1, Math.round(baseGrowth * SHADED_NEIGHBOR_GROWTH_MULTIPLIER));
}

export function neighborHeightLevel(neighbor, getNeighborStage) {
  return ((getNeighborStage(neighbor.stageScore).rank || 0) * 4) + Math.max(0, neighbor.heightGrowth || 0);
}

export function canPlayerShadeNeighbor(state, neighbor, getNeighborStage) {
  return playerHeightLevel(state) > neighborHeightLevel(neighbor, getNeighborStage);
}

export function canNeighborShadePlayer(state, neighbor, getNeighborStage) {
  return neighborHeightLevel(neighbor, getNeighborStage) > playerHeightLevel(state);
}

export function reconcileCanopyHeight(state, neighbor, getNeighborStage, getRelationshipState = () => ({ name: 'Neutral' })) {
  if (!neighbor || neighbor.dead) return null;
  const playerHeight = playerHeightLevel(state);
  const targetHeight = neighborHeightLevel(neighbor, getNeighborStage);
  const relationship = getRelationshipState(neighbor.relation).name;

  if (neighbor.playerShading && playerHeight <= targetHeight) {
    neighbor.playerShading = false;
    const reversed = targetHeight > playerHeight && (relationship === 'Rival' || relationship === 'Hostile');
    neighbor.shadingPlayer = reversed;
    return {
      kind: reversed ? 'reversed' : 'lost-advantage',
      neighbor,
      playerHeight,
      targetHeight,
      message: reversed
        ? `The ${neighbor.species} has grown taller than you. Your crown can no longer shade it; its canopy now presses over yours. Grow Taller to overtop it again, or use diplomacy to ease the rivalry.`
        : `The ${neighbor.species} has caught up to your height. Your crown can no longer shade it. Grow Taller before trying again.`,
    };
  }

  if (neighbor.shadingPlayer && targetHeight <= playerHeight) {
    neighbor.shadingPlayer = false;
    return {
      kind: 'escaped-crowding',
      neighbor,
      playerHeight,
      targetHeight,
      message: `Your crown has caught up with the ${neighbor.species}. It can no longer shade you; grow taller once more if you want to overtop it yourself.`,
    };
  }

  return null;
}

export function allyResourceWeight(neighbor, getNeighborStage) {
  const rank = Math.max(0, getNeighborStage(neighbor.stageScore).rank || 0);
  return [0.25, 0.5, 0.75, 1, 1.5, 2, 3][rank] || 0.25;
}
