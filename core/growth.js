export function playerHeightLevel(state) {
  return ((state.lifeStage?.rank || 0) * 4) + Math.max(0, state.heightGrowth || 0);
}

export function neighborHeightLevel(neighbor, getNeighborStage) {
  return ((getNeighborStage(neighbor.stageScore).rank || 0) * 4) + Math.max(0, neighbor.heightGrowth || 0);
}

export function canPlayerShadeNeighbor(state, neighbor, getNeighborStage) {
  return playerHeightLevel(state) >= neighborHeightLevel(neighbor, getNeighborStage);
}

export function allyResourceWeight(neighbor, getNeighborStage) {
  const rank = Math.max(0, getNeighborStage(neighbor.stageScore).rank || 0);
  return [0.25, 0.5, 0.75, 1, 1.5, 2, 3][rank] || 0.25;
}
