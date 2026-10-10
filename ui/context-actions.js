const PLAYER_PRIORITY = [
  'extendRoot', 'growLeaves', 'growBranch', 'growTaller', 'bark', 'taproot',
  'canopy', 'flower', 'massFlower', 'rhizosphere', 'growThorns', 'toxicLeaves',
  'shelterGrove', 'woodSurge', 'resinReserve', 'mastYear',
];

const TARGET_PRIORITIES = {
  woodpecker: ['bark', 'resinReserve', 'growThorns'],
  beaver: ['extendRoot', 'taproot', 'shelterGrove'],
  'browser-deer': ['growThorns', 'toxicLeaves', 'shelterGrove'],
  'browser-rabbit': ['growThorns', 'toxicLeaves', 'shelterGrove'],
  surveyors: ['bark', 'growThorns', 'toxicLeaves'],
  loggers: ['bark', 'growThorns', 'toxicLeaves'],
};

export function pickSceneTarget(targets, x, y) {
  return [...(targets || [])].reverse().find(target => (
    x >= target.bounds.x
    && x <= target.bounds.x + target.bounds.width
    && y >= target.bounds.y
    && y <= target.bounds.y + target.bounds.height
  )) || null;
}

export function isActionRelevantToTarget(action, target, state, getRelationshipState = () => ({ name: 'Neutral' })) {
  if (!target || target.type === 'player-tree') return true;
  if (target.type === 'offspring-tree') return action.key === 'nurtureOffspring';
  if (target.type === 'wildlife' || target.type === 'human-encounter') {
    return (TARGET_PRIORITIES[target.kind] || []).includes(action.key);
  }
  if (target.type !== 'neighbor-tree') return false;

  const neighbor = state.neighbors?.[target.targetIndex];
  if (!neighbor || neighbor.dead) return false;
  const relationship = getRelationshipState(neighbor.relation).name;
  if (action.key === 'connect') return true;
  if (action.key === 'aidAlly') return relationship === 'Ally' && neighbor.health < neighbor.maxHealth;
  if (action.key === 'requestHelp') return relationship === 'Ally';
  if (action.key === 'shadeRival') return neighbor.slot === 1 || neighbor.slot === 3;
  if (action.key === 'rootDominion') return true;
  return false;
}

function playerPriority(state) {
  const priorities = [];
  if (!state.firstRootActionTaken || (state.rootZones || 0) < 2) priorities.push('extendRoot');
  if ((state.leafClusters || 0) < 2) priorities.push('growLeaves', 'growBranch');
  if ((state.health || 0) < (state.maxHealth || 0) * 0.65) priorities.push('bark');
  if (state.currentSeasonName === 'Spring') priorities.push('flower', 'massFlower');
  priorities.push(...PLAYER_PRIORITY);
  return [...new Set(priorities)];
}

export function getContextualActions({ target, usableActions, state, getRelationshipState, limit = 3 }) {
  const relevant = (usableActions || []).filter(({ action }) => (
    isActionRelevantToTarget(action, target, state, getRelationshipState)
  ));

  let priorities = [];
  if (!target || target.type === 'player-tree') priorities = playerPriority(state);
  else if (target.type === 'neighbor-tree') priorities = ['aidAlly', 'requestHelp', 'connect', 'shadeRival', 'rootDominion'];
  else if (target.type === 'offspring-tree') priorities = ['nurtureOffspring'];
  else priorities = TARGET_PRIORITIES[target.kind] || [];

  const priorityIndex = new Map(priorities.map((key, index) => [key, index]));
  return relevant
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (
      (priorityIndex.get(a.entry.action.key) ?? 999) - (priorityIndex.get(b.entry.action.key) ?? 999)
      || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function getTargetActionContext(target, state, getRelationshipState = () => ({ name: 'Neutral' })) {
  if (!target || target.type === 'player-tree') {
    return {
      kicker: 'Selected tree',
      title: `${state.selectedSpecies || 'Your tree'} · You`,
      detail: 'Growth, resilience, and reproduction',
    };
  }
  if (target.type === 'neighbor-tree') {
    const neighbor = state.neighbors?.[target.targetIndex];
    const relationship = neighbor ? getRelationshipState(neighbor.relation).name : 'Unknown';
    return {
      kicker: 'Selected neighbor',
      title: neighbor?.species || target.title || 'Neighboring tree',
      detail: `${target.stageName || 'Tree'} · ${relationship}`,
    };
  }
  if (target.type === 'offspring-tree') {
    return { kicker: 'Selected offspring', title: target.title || 'Offspring tree', detail: target.subtitle || 'Family care' };
  }
  if (target.type === 'human-encounter') {
    return { kicker: 'Selected encounter', title: target.title, detail: 'Preparations concerning this encounter' };
  }
  return { kicker: 'Selected wildlife', title: target.title, detail: 'Actions relevant to this visitor' };
}
