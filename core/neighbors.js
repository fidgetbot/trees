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
      playerShading: false,
      shadingPlayer: false,
      heightGrowth: 0,
    };
  });
}
