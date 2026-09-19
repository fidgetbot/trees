export function createStartingNeighbors(speciesNames, lifeStages, random = Math.random) {
  const shuffled = [...speciesNames].sort(() => random() - 0.5);
  const positions = [0, 1, 3, 4];
  return positions.map((slot, index) => {
    const species = shuffled[index % shuffled.length];
    const outerStages = ['Sapling', 'Young Tree', 'Mature Tree'];
    const stageName = (slot === 1 || slot === 3)
      ? 'Seed'
      : outerStages[Math.floor(random() * outerStages.length)];
    const stage = lifeStages.find(candidate => candidate.name === stageName) || lifeStages[0];
    return {
      slot,
      species,
      relation: 0,
      stageScore: stageName === 'Seed' ? 0 : stage.threshold + Math.floor(random() * 160),
      hostile: false,
      ally: false,
      helpGivenToThem: 0,
      growthAidReceived: 0,
      firstAidStageScore: null,
      helpRefusedToThem: 0,
      helpReceivedFromThem: 0,
      timesAskedThemForHelp: 0,
      lastAidMemory: '',
      maxHealth: 10,
      health: 10,
      activeCrises: [],
      crisisCounter: 0,
      dead: false,
      deathAge: 0,
      deathStageScore: null,
      playerShading: false,
      shadingPlayer: false,
      heightGrowth: 0,
    };
  });
}

export function advanceNeighborDeathCycle(neighbor, { speciesNames, seedlingThreshold, random = Math.random } = {}) {
  if (!neighbor?.dead) return { changed: false, phase: 'living' };
  neighbor.deathAge = (neighbor.deathAge || 0) + 1;
  if (neighbor.deathAge < 4) return { changed: true, phase: 'dead-tree', age: neighbor.deathAge };
  if (neighbor.deathAge < 7) return { changed: true, phase: 'stump', age: neighbor.deathAge };
  const choices = speciesNames?.length ? speciesNames : [neighbor.species || 'Tree'];
  neighbor.species = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  neighbor.stageScore = seedlingThreshold;
  neighbor.relation = 0;
  neighbor.health = neighbor.maxHealth = 10;
  neighbor.dead = false;
  neighbor.deathAge = 0;
  neighbor.deathCause = null;
  neighbor.deathStageScore = null;
  neighbor.helpGivenToThem = 0;
  neighbor.helpRefusedToThem = 0;
  neighbor.helpReceivedFromThem = 0;
  neighbor.timesAskedThemForHelp = 0;
  neighbor.lastAidMemory = '';
  return { changed: true, phase: 'seedling', species: neighbor.species };
}
