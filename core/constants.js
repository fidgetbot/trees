export const TURNS_PER_SEASON = 4;

export const SEASONS = [
  { name: 'Spring', factorSun: 1.0, factorWater: 1.0, top: '#FFE4E1', bottom: '#E6F3FF' },
  { name: 'Summer', factorSun: 1.2, factorWater: 0.6, top: '#FFD700', bottom: '#90EE90' },
  { name: 'Autumn', factorSun: 0.6, factorWater: 0.8, top: '#FF8C00', bottom: '#8B4513' },
  { name: 'Winter', factorSun: 0.2, factorWater: 0.4, top: '#D3D3D3', bottom: '#F0F8FF' },
];

export const TURNS_PER_YEAR = TURNS_PER_SEASON * SEASONS.length;

export const LIFE_STAGES = [
  { name: 'Seed', rank: 0, threshold: 0, unlocks: ['extendRoot'], damageMult: 3, popup: '' },
  { name: 'Sprout', rank: 1, threshold: 100, unlocks: ['growLeaves'], damageMult: 1.5, popup: 'Your shell cracks. You push outward into the unknown.' },
  { name: 'Seedling', rank: 2, threshold: 300, unlocks: ['defense', 'connect', 'growTaller', 'shadeRival', 'stopShade', 'bark', 'requestHelp', 'aidAlly'], damageMult: 1.5, popup: 'Your roots find rich soil. You feel sturdy.' },
  { name: 'Sapling', rank: 3, threshold: 600, unlocks: ['growBranch', 'taproot', 'canopy', 'rhizosphere'], damageMult: 1.2, popup: 'Your woody fibers harden. You have become a Sapling!' },
  { name: 'Young Tree', rank: 4, threshold: 1000, unlocks: ['flower', 'toxicLeaves', 'growThorns', 'interlaceCrown', 'primeResin'], damageMult: 1, popup: 'You yearn skyward. Your canopy reaches for the light.' },
  { name: 'Mature Tree', rank: 5, threshold: 3300, unlocks: ['massFlower', 'nurtureOffspring', 'shelterGrove', 'rootDominion', 'stopRootDominion', 'watchPath', 'staggerHarvest', 'closeApproach', 'rouseGrove'], damageMult: 0.8, popup: 'Fruits of your own hang heavy. The cycle turns.' },
  { name: 'Ancient', rank: 6, threshold: 10200, unlocks: ['mastYear'], damageMult: 0.5, popup: 'Lightning scar and fire ash — you endure. Ancient patience fills you. Now the survival of the wider grove will decide your legacy.' },
];

export const STAGE_BY_NAME = Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, stage]));

export const SEASONAL_ACTIONS = {
  growLeaves: ['Spring', 'Summer', 'Autumn'],
  flower: ['Spring'],
  massFlower: ['Spring'],
  mastYear: ['Spring'],
};

// New capabilities emerge over time within a stage instead of arriving in
// large stage-transition bundles. Some defensive growth begins before the
// next named life stage so discovery continues between major transformations.
export const PROGRESSIVE_ACTION_UNLOCKS = {
  growTaller: { stage: 'Seedling', turnsInStage: 0, label: 'upon reaching Seedling' },
  shadeRival: { stage: 'Seedling', turnsInStage: 0, label: 'upon reaching Seedling' },
  bark: { stage: 'Seedling', turnsInStage: TURNS_PER_SEASON, label: 'after 1 season as a Seedling' },
  taproot: { stage: 'Sapling', turnsInStage: 1, label: 'after 1 turn as a Sapling' },
  canopy: { stage: 'Sapling', turnsInStage: TURNS_PER_SEASON, label: 'after 1 season as a Sapling' },
  rhizosphere: { stage: 'Sapling', turnsInStage: TURNS_PER_SEASON * 5, label: 'after 5 seasons as a Sapling' },
  nurtureOffspring: { stage: 'Mature Tree', turnsInStage: TURNS_PER_SEASON, label: 'after 1 season as a Mature Tree' },
  shelterGrove: { stage: 'Mature Tree', turnsInStage: TURNS_PER_SEASON * 2, label: 'after 2 seasons as a Mature Tree' },
  rootDominion: { stage: 'Mature Tree', turnsInStage: TURNS_PER_SEASON * 3, label: 'after 3 seasons as a Mature Tree' },
  stopRootDominion: { stage: 'Mature Tree', turnsInStage: TURNS_PER_SEASON * 3, label: 'after 3 seasons as a Mature Tree' },
};

export const HUMAN_STORY_ACTION_UNLOCKS = {
  toxicLeaves: { chapter: 2, label: 'when swelling fruit reveals a new chemical possibility' },
  growThorns: { chapter: 6, label: 'when tender shoots discover a sharper form' },
  interlaceCrown: { chapter: 9, label: 'when flexible shoots discover how to close the crown' },
  primeResin: { chapter: 12, label: 'when the trunk learns to hold resin beneath its bark' },
  watchPath: { chapter: 15, label: 'when younger roots are ready to answer' },
  staggerHarvest: { chapter: 15, label: 'when younger roots are ready to answer' },
  closeApproach: { chapter: 15, label: 'when younger roots are ready to answer' },
  rouseGrove: { chapter: 18, label: 'when the prepared grove can answer as one' },
};

export const RELATIONSHIP_STATES = {
  ALLY: { min: 50, name: 'Ally', color: '#4CAF50' },
  FRIENDLY: { min: 10, name: 'Friendly', color: '#8BC34A' },
  NEUTRAL: { min: -10, name: 'Neutral', color: '#9E9E9E' },
  RIVAL: { min: -50, name: 'Rival', color: '#FF9800' },
  HOSTILE: { min: -100, name: 'Hostile', color: '#F44336' },
};

export function getRelationshipState(score) {
  if (score >= 50) return RELATIONSHIP_STATES.ALLY;
  if (score >= 10) return RELATIONSHIP_STATES.FRIENDLY;
  if (score >= -10) return RELATIONSHIP_STATES.NEUTRAL;
  if (score >= -50) return RELATIONSHIP_STATES.RIVAL;
  return RELATIONSHIP_STATES.HOSTILE;
}

export function getLifeStage(score) {
  for (let i = LIFE_STAGES.length - 1; i >= 0; i--) {
    if (score >= LIFE_STAGES[i].threshold) return LIFE_STAGES[i];
  }
  return LIFE_STAGES[0];
}

export function getNeighborStage(score) {
  return getLifeStage(score);
}
