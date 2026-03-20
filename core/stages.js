import { LIFE_STAGES } from './constants.js';

export function computeCurrentLifeStage(state) {
  return state.lifeStage || LIFE_STAGES[0];
}

export function turnsForYears(years) {
  return years * 12;
}

export function currentStageRequirements(state) {
  const stage = computeCurrentLifeStage(state).name;
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

export function getNextStage(state) {
  const current = computeCurrentLifeStage(state);
  return LIFE_STAGES.find(stage => stage.rank === current.rank + 1) || null;
}

export function resetStageProgressCounters(state, rng = Math.random) {
  state.turnsInStage = 0;
  state.majorEventsSurvivedInStage = 0;
  state.growthNudgeCooldown = 3 + Math.floor(rng() * 2);
}
