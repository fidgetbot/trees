export const SEASONS = [
  { name: 'Spring', factorSun: 0.8, factorWater: 1.0, top: '#FFE4E1', bottom: '#E6F3FF' },
  { name: 'Summer', factorSun: 1.2, factorWater: 0.6, top: '#FFD700', bottom: '#90EE90' },
  { name: 'Autumn', factorSun: 0.6, factorWater: 0.8, top: '#FF8C00', bottom: '#8B4513' },
  { name: 'Winter', factorSun: 0.2, factorWater: 0.4, top: '#D3D3D3', bottom: '#F0F8FF' },
];

export const LIFE_STAGES = [
  { name: 'Seed', rank: 0, threshold: 0, unlocks: ['extendRoot'], damageMult: 3, popup: '' },
  { name: 'Sprout', rank: 1, threshold: 100, unlocks: ['growLeaves'], damageMult: 1.5, popup: 'Your shell cracks. You push outward into the unknown.' },
  { name: 'Seedling', rank: 2, threshold: 300, unlocks: ['defense', 'connect', 'requestHelp'], damageMult: 1.5, popup: 'Your taproot finds rich soil. You feel sturdy.' },
  { name: 'Sapling', rank: 3, threshold: 600, unlocks: ['growBranch', 'taproot', 'canopy', 'aidAlly'], damageMult: 1.2, popup: 'Your woody fibers harden. You have become a Sapling!' },
  { name: 'Small Tree', rank: 4, threshold: 1000, unlocks: ['flower', 'bark', 'shadeRival', 'rhizosphere'], damageMult: 1, popup: 'You yearn skyward. Your canopy reaches for the light.' },
  { name: 'Mature Tree', rank: 5, threshold: 2000, unlocks: ['thicken', 'massFlower', 'nurtureOffspring', 'shelterGrove'], damageMult: 0.8, popup: 'Fruits of your own hang heavy. The cycle turns.' },
  { name: 'Ancient', rank: 6, threshold: 5000, unlocks: ['victory', 'rootDominion', 'mastYear'], damageMult: 0.5, popup: 'Lightning scar and fire ash — you endure. Ancient patience fills you.' },
];

export const STAGE_BY_NAME = Object.fromEntries(LIFE_STAGES.map(stage => [stage.name, stage]));

export const SEASONAL_ACTIONS = {
  flower: ['Spring'],
  massFlower: ['Spring'],
  mastYear: ['Spring'],
};

export const LEADERBOARD_KEY = 'trees-grove-records-v1';

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
